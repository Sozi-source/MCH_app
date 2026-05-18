/**
 * src/lib/notificationService.ts
 * mamaTOTO — Production Notification Service
 *
 * Lazy-loads expo-notifications so the app runs normally on builds that
 * don't yet have the native module compiled in (e.g. old dev APK).
 * All exported functions silently no-op when the module is unavailable.
 */

import * as Device from 'expo-device';
import type AsyncStorageType from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getZScoreAlerts } from '@/lib/nutritionData';
import type { GrowthRecord } from '@/store/childStore';
import type { VaccineRow } from '@/store/vaccineStore';
import type { Child } from '@/types';
import type * as NotificationsType from 'expo-notifications';

// ─────────────────────────────────────────────────────────────────────────────
// Lazy-load guard — all functions below check this before doing anything
// ─────────────────────────────────────────────────────────────────────────────

let N: typeof NotificationsType | null = null;
try {
  N = require('expo-notifications') as typeof NotificationsType;
} catch {
  console.warn('[notificationService] expo-notifications not available — notifications disabled.');
}

type AS = typeof AsyncStorageType;
const _as: AS | null = (() => {
  try {
    return require('@react-native-async-storage/async-storage').default as AS;
  } catch {
    console.warn('[notificationService] AsyncStorage not available.');
    return null;
  }
})();
const store = {
  getItem:     (k: string)         => _as ? _as.getItem(k)           : Promise.resolve(null),
  setItem:     (k: string, v: string) => _as ? _as.setItem(k, v)    : Promise.resolve(),
  multiRemove: (keys: string[])    => _as ? _as.multiRemove(keys)    : Promise.resolve(),
  available:   () => _as !== null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  SENT_GROWTH_ALERTS:  'notif:sent_growth_alerts',
  SENT_VACCINE_ALERTS: 'notif:sent_vaccine_alerts',
  PUSH_TOKEN:          'notif:push_token',
};

const CHANNELS = {
  URGENT:   'mamatoto-urgent',
  VACCINES: 'mamatoto-vaccines',
  GROWTH:   'mamatoto-growth',
  TIPS:     'mamatoto-tips',
};

// ─────────────────────────────────────────────────────────────────────────────
// One-time setup — call once from root _layout.tsx
// ─────────────────────────────────────────────────────────────────────────────

export async function setupNotifications(): Promise<string | null> {
  if (!N) return null;

  N.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      return {
        shouldShowAlert:  true,
        shouldShowBanner: true,
        shouldShowList:   true,
        shouldPlaySound:  data?.urgency === 'urgent',
        shouldSetBadge:   data?.urgency === 'urgent',
      };
    },
  });

  if (Platform.OS === 'android') {
    await Promise.all([
      N.setNotificationChannelAsync(CHANNELS.URGENT, {
        name:             '⚠️ Urgent Health Alerts',
        importance:       N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#A32D2D',
        sound:            'default',
        description:      'Critical child health alerts requiring immediate action',
      }),
      N.setNotificationChannelAsync(CHANNELS.VACCINES, {
        name:             '💉 Vaccine Reminders',
        importance:       N.AndroidImportance.HIGH,
        vibrationPattern: [0, 200],
        lightColor:       '#BA7517',
        sound:            'default',
        description:      'Vaccine due date and missed vaccine alerts',
      }),
      N.setNotificationChannelAsync(CHANNELS.GROWTH, {
        name:             '📊 Growth Monitoring',
        importance:       N.AndroidImportance.DEFAULT,
        lightColor:       '#208AEF',
        description:      'Growth monitoring and z-score alerts',
      }),
      N.setNotificationChannelAsync(CHANNELS.TIPS, {
        name:             '💡 Daily Health Tips',
        importance:       N.AndroidImportance.LOW,
        description:      'Daily maternal and child health tips',
      }),
    ]);
  }

  if (!Device.isDevice) return null;

  const { status: existing } = await N.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await N.requestPermissionsAsync({
      ios: {
        allowAlert:          true,
        allowBadge:          true,
        allowSound:          true,
        allowCriticalAlerts: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  await scheduleDailyTip();

  try {
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    if (!projectId) {
      console.warn('[notificationService] EXPO_PUBLIC_PROJECT_ID is not set — push token skipped');
      return null;
    }
    const tokenData = await N.getExpoPushTokenAsync({ projectId });
    await store.setItem(STORAGE_KEYS.PUSH_TOKEN, tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.warn('[notificationService] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tap-to-navigate handler
// ─────────────────────────────────────────────────────────────────────────────

export function registerTapHandler(
  router: { push: (screen: string) => void },
): { remove: () => void } {
  if (!N) return { remove: () => {} };

  const sub = N.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    const screen = data?.screen;
    if (typeof screen === 'string' && screen) {
      router.push(screen);
    }
  });

  return sub;
}

// ─────────────────────────────────────────────────────────────────────────────
// Growth alert notifications
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyGrowthAlerts(
  record: GrowthRecord,
  child: Child,
): Promise<void> {
  if (!N) return;

  const alerts = getZScoreAlerts(record.waz, record.haz, record.whz, record.age_months);
  if (alerts.length === 0) return;

  const sentRaw = await store.getItem(STORAGE_KEYS.SENT_GROWTH_ALERTS);
  const sent: Set<string> = new Set(sentRaw ? JSON.parse(sentRaw) : []);

  for (const alert of alerts) {
    const key = `${record.id}:${alert.indicator}`;
    if (sent.has(key)) continue;

    const isUrgent = alert.urgency === 'urgent';

    await N.scheduleNotificationAsync({
      content: {
        title: isUrgent
          ? `⚠️ Urgent: ${child.full_name} — ${alert.classification}`
          : `📊 Monitor: ${child.full_name} — ${alert.classification}`,
        body:  truncate(alert.action, 200),
        sound: isUrgent ? 'default' : undefined,
        badge: isUrgent ? 1 : undefined,
        data: {
          type:      'growth_alert',
          urgency:   alert.urgency,
          indicator: alert.indicator,
          childId:   child.id,
          recordId:  record.id,
          screen:    '/(tabs)/growth',
        },
        ...(Platform.OS === 'android' && {
          channelId: isUrgent ? CHANNELS.URGENT : CHANNELS.GROWTH,
          color:     isUrgent ? '#A32D2D' : '#208AEF',
        }),
      },
      trigger: null,
    });

    sent.add(key);
  }

  await store.setItem(STORAGE_KEYS.SENT_GROWTH_ALERTS, JSON.stringify([...sent]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Vaccine alert notifications
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyVaccineAlerts(
  vaccineRows: VaccineRow[],
  child: Child,
): Promise<void> {
  if (!N) return;

  const sentRaw = await store.getItem(STORAGE_KEYS.SENT_VACCINE_ALERTS);
  const sent: Set<string> = new Set(sentRaw ? JSON.parse(sentRaw) : []);

  const due    = vaccineRows.filter(r => r.status === 'due');
  const missed = vaccineRows.filter(r => r.status === 'missed');

  const newDue = due.filter(r => !sent.has(`${child.id}:due:${r.schedule.id}`));
  if (newDue.length > 0) {
    const names = newDue
      .map(r => `${r.schedule.vaccine_name}${r.schedule.dose_number > 0 ? ` dose ${r.schedule.dose_number}` : ''}`)
      .join(', ');

    await N.scheduleNotificationAsync({
      content: {
        title: `💉 ${child.full_name}: ${newDue.length} vaccine${newDue.length > 1 ? 's' : ''} due now`,
        body:  `${names}. Please visit your nearest MCH clinic.`,
        sound: 'default',
        data: { type: 'vaccine_due', urgency: 'urgent', childId: child.id, screen: '/(tabs)/vaccines' },
        ...(Platform.OS === 'android' && { channelId: CHANNELS.VACCINES, color: '#BA7517' }),
      },
      trigger: null,
    });
    for (const r of newDue) sent.add(`${child.id}:due:${r.schedule.id}`);
  }

  const newMissed = missed.filter(r => !sent.has(`${child.id}:missed:${r.schedule.id}`));
  if (newMissed.length > 0) {
    const names = newMissed
      .map(r => `${r.schedule.vaccine_name}${r.schedule.dose_number > 0 ? ` dose ${r.schedule.dose_number}` : ''}`)
      .join(', ');

    await N.scheduleNotificationAsync({
      content: {
        title: `⚠️ ${child.full_name}: ${newMissed.length} missed vaccine${newMissed.length > 1 ? 's' : ''}`,
        body:  `${names} — missed vaccines should be caught up at your MCH clinic as soon as possible.`,
        sound: 'default',
        badge: 1,
        data: { type: 'vaccine_missed', urgency: 'urgent', childId: child.id, screen: '/(tabs)/vaccines' },
        ...(Platform.OS === 'android' && { channelId: CHANNELS.URGENT, color: '#A32D2D' }),
      },
      trigger: null,
    });
    for (const r of newMissed) sent.add(`${child.id}:missed:${r.schedule.id}`);
  }

  await store.setItem(STORAGE_KEYS.SENT_VACCINE_ALERTS, JSON.stringify([...sent]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule future vaccine reminders
// ─────────────────────────────────────────────────────────────────────────────

export async function scheduleVaccineDueReminders(
  vaccineRows: VaccineRow[],
  child: Child,
): Promise<void> {
  if (!N) return;

  const allScheduled = await N.getAllScheduledNotificationsAsync();
  const toCancel = allScheduled.filter(n => {
    const data = n.content.data as Record<string, unknown>;
    return data?.childId === child.id && data?.type === 'vaccine_scheduled';
  });
  await Promise.all(toCancel.map(n => N!.cancelScheduledNotificationAsync(n.identifier)));

  const upcoming = vaccineRows.filter(
    r => r.status === 'upcoming' && r.dueDate && r.dueDate > new Date(),
  );

  for (const row of upcoming) {
    if (!row.dueDate) continue;

    const reminderDate = new Date(row.dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3);
    reminderDate.setHours(9, 0, 0, 0);
    if (reminderDate <= new Date()) continue;

    const vaccineName = `${row.schedule.vaccine_name}${row.schedule.dose_number > 0 ? ` dose ${row.schedule.dose_number}` : ''}`;
    const trigger: NotificationsType.DateTriggerInput = { type: N.SchedulableTriggerInputTypes.DATE, date: reminderDate };

    await N.scheduleNotificationAsync({
      content: {
        title: `💉 Reminder: ${child.full_name}'s ${vaccineName} in 3 days`,
        body:  `Due on ${row.dueDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'long' })}. Book your MCH clinic visit now.`,
        data:  { type: 'vaccine_scheduled', childId: child.id, screen: '/(tabs)/vaccines' },
        ...(Platform.OS === 'android' && { channelId: CHANNELS.VACCINES }),
      },
      trigger,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily health tip
// ─────────────────────────────────────────────────────────────────────────────

async function scheduleDailyTip(): Promise<void> {
  if (!N) return;

  const allScheduled = await N.getAllScheduledNotificationsAsync();
  const existing = allScheduled.filter(
    n => (n.content.data as Record<string, unknown>)?.type === 'daily_tip',
  );
  await Promise.all(existing.map(n => N!.cancelScheduledNotificationAsync(n.identifier)));

  const trigger: NotificationsType.DailyTriggerInput = { type: N.SchedulableTriggerInputTypes.DAILY, hour: 8, minute: 0 };

  await N.scheduleNotificationAsync({
    content: {
      title: '🌟 Mama na Mtoto Health Tip',
      body:  "Open the app to see today's verified nutrition and health tip for your child.",
      data:  { type: 'daily_tip', screen: '/(tabs)/index' },
      ...(Platform.OS === 'android' && { channelId: CHANNELS.TIPS }),
    },
    trigger,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Clear sent-alert cache — call when switching active child
// ─────────────────────────────────────────────────────────────────────────────

export async function clearNotificationCache(): Promise<void> {
  await store.multiRemove([
    STORAGE_KEYS.SENT_GROWTH_ALERTS,
    STORAGE_KEYS.SENT_VACCINE_ALERTS,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}