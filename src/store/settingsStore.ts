import { create } from 'zustand';
import { Language } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export interface NotificationPrefs {
  vaccineReminders: boolean;
  growthAlerts: boolean;
  dailyTips: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  vaccineReminders: true,
  growthAlerts: true,
  dailyTips: true,
};

interface SettingsState {
  language: Language;
  notifPrefs: NotificationPrefs;
  setLanguage: (lang: Language, userId?: string) => Promise<void>;
  setNotifPref: (key: keyof NotificationPrefs, value: boolean, userId?: string) => Promise<void>;
  loadSettings: (userId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'en',
  notifPrefs: DEFAULT_NOTIF_PREFS,

  setLanguage: async (lang, userId) => {
    set({ language: lang });
    if (userId) {
      await supabase.from('user_settings').upsert(
        { user_id: userId, language: lang },
        { onConflict: 'user_id' }
      );
    }
  },

  setNotifPref: async (key, value, userId) => {
    const updated = { ...get().notifPrefs, [key]: value };
    set({ notifPrefs: updated });
    if (userId) {
      await supabase.from('user_settings').upsert(
        { user_id: userId, notification_prefs: updated },
        { onConflict: 'user_id' }
      );
    }
  },

  loadSettings: async (userId) => {
    const { data } = await supabase
      .from('user_settings')
      .select('language, notification_prefs')
      .eq('user_id', userId)
      .single();
    if (data?.language) set({ language: data.language as Language });
    if (data?.notification_prefs) {
      set({ notifPrefs: { ...DEFAULT_NOTIF_PREFS, ...data.notification_prefs } });
    }
  },
}));