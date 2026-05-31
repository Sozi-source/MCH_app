// src/app/(tabs)/growth.tsx
// mamaTOTO — Growth Tracker
// WHO colour-coded stripe system: SAM (red), MAM (amber), Normal (green)
// Growth charts use proper WHO SD reference curves via react-native-svg

import { supabase } from '@/lib/supabase';
import { useT } from '@/hooks/useT';
import { COLORS, RADIUS } from '@/lib/theme';
import { calculateZScores } from '@/lib/zscore';
import { getZScoreAlerts, ActiveAlert } from '@/lib/nutritionData';
import { GrowthRecord, useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Polyline, Polygon, Circle, Text as SvgText, Line, G,
} from 'react-native-svg';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  blue:       '#185FA5',
  blueMid:    '#378ADD',
  blueLight:  '#E6F1FB',
  blueDark:   '#0C447C',
  teal:       '#0F6E56',
  tealLight:  '#E1F5EE',
  tealMid:    '#1D9E75',
  amber:      '#854F0B',
  amberLight: '#FAEEDA',
  amberMid:   '#EF9F27',
  red:        '#A32D2D',
  redLight:   '#FCEBEB',
  redMid:     '#E24B4A',
  gray:       '#F4F6F9',
  grayBorder: '#D3D1C7',
  grayMuted:  '#888780',
  grayDark:   '#5F5E5A',
  white:      '#ffffff',
  text:       '#1A202C',
};

// ─── WHO Classification colours ──────────────────────────────────────────────
const WHO = {
  SAM: {
    stripe:'#C0392B', bg:'#FDECEC', text:'#7B1A1A',
    badge:'#E74C3C', badgeTxt:'#FFFFFF', label:'SAM', fullLabel:'Severe Acute Malnutrition',
  },
  MAM: {
    stripe:'#D97706', bg:'#FEF3C7', text:'#78350F',
    badge:'#F59E0B', badgeTxt:'#FFFFFF', label:'MAM', fullLabel:'Moderate Acute Malnutrition',
  },
  HIGH: {
    stripe:'#D97706', bg:'#FEF3C7', text:'#78350F',
    badge:'#F59E0B', badgeTxt:'#FFFFFF', label:'HIGH', fullLabel:'Above Normal',
  },
  OBESE: {
    stripe:'#C0392B', bg:'#FDECEC', text:'#7B1A1A',
    badge:'#E74C3C', badgeTxt:'#FFFFFF', label:'OBESE', fullLabel:'Obese (WHZ >+3)',
  },
  NORMAL: {
    stripe:'#059669', bg:'#D1FAE5', text:'#064E3B',
    badge:'#10B981', badgeTxt:'#FFFFFF', label:'Normal', fullLabel:'Normal',
  },
  NO_DATA: {
    stripe:'#9CA3AF', bg:'#F3F4F6', text:'#4B5563',
    badge:'#9CA3AF', badgeTxt:'#FFFFFF', label:'—', fullLabel:'No data',
  },
} as const;

type WHOStatus = keyof typeof WHO;

function whoStatus(z: number | null): WHOStatus {
  if (z === null) return 'NO_DATA';
  if (z < -3) return 'SAM';
  if (z < -2) return 'MAM';
  if (z > 3)  return 'OBESE';
  if (z > 2)  return 'HIGH';
  return 'NORMAL';
}

function overallWHOStatus(waz: number|null, haz: number|null, whz: number|null): WHOStatus {
  const statuses = [waz, haz, whz].map(whoStatus);
  const priority: WHOStatus[] = ['SAM','OBESE','MAM','HIGH','NORMAL','NO_DATA'];
  for (const p of priority) if (statuses.includes(p)) return p;
  return 'NO_DATA';
}

// ─── WHO Reference Data (0-24 months) ─────────────────────────────────────────
type SDRow = { sd3neg:number; sd2neg:number; sd1neg:number; median:number; sd1:number; sd2:number; sd3:number };

const WHO_WAZ_BOYS: Record<number, SDRow> = {
  0:{sd3neg:2.1,sd2neg:2.5,sd1neg:2.9,median:3.3,sd1:3.9,sd2:4.4,sd3:5.0},
  1:{sd3neg:2.9,sd2neg:3.4,sd1neg:3.9,median:4.5,sd1:5.1,sd2:5.8,sd3:6.6},
  2:{sd3neg:3.8,sd2neg:4.3,sd1neg:4.9,median:5.6,sd1:6.3,sd2:7.1,sd3:8.0},
  3:{sd3neg:4.4,sd2neg:5.0,sd1neg:5.7,median:6.4,sd1:7.2,sd2:8.0,sd3:9.0},
  4:{sd3neg:4.8,sd2neg:5.6,sd1neg:6.2,median:7.0,sd1:7.8,sd2:8.7,sd3:9.7},
  5:{sd3neg:5.3,sd2neg:6.0,sd1neg:6.7,median:7.5,sd1:8.4,sd2:9.3,sd3:10.4},
  6:{sd3neg:5.7,sd2neg:6.4,sd1neg:7.1,median:7.9,sd1:8.8,sd2:9.8,sd3:10.9},
  7:{sd3neg:5.9,sd2neg:6.7,sd1neg:7.4,median:8.3,sd1:9.2,sd2:10.3,sd3:11.4},
  8:{sd3neg:6.2,sd2neg:7.0,sd1neg:7.7,median:8.6,sd1:9.6,sd2:10.7,sd3:11.9},
  9:{sd3neg:6.4,sd2neg:7.1,sd1neg:8.0,median:8.9,sd1:9.9,sd2:11.0,sd3:12.3},
  10:{sd3neg:6.6,sd2neg:7.4,sd1neg:8.2,median:9.2,sd1:10.2,sd2:11.4,sd3:12.7},
  11:{sd3neg:6.8,sd2neg:7.6,sd1neg:8.4,median:9.4,sd1:10.5,sd2:11.7,sd3:13.0},
  12:{sd3neg:6.9,sd2neg:7.7,sd1neg:8.6,median:9.6,sd1:10.8,sd2:12.0,sd3:13.3},
  13:{sd3neg:7.1,sd2neg:7.9,sd1neg:8.8,median:9.9,sd1:11.0,sd2:12.3,sd3:13.7},
  14:{sd3neg:7.2,sd2neg:8.1,sd1neg:9.0,median:10.1,sd1:11.3,sd2:12.6,sd3:14.0},
  15:{sd3neg:7.4,sd2neg:8.3,sd1neg:9.2,median:10.3,sd1:11.5,sd2:12.8,sd3:14.3},
  16:{sd3neg:7.5,sd2neg:8.4,sd1neg:9.4,median:10.5,sd1:11.7,sd2:13.1,sd3:14.6},
  17:{sd3neg:7.7,sd2neg:8.6,sd1neg:9.6,median:10.7,sd1:12.0,sd2:13.4,sd3:14.9},
  18:{sd3neg:7.8,sd2neg:8.8,sd1neg:9.8,median:10.9,sd1:12.2,sd2:13.7,sd3:15.3},
  19:{sd3neg:8.0,sd2neg:8.9,sd1neg:10.0,median:11.1,sd1:12.5,sd2:13.9,sd3:15.6},
  20:{sd3neg:8.1,sd2neg:9.1,sd1neg:10.1,median:11.3,sd1:12.7,sd2:14.2,sd3:15.9},
  21:{sd3neg:8.2,sd2neg:9.2,sd1neg:10.3,median:11.5,sd1:12.9,sd2:14.5,sd3:16.2},
  22:{sd3neg:8.4,sd2neg:9.4,sd1neg:10.5,median:11.8,sd1:13.2,sd2:14.7,sd3:16.5},
  23:{sd3neg:8.5,sd2neg:9.5,sd1neg:10.7,median:12.0,sd1:13.4,sd2:15.0,sd3:16.8},
  24:{sd3neg:8.6,sd2neg:9.7,sd1neg:10.8,median:12.2,sd1:13.6,sd2:15.3,sd3:17.1},
};
const WHO_WAZ_GIRLS: Record<number, SDRow> = {
  0:{sd3neg:2.0,sd2neg:2.4,sd1neg:2.8,median:3.2,sd1:3.7,sd2:4.2,sd3:4.8},
  1:{sd3neg:2.7,sd2neg:3.2,sd1neg:3.6,median:4.2,sd1:4.8,sd2:5.5,sd3:6.2},
  2:{sd3neg:3.4,sd2neg:3.9,sd1neg:4.5,median:5.1,sd1:5.8,sd2:6.6,sd3:7.5},
  3:{sd3neg:4.0,sd2neg:4.5,sd1neg:5.2,median:5.8,sd1:6.6,sd2:7.5,sd3:8.5},
  4:{sd3neg:4.4,sd2neg:5.0,sd1neg:5.7,median:6.4,sd1:7.3,sd2:8.2,sd3:9.3},
  5:{sd3neg:4.8,sd2neg:5.4,sd1neg:6.1,median:6.9,sd1:7.8,sd2:8.8,sd3:10.0},
  6:{sd3neg:5.1,sd2neg:5.7,sd1neg:6.5,median:7.3,sd1:8.2,sd2:9.3,sd3:10.6},
  7:{sd3neg:5.3,sd2neg:6.0,sd1neg:6.8,median:7.6,sd1:8.6,sd2:9.8,sd3:11.1},
  8:{sd3neg:5.6,sd2neg:6.3,sd1neg:7.0,median:7.9,sd1:9.0,sd2:10.2,sd3:11.6},
  9:{sd3neg:5.8,sd2neg:6.5,sd1neg:7.3,median:8.2,sd1:9.3,sd2:10.5,sd3:12.0},
  10:{sd3neg:6.0,sd2neg:6.7,sd1neg:7.5,median:8.5,sd1:9.6,sd2:10.9,sd3:12.4},
  11:{sd3neg:6.1,sd2neg:6.9,sd1neg:7.7,median:8.7,sd1:9.9,sd2:11.2,sd3:12.8},
  12:{sd3neg:6.3,sd2neg:7.0,sd1neg:7.9,median:8.9,sd1:10.1,sd2:11.5,sd3:13.1},
  13:{sd3neg:6.4,sd2neg:7.2,sd1neg:8.1,median:9.2,sd1:10.4,sd2:11.8,sd3:13.5},
  14:{sd3neg:6.6,sd2neg:7.4,sd1neg:8.3,median:9.4,sd1:10.6,sd2:12.1,sd3:13.8},
  15:{sd3neg:6.7,sd2neg:7.6,sd1neg:8.5,median:9.6,sd1:10.9,sd2:12.4,sd3:14.1},
  16:{sd3neg:6.9,sd2neg:7.7,sd1neg:8.7,median:9.8,sd1:11.1,sd2:12.6,sd3:14.5},
  17:{sd3neg:7.0,sd2neg:7.9,sd1neg:8.9,median:10.0,sd1:11.4,sd2:12.9,sd3:14.8},
  18:{sd3neg:7.2,sd2neg:8.1,sd1neg:9.1,median:10.2,sd1:11.6,sd2:13.2,sd3:15.1},
  19:{sd3neg:7.3,sd2neg:8.2,sd1neg:9.2,median:10.4,sd1:11.8,sd2:13.5,sd3:15.4},
  20:{sd3neg:7.5,sd2neg:8.4,sd1neg:9.4,median:10.6,sd1:12.1,sd2:13.7,sd3:15.7},
  21:{sd3neg:7.6,sd2neg:8.6,sd1neg:9.6,median:10.9,sd1:12.3,sd2:14.0,sd3:16.0},
  22:{sd3neg:7.8,sd2neg:8.7,sd1neg:9.8,median:11.1,sd1:12.5,sd2:14.3,sd3:16.4},
  23:{sd3neg:7.9,sd2neg:8.9,sd1neg:10.0,median:11.3,sd1:12.8,sd2:14.6,sd3:16.7},
  24:{sd3neg:8.1,sd2neg:9.0,sd1neg:10.2,median:11.5,sd1:13.0,sd2:14.8,sd3:17.0},
};
const WHO_HAZ_BOYS: Record<number, SDRow> = {
  0:{sd3neg:44.2,sd2neg:46.1,sd1neg:48.0,median:49.9,sd1:51.8,sd2:53.7,sd3:55.6},
  1:{sd3neg:48.9,sd2neg:50.8,sd1neg:52.8,median:54.7,sd1:56.7,sd2:58.6,sd3:60.6},
  2:{sd3neg:52.4,sd2neg:54.4,sd1neg:56.4,median:58.4,sd1:60.4,sd2:62.4,sd3:64.4},
  3:{sd3neg:55.3,sd2neg:57.3,sd1neg:59.4,median:61.4,sd1:63.5,sd2:65.5,sd3:67.6},
  4:{sd3neg:57.6,sd2neg:59.7,sd1neg:61.8,median:63.9,sd1:66.0,sd2:68.0,sd3:70.1},
  5:{sd3neg:59.6,sd2neg:61.7,sd1neg:63.8,median:65.9,sd1:68.0,sd2:70.1,sd3:72.2},
  6:{sd3neg:61.2,sd2neg:63.3,sd1neg:65.5,median:67.6,sd1:69.8,sd2:71.9,sd3:74.0},
  7:{sd3neg:62.7,sd2neg:64.8,sd1neg:67.0,median:69.2,sd1:71.3,sd2:73.5,sd3:75.7},
  8:{sd3neg:64.0,sd2neg:66.2,sd1neg:68.4,median:70.6,sd1:72.8,sd2:75.0,sd3:77.2},
  9:{sd3neg:65.2,sd2neg:67.5,sd1neg:69.7,median:72.0,sd1:74.2,sd2:76.5,sd3:78.7},
  10:{sd3neg:66.4,sd2neg:68.7,sd1neg:71.0,median:73.3,sd1:75.6,sd2:77.9,sd3:80.1},
  11:{sd3neg:67.6,sd2neg:69.9,sd1neg:72.2,median:74.5,sd1:76.9,sd2:79.2,sd3:81.5},
  12:{sd3neg:68.6,sd2neg:71.0,sd1neg:73.4,median:75.7,sd1:78.1,sd2:80.5,sd3:82.9},
  13:{sd3neg:69.6,sd2neg:72.1,sd1neg:74.5,median:76.9,sd1:79.3,sd2:81.8,sd3:84.2},
  14:{sd3neg:70.6,sd2neg:73.1,sd1neg:75.6,median:78.0,sd1:80.5,sd2:83.0,sd3:85.5},
  15:{sd3neg:71.6,sd2neg:74.1,sd1neg:76.6,median:79.1,sd1:81.7,sd2:84.2,sd3:86.7},
  16:{sd3neg:72.5,sd2neg:75.0,sd1neg:77.6,median:80.2,sd1:82.8,sd2:85.4,sd3:88.0},
  17:{sd3neg:73.3,sd2neg:76.0,sd1neg:78.6,median:81.2,sd1:83.9,sd2:86.5,sd3:89.2},
  18:{sd3neg:74.2,sd2neg:76.9,sd1neg:79.6,median:82.3,sd1:85.0,sd2:87.7,sd3:90.4},
  19:{sd3neg:75.0,sd2neg:77.7,sd1neg:80.5,median:83.2,sd1:86.0,sd2:88.8,sd3:91.5},
  20:{sd3neg:75.8,sd2neg:78.6,sd1neg:81.4,median:84.2,sd1:87.0,sd2:89.8,sd3:92.6},
  21:{sd3neg:76.5,sd2neg:79.4,sd1neg:82.3,median:85.1,sd1:88.0,sd2:90.9,sd3:93.8},
  22:{sd3neg:77.2,sd2neg:80.2,sd1neg:83.1,median:86.0,sd1:88.9,sd2:91.9,sd3:94.9},
  23:{sd3neg:78.0,sd2neg:81.0,sd1neg:83.9,median:86.9,sd1:89.9,sd2:92.9,sd3:95.9},
  24:{sd3neg:78.7,sd2neg:81.7,sd1neg:84.8,median:87.8,sd1:90.9,sd2:93.9,sd3:97.0},
};
const WHO_HAZ_GIRLS: Record<number, SDRow> = {
  0:{sd3neg:43.6,sd2neg:45.4,sd1neg:47.3,median:49.1,sd1:51.0,sd2:52.9,sd3:54.7},
  1:{sd3neg:47.8,sd2neg:49.8,sd1neg:51.7,median:53.7,sd1:55.6,sd2:57.6,sd3:59.5},
  2:{sd3neg:51.0,sd2neg:53.0,sd1neg:55.0,median:57.1,sd1:59.1,sd2:61.1,sd3:63.2},
  3:{sd3neg:53.5,sd2neg:55.6,sd1neg:57.7,median:59.8,sd1:61.9,sd2:64.0,sd3:66.1},
  4:{sd3neg:55.6,sd2neg:57.8,sd1neg:59.9,median:62.1,sd1:64.3,sd2:66.4,sd3:68.6},
  5:{sd3neg:57.4,sd2neg:59.6,sd1neg:61.8,median:64.0,sd1:66.2,sd2:68.5,sd3:70.7},
  6:{sd3neg:59.0,sd2neg:61.2,sd1neg:63.5,median:65.7,sd1:68.0,sd2:70.3,sd3:72.5},
  7:{sd3neg:60.3,sd2neg:62.7,sd1neg:65.0,median:67.3,sd1:69.6,sd2:72.0,sd3:74.3},
  8:{sd3neg:61.7,sd2neg:64.0,sd1neg:66.4,median:68.7,sd1:71.1,sd2:73.5,sd3:75.8},
  9:{sd3neg:62.9,sd2neg:65.3,sd1neg:67.7,median:70.1,sd1:72.6,sd2:75.0,sd3:77.4},
  10:{sd3neg:64.1,sd2neg:66.5,sd1neg:69.0,median:71.5,sd1:74.0,sd2:76.4,sd3:78.9},
  11:{sd3neg:65.2,sd2neg:67.7,sd1neg:70.3,median:72.8,sd1:75.3,sd2:77.8,sd3:80.3},
  12:{sd3neg:66.3,sd2neg:68.9,sd1neg:71.4,median:74.0,sd1:76.6,sd2:79.2,sd3:81.7},
  13:{sd3neg:67.3,sd2neg:70.0,sd1neg:72.6,median:75.2,sd1:77.8,sd2:80.5,sd3:83.1},
  14:{sd3neg:68.3,sd2neg:71.0,sd1neg:73.7,median:76.4,sd1:79.1,sd2:81.7,sd3:84.4},
  15:{sd3neg:69.3,sd2neg:72.0,sd1neg:74.8,median:77.5,sd1:80.2,sd2:83.0,sd3:85.7},
  16:{sd3neg:70.2,sd2neg:73.0,sd1neg:75.8,median:78.6,sd1:81.4,sd2:84.2,sd3:87.0},
  17:{sd3neg:71.1,sd2neg:74.0,sd1neg:76.8,median:79.7,sd1:82.5,sd2:85.4,sd3:88.2},
  18:{sd3neg:72.0,sd2neg:74.9,sd1neg:77.8,median:80.7,sd1:83.6,sd2:86.5,sd3:89.4},
  19:{sd3neg:72.8,sd2neg:75.8,sd1neg:78.8,median:81.7,sd1:84.7,sd2:87.6,sd3:90.6},
  20:{sd3neg:73.7,sd2neg:76.7,sd1neg:79.7,median:82.7,sd1:85.7,sd2:88.7,sd3:91.7},
  21:{sd3neg:74.5,sd2neg:77.5,sd1neg:80.6,median:83.7,sd1:86.7,sd2:89.8,sd3:92.9},
  22:{sd3neg:75.2,sd2neg:78.4,sd1neg:81.5,median:84.6,sd1:87.7,sd2:90.8,sd3:94.0},
  23:{sd3neg:76.0,sd2neg:79.2,sd1neg:82.3,median:85.5,sd1:88.7,sd2:91.9,sd3:95.0},
  24:{sd3neg:76.7,sd2neg:80.0,sd1neg:83.2,median:86.4,sd1:89.6,sd2:92.9,sd3:96.1},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
function getAgeMonths(dob: string, from: Date = new Date()) {
  const b = new Date(dob);
  return (from.getFullYear() - b.getFullYear()) * 12 + (from.getMonth() - b.getMonth());
}
function formatExactAge(dob: string, measureDateIso: string): string {
  const birth = new Date(dob);
  const mDate = new Date(measureDateIso);
  const totalDays = Math.floor((mDate.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  if (totalDays < 0) return 'before birth';
  const totalWeeks = Math.floor(totalDays / 7);
  if (totalWeeks < 4) return totalWeeks === 1 ? '1 week' : `${totalWeeks} weeks`;
  let months = (mDate.getFullYear() - birth.getFullYear()) * 12 + (mDate.getMonth() - birth.getMonth());
  const dayOfBirth = birth.getDate();
  const dayOfMeasure = mDate.getDate();
  if (dayOfMeasure < dayOfBirth) months -= 1;
  if (months < 0) months = 0;
  const monthsAgo = new Date(birth);
  monthsAgo.setMonth(monthsAgo.getMonth() + months);
  const remainingDays = Math.floor((mDate.getTime() - monthsAgo.getTime()) / (1000 * 60 * 60 * 24));
  const remainingWeeks = Math.floor(remainingDays / 7);
  if (months < 6) {
    const mPart = months === 1 ? '1 month' : `${months} months`;
    if (remainingWeeks === 0) return mPart;
    const wPart = remainingWeeks === 1 ? '1 week' : `${remainingWeeks} weeks`;
    return `${mPart} ${wPart}`;
  }
  return months === 1 ? '1 month' : `${months} months`;
}
function formatShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' });
}
function formatLong(d: Date) {
  return d.toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' });
}
function weightInterpretation(waz: number|null) {
  if (waz === null) return 'Not recorded';
  if (waz < -2) return 'Below normal';
  if (waz > 2)  return 'Above normal';
  return 'Normal';
}
function heightInterpretation(haz: number|null) {
  if (haz === null) return 'Not recorded';
  if (haz < -2) return 'Slightly short';
  return 'Normal for age';
}
function lerp(val:number,inMin:number,inMax:number,outMin:number,outMax:number){
  if(inMax===inMin) return (outMin+outMax)/2;
  return outMin+((val-inMin)/(inMax-inMin))*(outMax-outMin);
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── WHO Legend bar ───────────────────────────────────────────────────────────
function WHOLegendBar() {
  return (
    <View style={wl.wrap}>
      <Text style={wl.heading}>WHO Classification</Text>
      <View style={wl.row}>
        {(['SAM','MAM','NORMAL'] as WHOStatus[]).map(s => (
          <View key={s} style={[wl.item, { borderLeftColor: WHO[s].stripe }]}>
            <View style={[wl.dot, { backgroundColor: WHO[s].stripe }]} />
            <View>
              <Text style={[wl.code, { color: WHO[s].stripe }]}>{WHO[s].label}</Text>
              <Text style={wl.desc}>{s==='SAM'?'z < −3':s==='MAM'?'−3 to −2':'−2 to +2'}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── WHO Badge ────────────────────────────────────────────────────────────────
function WHOBadge({ status, size='sm' }: { status: WHOStatus; size?: 'sm'|'md' }) {
  const conf = WHO[status];
  const isMd = size === 'md';
  return (
    <View style={[wb.badge, { backgroundColor:conf.badge, paddingHorizontal:isMd?10:7, paddingVertical:isMd?4:2 }]}>
      <Text style={[wb.text, { color:conf.badgeTxt, fontSize:isMd?11:9 }]}>{conf.label}</Text>
    </View>
  );
}

// ─── Inline date picker ───────────────────────────────────────────────────────
function InlineDatePicker({ value, onChange }: { value:Date; onChange:(d:Date)=>void }) {
  const curYear = new Date().getFullYear();
  const years = Array.from({ length:6 }, (_,i) => curYear-i);
  const [sy, setSy] = useState(value.getFullYear());
  const [sm, setSm] = useState(value.getMonth());
  const [sd, setSd] = useState(value.getDate());
  const commit = (y:number, m:number, d:number) => {
    const safe = Math.min(d, new Date(y, m+1, 0).getDate());
    onChange(new Date(y, m, safe));
  };
  return (
    <View style={dp.wrap}>
      <Text style={dp.rowLabel}>Year</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={dp.row}>
          {years.map(y=>(
            <TouchableOpacity key={y} style={[dp.chip, sy===y&&dp.chipOn]} onPress={()=>{setSy(y);commit(y,sm,sd);}}>
              <Text style={[dp.chipTxt, sy===y&&dp.chipTxtOn]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <Text style={dp.rowLabel}>Month</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={dp.row}>
          {MONTHS.map((m,i)=>(
            <TouchableOpacity key={m} style={[dp.chip, sm===i&&dp.chipOn]} onPress={()=>{setSm(i);commit(sy,i,sd);}}>
              <Text style={[dp.chipTxt, sm===i&&dp.chipTxtOn]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <Text style={dp.rowLabel}>Day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={dp.row}>
          {Array.from({length:new Date(sy,sm+1,0).getDate()},(_,i)=>i+1).map(d=>(
            <TouchableOpacity key={d} style={[dp.chip, dp.dayChip, sd===d&&dp.chipOn]} onPress={()=>{setSd(d);commit(sy,sm,d);}}>
              <Text style={[dp.chipTxt, sd===d&&dp.chipTxtOn]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Z-score chip ─────────────────────────────────────────────────────────────
function ZChip({ label, value }: { label:string; value:number|null }) {
  const status = whoStatus(value);
  const conf   = WHO[status];
  return (
    <View style={[zc.chip, { backgroundColor:conf.bg, borderLeftColor:conf.stripe }]}>
      <View style={[zc.stripe, { backgroundColor:conf.stripe }]} />
      <Text style={zc.label}>{label}</Text>
      <Text style={[zc.value, { color:conf.stripe }]}>
        {value!==null ? (value>=0?`+${value.toFixed(1)}`:value.toFixed(1)) : '—'}
      </Text>
      <Text style={[zc.meaning, { color:conf.text }]}>{conf.label}</Text>
    </View>
  );
}

// ─── Interpretation pill ──────────────────────────────────────────────────────
function InterpPill({ label, style }: { label:string; style:'good'|'low'|'bad'|'muted' }) {
  const map = {
    good:  { bg:'#5DCAA5', color:'#04342C' },
    low:   { bg:C.amberMid, color:'#412402' },
    bad:   { bg:'#F09595', color:'#501313' },
    muted: { bg:'rgba(255,255,255,0.22)', color:'rgba(255,255,255,0.8)' },
  };
  const t = map[style];
  return (
    <View style={[ip.pill, { backgroundColor:t.bg }]}>
      <Text style={[ip.text, { color:t.color }]}>{label}</Text>
    </View>
  );
}

// ─── Status banner ────────────────────────────────────────────────────────────
function StatusBanner({ records }: { records:GrowthRecord[] }) {
  if (records.length === 0) return null;
  const latest  = records[0];
  const alerts  = getZScoreAlerts(latest.waz, latest.haz, latest.whz, latest.age_months);
  const overall = overallWHOStatus(latest.waz, latest.haz, latest.whz);
  const conf    = WHO[overall];

  if (alerts.length === 0 || overall === 'NORMAL' || overall === 'NO_DATA') {
    return (
      <View style={[sb.banner, { backgroundColor:WHO.NORMAL.bg, borderColor:WHO.NORMAL.stripe, borderLeftWidth:4 }]}>
        <View style={[sb.icon, { backgroundColor:WHO.NORMAL.stripe }]}>
          <Ionicons name="checkmark-circle-outline" size={18} color={C.white} />
        </View>
        <View style={{ flex:1 }}>
          <View style={sb.titleRow}>
            <Text style={[sb.title, { color:WHO.NORMAL.text }]}>All measurements normal</Text>
            <WHOBadge status="NORMAL" size="sm" />
          </View>
          <Text style={[sb.sub, { color:WHO.NORMAL.text, opacity:0.8 }]}>Keep tracking each month. Great job!</Text>
        </View>
      </View>
    );
  }

  const a = alerts[0];
  const titleText = `${a.indicator==='WAZ'?'Weight':a.indicator==='HAZ'?'Height':'Weight-for-height'} is ${a.classification.toLowerCase()}`;
  return (
    <View style={[sb.banner, { backgroundColor:conf.bg, borderColor:conf.stripe, borderLeftWidth:4 }]}>
      <View style={[sb.icon, { backgroundColor:conf.badge }]}>
        <Ionicons name={overall==='SAM'?'alert-circle-outline':'warning-outline'} size={18} color={C.white} />
      </View>
      <View style={{ flex:1 }}>
        <View style={sb.titleRow}>
          <Text style={[sb.title, { color:conf.text }]}>{titleText}</Text>
          <WHOBadge status={overall} size="sm" />
        </View>
        <Text style={[sb.sub, { color:conf.text, opacity:0.85 }]}>{a.action}</Text>
        {alerts.length > 1 && (
          <Text style={[sb.extraAlerts, { color:conf.text }]}>
            +{alerts.length-1} more concern{alerts.length-1>1?'s':''} — discuss with your nurse
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Growth Chart with proper WHO SD curves ───────────────────────────────────
const CH = 210;
const PAD = { top:20, right:46, bottom:38, left:38 };

function polyPts(points: {x:number;y:number}[]) {
  return points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function GrowthChart({
  records, type, sex,
}: {
  records: GrowthRecord[];
  type: 'waz' | 'haz';
  sex: 'male' | 'female';
}) {
  const [width, setWidth] = useState(320);
  const sorted = [...records].sort((a,b) => a.age_months - b.age_months);
  const isWeight = type === 'waz';
  const table = isWeight
    ? (sex === 'female' ? WHO_WAZ_GIRLS : WHO_WAZ_BOYS)
    : (sex === 'female' ? WHO_HAZ_GIRLS : WHO_HAZ_BOYS);

  const childAges = sorted.map(r => r.age_months);
  const maxChildAge = childAges.length ? Math.max(...childAges) : 0;
  const clampedMax = Math.min(Math.max(maxChildAge + 2, 12), 24);
  const ageRange = Array.from({ length: clampedMax + 1 }, (_, i) => i).filter(a => table[a]);

  if (sorted.length === 0) {
    return (
      <View style={[gc.emptyChart, { height:CH }]}>
        <Ionicons name="bar-chart-outline" size={28} color={C.grayBorder} />
        <Text style={gc.emptyChartText}>No data to chart yet</Text>
      </View>
    );
  }

  const allRefVals = ageRange.flatMap(a => [table[a].sd3neg, table[a].sd3]);
  const yMin = Math.min(...allRefVals) * 0.97;
  const yMax = Math.max(...allRefVals) * 1.02;

  const plotW = width - PAD.left - PAD.right;
  const plotH = CH - PAD.top - PAD.bottom;
  const ageMin = 0;
  const ageMax = clampedMax;

  const toX = (age:number) => lerp(age, ageMin, ageMax, 0, plotW);
  const toY = (val:number) => lerp(val, yMin, yMax, plotH, 0);

  const sdCurve = (key: keyof SDRow) =>
    ageRange.map(a => ({ x: PAD.left + toX(a), y: PAD.top + toY(table[a][key]) }));

  const sd3negPts  = sdCurve('sd3neg');
  const sd2negPts  = sdCurve('sd2neg');
  const medianPts  = sdCurve('median');
  const sd2Pts     = sdCurve('sd2');
  const sd3Pts     = sdCurve('sd3');

  const samBandPts = [
    { x: PAD.left + toX(ageMin), y: PAD.top + plotH },
    { x: PAD.left + toX(ageMax), y: PAD.top + plotH },
    ...[...sd3negPts].reverse(),
  ];
  const mamBandPts    = [...sd3negPts, ...[...sd2negPts].reverse()];
  const normalBandPts = [...sd2negPts, ...[...sd2Pts].reverse()];
  const highBandPts   = [...sd2Pts,    ...[...sd3Pts].reverse()];

  const childDots = sorted.map(r => {
    const val = isWeight ? r.weight_kg : r.height_cm;
    if (val == null) return null;
    const zVal = isWeight ? r.waz : r.haz;
    return { x: PAD.left + toX(r.age_months), y: PAD.top + toY(val), val, zVal, age: r.age_months };
  }).filter((d): d is NonNullable<typeof d> => d !== null);

  const yStep = isWeight ? (clampedMax <= 6 ? 1 : 2) : 10;
  const yStart = Math.ceil(yMin / yStep) * yStep;
  const yGridLines: number[] = [];
  for (let v = yStart; v <= yMax; v += yStep) yGridLines.push(v);

  const xTick = clampedMax <= 12 ? 2 : 3;
  const xLabels = ageRange.filter(a => a % xTick === 0);

  const accentColor = isWeight ? C.blue : C.teal;
  const isFemale    = sex === 'female';
  const unit        = isWeight ? 'kg' : 'cm';
  const lastAge     = ageRange[ageRange.length - 1];
  const labelX      = PAD.left + toX(lastAge) + 3;

  return (
    <View style={gc.chartCard} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <View style={gc.chartHeader}>
        <View style={[gc.chartDot, { backgroundColor:accentColor }]} />
        <View style={{ flex:1 }}>
          <Text style={gc.chartTitle}>{isWeight ? 'Weight-for-age' : 'Height-for-age'}</Text>
          <Text style={gc.chartSub}>WHO Growth Standard · {isFemale ? 'Girls' : 'Boys'} · {unit}</Text>
        </View>
        <View style={[gc.genderPill, { backgroundColor: isFemale ? '#FCE4EC' : C.blueLight }]}>
          <Ionicons name={isFemale ? 'female' : 'male'} size={10} color={isFemale ? '#880E4F' : C.blue} />
          <Text style={[gc.genderPillTxt, { color: isFemale ? '#880E4F' : C.blue }]}>
            {isFemale ? 'Girl' : 'Boy'}
          </Text>
        </View>
      </View>

      <View style={{ height:CH, overflow:'hidden' }}>
        <Svg width={width} height={CH}>
          {yGridLines.map(v => {
            const y = PAD.top + toY(v);
            return (
              <G key={v}>
                <Line x1={PAD.left} y1={y} x2={PAD.left+plotW} y2={y} stroke="#E5E7EB" strokeWidth={0.5} />
                <SvgText x={PAD.left-4} y={y+3.5} textAnchor="end" fontSize={8} fill="#9CA3AF" fontWeight="500">{v}</SvgText>
              </G>
            );
          })}
          {xLabels.map(a => (
            <SvgText key={a} x={PAD.left+toX(a)} y={PAD.top+plotH+14} textAnchor="middle" fontSize={8} fill="#9CA3AF" fontWeight="500">{a}m</SvgText>
          ))}
          <SvgText x={PAD.left+plotW/2} y={PAD.top+plotH+26} textAnchor="middle" fontSize={8} fill="#9CA3AF">Age (months)</SvgText>

          <Polygon points={polyPts(samBandPts)}    fill="rgba(192,57,43,0.09)"  />
          <Polygon points={polyPts(mamBandPts)}    fill="rgba(217,119,6,0.11)"  />
          <Polygon points={polyPts(normalBandPts)} fill="rgba(5,150,105,0.08)"  />
          <Polygon points={polyPts(highBandPts)}   fill="rgba(217,119,6,0.07)"  />

          <Polyline points={polyPts(sd3negPts)} fill="none" stroke={WHO.SAM.stripe}    strokeWidth={1.3} strokeDasharray="4 3" />
          <Polyline points={polyPts(sd2negPts)} fill="none" stroke={WHO.MAM.stripe}    strokeWidth={1.3} strokeDasharray="4 3" />
          <Polyline points={polyPts(medianPts)} fill="none" stroke={WHO.NORMAL.stripe} strokeWidth={1.8} />
          <Polyline points={polyPts(sd2Pts)}    fill="none" stroke={WHO.MAM.stripe}    strokeWidth={1.3} strokeDasharray="4 3" />
          <Polyline points={polyPts(sd3Pts)}    fill="none" stroke={WHO.SAM.stripe}    strokeWidth={1.3} strokeDasharray="4 3" />

          {([
            { key:'sd3neg' as keyof SDRow, label:'-3', color:WHO.SAM.stripe },
            { key:'sd2neg' as keyof SDRow, label:'-2', color:WHO.MAM.stripe },
            { key:'median' as keyof SDRow, label: '0', color:WHO.NORMAL.stripe },
            { key:'sd2'    as keyof SDRow, label:'+2', color:WHO.MAM.stripe },
            { key:'sd3'    as keyof SDRow, label:'+3', color:WHO.SAM.stripe },
          ]).map(({ key, label, color }) => (
            <SvgText key={key} x={labelX} y={PAD.top + toY(table[lastAge][key]) + 3.5}
              fontSize={8} fill={color} fontWeight="bold">{label}</SvgText>
          ))}

          {childDots.length > 1 && (
            <Polyline points={polyPts(childDots)} fill="none" stroke={accentColor}
              strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {childDots.map((d, i) => {
            const status = whoStatus(d.zVal ?? null);
            const dotColor = WHO[status].stripe;
            const isLast = i === childDots.length - 1;
            const r = isLast ? 5.5 : 4;
            return (
              <G key={i}>
                <Circle cx={d.x} cy={d.y} r={r+2} fill="white" />
                <Circle cx={d.x} cy={d.y} r={r} fill={dotColor} stroke="white" strokeWidth={isLast ? 2 : 1.5} />
                {isLast && (
                  <SvgText x={d.x} y={d.y - r - 5} textAnchor="middle" fontSize={9} fill={dotColor} fontWeight="bold">
                    {d.val}{unit}
                  </SvgText>
                )}
              </G>
            );
          })}

          <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top+plotH} stroke="#D1D5DB" strokeWidth={0.5} />
          <Line x1={PAD.left} y1={PAD.top+plotH} x2={PAD.left+plotW} y2={PAD.top+plotH} stroke="#D1D5DB" strokeWidth={0.5} />
        </Svg>
      </View>

      <View style={gc.legend}>
        <View style={gc.legendItem}>
          <View style={[gc.legendSwatch, { backgroundColor:'rgba(5,150,105,0.15)', borderColor:WHO.NORMAL.stripe }]} />
          <Text style={gc.legendLabel}>Normal (−2 to +2)</Text>
        </View>
        <View style={gc.legendItem}>
          <View style={[gc.legendSwatch, { backgroundColor:'rgba(217,119,6,0.15)', borderColor:WHO.MAM.stripe }]} />
          <Text style={gc.legendLabel}>MAM (−3 to −2)</Text>
        </View>
        <View style={gc.legendItem}>
          <View style={[gc.legendSwatch, { backgroundColor:'rgba(192,57,43,0.15)', borderColor:WHO.SAM.stripe }]} />
          <Text style={gc.legendLabel}>SAM (&lt; −3)</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Record card ──────────────────────────────────────────────────────────────
function RecordCard({ rec, isLatest, isEditing, onEdit, dob }: {
  rec:GrowthRecord; isLatest:boolean; isEditing:boolean; onEdit:(r:GrowthRecord)=>void; dob:string;
}) {
  const overall = overallWHOStatus(rec.waz, rec.haz, rec.whz);
  const conf    = WHO[overall];
  const exactAge = formatExactAge(dob, rec.date);
  return (
    <TouchableOpacity style={[rc.card, { borderLeftColor:conf.stripe, borderLeftWidth:4 }]}
      onPress={()=>onEdit(rec)} activeOpacity={0.75}>
      <View style={rc.topRow}>
        <View style={[rc.agePill, isLatest&&{ backgroundColor:C.blue }]}>
          {isLatest && <Ionicons name="star" size={10} color={C.white} style={{ marginRight:3 }} />}
          <Text style={[rc.agePillText, isLatest&&{ color:C.white }]}>
            {isLatest ? 'Latest · ' : ''}{exactAge}
          </Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <WHOBadge status={overall} size="sm" />
          <View style={rc.dateRow}>
            <Ionicons name="calendar-outline" size={11} color={C.grayMuted} />
            <Text style={rc.dateText}>{formatShort(rec.date)}</Text>
          </View>
        </View>
      </View>
      <View style={rc.measures}>
        <View style={rc.measureBlock}>
          <View style={[rc.measureIcon, { backgroundColor:C.blueLight }]}>
            <Ionicons name="scale-outline" size={15} color={C.blue} />
          </View>
          <View>
            <Text style={rc.measureVal}>{rec.weight_kg} kg</Text>
            <Text style={rc.measureLbl}>Weight</Text>
          </View>
        </View>
        {rec.height_cm != null && (
          <>
            <View style={rc.measureDivider} />
            <View style={rc.measureBlock}>
              <View style={[rc.measureIcon, { backgroundColor:C.tealLight }]}>
                <Ionicons name="resize-outline" size={15} color={C.teal} />
              </View>
              <View>
                <Text style={rc.measureVal}>{rec.height_cm} cm</Text>
                <Text style={rc.measureLbl}>Height</Text>
              </View>
            </View>
          </>
        )}
        <View style={{ flex:1 }} />
        <View style={rc.editHint}>
          <Ionicons name="create-outline" size={12} color={C.grayMuted} />
        </View>
      </View>
      <View style={rc.zRow}>
        <ZChip label="WAZ" value={rec.waz} />
        <ZChip label="HAZ" value={rec.haz} />
        <ZChip label="WHZ" value={rec.whz} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Form fields ──────────────────────────────────────────────────────────────
function FormFields({
  ageMonths, weight, height, measureDate, showPicker, loading,
  onWeightChange, onHeightChange, onDateToggle, onDateChange, onSubmit,
  submitLabel, submitColor,
}: {
  ageMonths:number; weight:string; height:string; measureDate:Date;
  showPicker:boolean; loading:boolean;
  onWeightChange:(v:string)=>void; onHeightChange:(v:string)=>void;
  onDateToggle:()=>void; onDateChange:(d:Date)=>void;
  onSubmit:()=>void; submitLabel:string; submitColor:string;
}) {
  const t = useT();
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  const isToday = measureDate.toDateString() === today.toDateString();
  const isYest  = measureDate.toDateString() === yesterday.toDateString();
  return (
    <View style={ff.container}>
      <Text style={ff.label}>Measurement date</Text>
      <View style={ff.quickRow}>
        <TouchableOpacity style={[ff.quickBtn, isToday&&ff.quickBtnOn]} onPress={()=>onDateChange(new Date())}>
          <Text style={[ff.quickBtnText, isToday&&ff.quickBtnTextOn]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ff.quickBtn, isYest&&ff.quickBtnOn]} onPress={()=>onDateChange(yesterday)}>
          <Text style={[ff.quickBtnText, isYest&&ff.quickBtnTextOn]}>Yesterday</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ff.quickBtn, !isToday&&!isYest&&ff.quickBtnOn]} onPress={onDateToggle}>
          <Ionicons name="calendar-outline" size={14} color={!isToday&&!isYest?C.white:C.blue} />
          <Text style={[ff.quickBtnText, !isToday&&!isYest&&ff.quickBtnTextOn]}>
            {!isToday&&!isYest ? formatLong(measureDate) : 'Pick date'}
          </Text>
        </TouchableOpacity>
      </View>
      {showPicker && <InlineDatePicker value={measureDate} onChange={onDateChange} />}
      <Text style={ff.label}>{t('age_months')}</Text>
      <View style={ff.readonlyRow}>
        <Ionicons name="lock-closed-outline" size={13} color={C.grayMuted} />
        <Text style={ff.readonlyText}>
          {ageMonths>=0 ? `${ageMonths} months — auto-calculated` : 'Invalid date (before birth)'}
        </Text>
      </View>
      <Text style={ff.label}>{t('weight_kg')} *</Text>
      <View style={ff.inputWrap}>
        <View style={[ff.inputIcon, { backgroundColor:C.blueLight }]}>
          <Ionicons name="scale-outline" size={15} color={C.blue} />
        </View>
        <TextInput style={ff.input} value={weight} onChangeText={onWeightChange}
          placeholder="e.g. 9.8" placeholderTextColor={C.grayMuted} keyboardType="decimal-pad" />
        <Text style={ff.inputUnit}>kg</Text>
      </View>
      <Text style={ff.label}>{t('height_cm')} (optional)</Text>
      <View style={ff.inputWrap}>
        <View style={[ff.inputIcon, { backgroundColor:C.tealLight }]}>
          <Ionicons name="resize-outline" size={15} color={C.teal} />
        </View>
        <TextInput style={ff.input} value={height} onChangeText={onHeightChange}
          placeholder="e.g. 76" placeholderTextColor={C.grayMuted} keyboardType="decimal-pad" />
        <Text style={ff.inputUnit}>cm</Text>
      </View>
      <TouchableOpacity style={[ff.submitBtn, { backgroundColor:submitColor }, loading&&{ opacity:0.7 }]}
        onPress={onSubmit} disabled={loading} activeOpacity={0.85}>
        {loading
          ? <ActivityIndicator color={C.white} size="small" />
          : <Ionicons name="checkmark-circle-outline" size={18} color={C.white} />}
        <Text style={ff.submitText}>{loading ? 'Calculating…' : submitLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function EditModal({
  visible, rec, dob, ageMonths, weight, height, measureDate, showPicker, loading,
  onWeightChange, onHeightChange, onDateToggle, onDateChange,
  onSubmit, onCancel, onDelete,
}: {
  visible:boolean; rec:GrowthRecord|null; dob:string; ageMonths:number;
  weight:string; height:string; measureDate:Date; showPicker:boolean; loading:boolean;
  onWeightChange:(v:string)=>void; onHeightChange:(v:string)=>void;
  onDateToggle:()=>void; onDateChange:(d:Date)=>void;
  onSubmit:()=>void; onCancel:()=>void; onDelete:()=>void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={em.overlay}>
          <TouchableOpacity style={em.backdrop} onPress={onCancel} activeOpacity={1} />
          <View style={em.sheet}>
            <View style={em.handle} />
            <View style={em.sheetHeader}>
              <View style={[em.sheetHeaderIcon, { backgroundColor:C.blueLight }]}>
                <Ionicons name="create-outline" size={18} color={C.blue} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={em.sheetTitle}>Edit measurement</Text>
                {rec && <Text style={em.sheetSub}>Recorded at {formatExactAge(dob, rec.date)} old</Text>}
              </View>
              <TouchableOpacity onPress={onCancel} style={em.closeBtn}>
                <Ionicons name="close" size={20} color={C.grayMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom:32 }}>
              <FormFields ageMonths={ageMonths} weight={weight} height={height}
                measureDate={measureDate} showPicker={showPicker} loading={loading}
                onWeightChange={onWeightChange} onHeightChange={onHeightChange}
                onDateToggle={onDateToggle} onDateChange={onDateChange}
                onSubmit={onSubmit} submitLabel="Save changes" submitColor={C.teal} />
              <TouchableOpacity style={em.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={16} color={C.red} />
                <Text style={em.deleteBtnText}>Delete this record</Text>
              </TouchableOpacity>
              <TouchableOpacity style={em.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
                <Text style={em.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function GrowthScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    children, selectedChildId, growthRecords,
    fetchGrowthRecords, addGrowthRecord, updateGrowthRecord,
  } = useChildStore();

  const activeChild = children.find(c => c.id === selectedChildId) ?? children[0];

  const [showForm, setShowForm]       = useState(false);
  const [weight, setWeight]           = useState('');
  const [height, setHeight]           = useState('');
  const [measureDate, setMeasureDate] = useState(new Date());
  const [showPicker, setShowPicker]   = useState(false);
  const [loading, setLoading]         = useState(false);

  const [editRecord, setEditRecord]         = useState<GrowthRecord|null>(null);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [editWeight, setEditWeight]         = useState('');
  const [editHeight, setEditHeight]         = useState('');
  const [editDate, setEditDate]             = useState(new Date());
  const [editShowPicker, setEditShowPicker] = useState(false);
  const [editLoading, setEditLoading]       = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const ageMonths     = activeChild ? getAgeMonths(activeChild.date_of_birth, measureDate) : 0;
  const editAgeMonths = activeChild && editRecord ? getAgeMonths(activeChild.date_of_birth, editDate) : 0;

  useEffect(() => {
    if (activeChild?.id) fetchGrowthRecords(activeChild.id);
  }, [activeChild?.id]);

  const openEdit = (rec: GrowthRecord) => {
    setEditRecord(rec);
    setEditWeight(String(rec.weight_kg));
    setEditHeight(rec.height_cm ? String(rec.height_cm) : '');
    setEditDate(new Date(rec.date));
    setEditShowPicker(false);
    setShowEditModal(true);
  };

  const cancelEdit = () => {
    setEditRecord(null); setEditWeight(''); setEditHeight('');
    setEditDate(new Date()); setEditShowPicker(false); setShowEditModal(false);
  };

  const handleDelete = () => {
    if (!editRecord) return;
    Alert.alert('Delete record',
      `Delete the measurement at ${formatExactAge(activeChild?.date_of_birth??'', editRecord.date)} old? This cannot be undone.`,
      [
        { text:'Cancel', style:'cancel' },
        { text:'Delete', style:'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('growth_records').delete().eq('id', editRecord.id);
            if (error) throw error;
            useChildStore.setState(state => ({
              growthRecords: state.growthRecords.filter(r => r.id !== editRecord.id),
            }));
            cancelEdit();
          } catch { Alert.alert('Error', 'Could not delete record. Try again.'); }
        }},
      ]
    );
  };

  const handleAddSubmit = async () => {
    if (!activeChild) return;
    if (!weight) { Alert.alert('Missing weight','Please enter a weight to continue.'); return; }
    const w = parseFloat(weight);
    const h = height ? parseFloat(height) : null;
    if (isNaN(w)) { Alert.alert('Invalid number','Please enter a valid weight, e.g. 9.8'); return; }
    if (ageMonths < 0) { Alert.alert('Invalid date','Measurement date is before birth date.'); return; }
    setLoading(true);
    try {
      const zscores = await calculateZScores(w, h, ageMonths, activeChild.sex);
      await addGrowthRecord({
        child_id:activeChild.id, weight_kg:w, height_cm:h,
        age_months:ageMonths, waz:zscores.waz, haz:zscores.haz, whz:zscores.whz,
        date:measureDate.toISOString().split('T')[0],
      });
      setShowForm(false); setShowPicker(false); setWeight(''); setHeight(''); setMeasureDate(new Date());
      Alert.alert('Saved','Measurement added successfully.');
    } catch { Alert.alert('Error','Could not save measurement. Try again.'); }
    finally { setLoading(false); }
  };

  const handleEditSubmit = async () => {
    if (!activeChild || !editRecord) return;
    if (!editWeight) { Alert.alert('Missing weight','Please enter a weight.'); return; }
    const w = parseFloat(editWeight);
    const h = editHeight ? parseFloat(editHeight) : null;
    if (isNaN(w)) { Alert.alert('Invalid number','Please enter a valid weight.'); return; }
    if (editAgeMonths < 0) { Alert.alert('Invalid date','Measurement date is before birth date.'); return; }
    setEditLoading(true);
    try {
      const zscores = await calculateZScores(w, h, editAgeMonths, activeChild.sex);
      await updateGrowthRecord(editRecord.id, {
        child_id:activeChild.id, weight_kg:w, height_cm:h,
        age_months:editAgeMonths, waz:zscores.waz, haz:zscores.haz, whz:zscores.whz,
        date:editDate.toISOString().split('T')[0],
      });
      cancelEdit();
      Alert.alert('Saved','Measurement updated.');
    } catch { Alert.alert('Error','Could not update measurement. Try again.'); }
    finally { setEditLoading(false); }
  };

  const latest      = growthRecords[0] ?? null;
  const isFemale    = activeChild?.sex === 'female';
  const fabBottom   = insets.bottom + 49 + 16;
  const totalMonths = activeChild ? getAgeMonths(activeChild.date_of_birth, new Date()) : 0;
  const childSex    = activeChild?.sex === 'female' ? 'female' : 'male';

  const wInterp: 'good'|'low'|'bad'|'muted' = !latest ? 'muted'
    : latest.waz!==null && latest.waz < -2 ? (latest.waz < -3 ? 'bad' : 'low') : 'good';
  const hInterp: 'good'|'low'|'bad'|'muted' = !latest || latest.height_cm==null ? 'muted'
    : latest.haz!==null && latest.haz < -2 ? (latest.haz < -3 ? 'bad' : 'low') : 'good';

  const hasChartData  = growthRecords.length >= 2;
  const latestOverall = latest ? overallWHOStatus(latest.waz, latest.haz, latest.whz) : 'NO_DATA';
  const latestConf    = WHO[latestOverall];

  if (!activeChild) {
    return (
      <View style={s.screen}>
        <View style={[s.hero, { paddingTop:insets.top+12 }]}>
          <View style={s.heroTop}>
            <TouchableOpacity style={s.backBtn} onPress={()=>router.back()}>
              <Ionicons name="arrow-back" size={18} color={C.white} />
            </TouchableOpacity>
            <View style={s.heroTitleBlock}>
              <Text style={s.heroScreenLabel}>Growth tracker</Text>
              <Text style={s.heroScreenTitle}>No child selected</Text>
            </View>
          </View>
        </View>
        <View style={s.emptyWrap}>
          <View style={s.emptyIconCircle}>
            <Ionicons name="people-outline" size={48} color={C.blue} />
          </View>
          <Text style={s.emptyTitle}>No child selected</Text>
          <Text style={s.emptySub}>Go to Children to add or select a child first.</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={()=>router.push('/(tabs)/children')}>
            <Ionicons name="people" size={16} color={C.white} />
            <Text style={s.emptyBtnText}>Go to Children</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={[s.hero, { paddingTop:insets.top+12 }]}>
        <View style={s.heroTop}>
          <TouchableOpacity style={s.backBtn} onPress={()=>router.back()}>
            <Ionicons name="arrow-back" size={18} color={C.white} />
          </TouchableOpacity>
          <View style={s.heroTitleBlock}>
            <Text style={s.heroScreenLabel}>Growth tracker</Text>
            <Text style={s.heroScreenTitle}>{toTitleCase(activeChild.full_name.split(' ')[0])}'s growth</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={()=>{ setShowForm(f=>!f); setShowPicker(false); }}>
            <Ionicons name={showForm?'close':'add'} size={22} color={C.white} />
          </TouchableOpacity>
        </View>

        <View style={s.childPill}>
          <View style={[s.childAvatar, { backgroundColor:isFemale?'#FCE4EC':C.blueLight }]}>
            <Text style={[s.childAvatarText, { color:isFemale?'#880E4F':C.blue }]}>
              {(activeChild.full_name[0]??'?').toUpperCase()}
            </Text>
            <View style={[s.genderDot, { backgroundColor:isFemale?'#E91E63':C.blue }]}>
              <Ionicons name={isFemale?'female':'male'} size={8} color={C.white} />
            </View>
          </View>
          <View style={s.childInfo}>
            <Text style={s.childName}>{toTitleCase(activeChild.full_name)}</Text>
            <View style={s.ageBadge}>
              <Ionicons name="time-outline" size={11} color={C.blue} />
              <Text style={s.ageBadgeText}>{totalMonths} months old</Text>
            </View>
          </View>
          <View style={{ alignItems:'flex-end', gap:4 }}>
            {latest && <WHOBadge status={latestOverall} size="md" />}
            <View style={s.recordsBadge}>
              <Text style={s.recordsBadgeText}>
                {growthRecords.length} record{growthRecords.length!==1?'s':''}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.statsStrip}>
          <View style={s.statTile}>
            <Text style={s.statTileLabel}>Weight</Text>
            <Text style={s.statTileValue}>
              {latest ? `${latest.weight_kg}` : '—'}
              <Text style={s.statTileUnit}>{latest?' kg':''}</Text>
            </Text>
            <InterpPill label={latest?weightInterpretation(latest.waz):'Not recorded'} style={wInterp} />
          </View>
          <View style={s.statTile}>
            <Text style={s.statTileLabel}>Height</Text>
            <Text style={s.statTileValue}>
              {latest?.height_cm ? `${latest.height_cm}` : '—'}
              <Text style={s.statTileUnit}>{latest?.height_cm?' cm':''}</Text>
            </Text>
            <InterpPill label={latest?.height_cm?heightInterpretation(latest.haz):'Not recorded'} style={hInterp} />
          </View>
          <View style={s.statTile}>
            <Text style={s.statTileLabel}>Last check</Text>
            <Text style={[s.statTileValue, { fontSize:13, marginTop:3 }]}>
              {latest ? new Date(latest.date).toLocaleDateString('en-KE',{ day:'numeric', month:'short' }) : '—'}
            </Text>
            <InterpPill label={latest?new Date(latest.date).getFullYear().toString():'None yet'} style="muted" />
          </View>
        </View>

        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
            {children.map(c => {
              const active = c.id === activeChild.id;
              return (
                <TouchableOpacity key={c.id} style={[s.pill, active&&s.pillActive]}
                  onPress={()=>useChildStore.getState().selectChild(c.id)}>
                  <Ionicons name={c.sex==='female'?'female':'male'} size={12}
                    color={active?C.white:'rgba(255,255,255,0.7)'} />
                  <Text style={[s.pillText, active&&s.pillTextActive]}>{c.full_name.split(' ')[0]}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView ref={scrollRef} style={{ flex:1 }}
        contentContainerStyle={[s.body, { paddingBottom:fabBottom+80 }]}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <StatusBanner records={growthRecords} />
        <WHOLegendBar />

        {showForm && (
          <View style={s.formCard}>
            <View style={s.formCardHeader}>
              <View style={[s.formCardIcon, { backgroundColor:C.blueLight }]}>
                <Ionicons name="add-circle-outline" size={17} color={C.blue} />
              </View>
              <Text style={s.formCardTitle}>Add measurement</Text>
            </View>
            <FormFields ageMonths={ageMonths} weight={weight} height={height}
              measureDate={measureDate} showPicker={showPicker} loading={loading}
              onWeightChange={setWeight} onHeightChange={setHeight}
              onDateToggle={()=>setShowPicker(p=>!p)} onDateChange={d=>setMeasureDate(d)}
              onSubmit={handleAddSubmit} submitLabel="Calculate & save" submitColor={C.blue} />
          </View>
        )}

        {latest && (
          <>
            <Text style={s.sectionLabel}>
              Latest measurement · {formatExactAge(activeChild.date_of_birth, latest.date)} old
            </Text>
            <View style={[s.dataCard, { borderLeftColor:latestConf.stripe, borderLeftWidth:4 }]}>
              <View style={[s.whoClassRow, { backgroundColor:latestConf.bg }]}>
                <View style={[s.whoClassDot, { backgroundColor:latestConf.stripe }]} />
                <Text style={[s.whoClassText, { color:latestConf.text }]}>Overall: {latestConf.fullLabel}</Text>
                <WHOBadge status={latestOverall} size="md" />
              </View>
              <View style={s.measureRow}>
                <View style={s.measureBlock}>
                  <Text style={s.measureRawLabel}>Weight</Text>
                  <Text style={s.measureRawValue}>
                    {latest.weight_kg}<Text style={s.measureRawUnit}> kg</Text>
                  </Text>
                  <View style={[s.measureInterp, {
                    backgroundColor:WHO[whoStatus(latest.waz)].bg, borderLeftWidth:3,
                    borderLeftColor:WHO[whoStatus(latest.waz)].stripe,
                  }]}>
                    <Text style={[s.measureInterpText, { color:WHO[whoStatus(latest.waz)].text }]}>
                      {WHO[whoStatus(latest.waz)].label}
                    </Text>
                  </View>
                </View>
                {latest.height_cm != null && (
                  <View style={[s.measureBlock, s.measureBlockBorder]}>
                    <Text style={s.measureRawLabel}>Height</Text>
                    <Text style={s.measureRawValue}>
                      {latest.height_cm}<Text style={s.measureRawUnit}> cm</Text>
                    </Text>
                    <View style={[s.measureInterp, {
                      backgroundColor:WHO[whoStatus(latest.haz)].bg, borderLeftWidth:3,
                      borderLeftColor:WHO[whoStatus(latest.haz)].stripe,
                    }]}>
                      <Text style={[s.measureInterpText, { color:WHO[whoStatus(latest.haz)].text }]}>
                        {WHO[whoStatus(latest.haz)].label}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              <View style={s.zscoreGrid}>
                <ZChip label="Weight / age" value={latest.waz} />
                <ZChip label="Height / age" value={latest.haz} />
                <ZChip label="Wt / height"  value={latest.whz} />
              </View>
              <View style={s.legendLine}>
                <Ionicons name="shield-checkmark-outline" size={11} color={C.teal} />
                <Text style={s.legendText}>
                  WHO standard · SAM = z&lt;−3 · MAM = −3 to −2 · Normal = −2 to +2
                </Text>
              </View>
            </View>
          </>
        )}

        {hasChartData && (
          <>
            <Text style={s.sectionLabel}>Growth charts</Text>
            <GrowthChart records={growthRecords} type="waz" sex={childSex} />
            {growthRecords.some(r => r.haz!==null && r.height_cm!=null) && (
              <GrowthChart records={growthRecords} type="haz" sex={childSex} />
            )}
          </>
        )}

        {growthRecords.length === 1 && (
          <View style={s.chartNudge}>
            <Ionicons name="analytics-outline" size={16} color={C.blue} />
            <Text style={s.chartNudgeText}>Add one more measurement to unlock growth charts</Text>
          </View>
        )}

        {growthRecords.length > 0 && (
          <View style={s.editHintBanner}>
            <Ionicons name="pencil-outline" size={14} color={C.blue} />
            <Text style={s.editHintText}>Tap any record to edit or delete</Text>
          </View>
        )}

        <Text style={s.sectionLabel}>
          {growthRecords.length>0 ? `All records (${growthRecords.length})` : 'Records'}
        </Text>

        {growthRecords.length === 0 ? (
          <View style={s.emptyRecords}>
            <View style={s.emptyRecordsIcon}>
              <Ionicons name="bar-chart-outline" size={44} color={C.blue} />
            </View>
            <Text style={s.emptyRecordsTitle}>No measurements yet</Text>
            <Text style={s.emptyRecordsSub}>Tap the + button to add your child's first measurement.</Text>
            <TouchableOpacity style={s.emptyRecordsBtn} onPress={()=>setShowForm(true)}>
              <Ionicons name="add-circle-outline" size={16} color={C.white} />
              <Text style={s.emptyRecordsBtnText}>Add first measurement</Text>
            </TouchableOpacity>
          </View>
        ) : (
          growthRecords.map((rec, i) => (
            <RecordCard key={rec.id} rec={rec} isLatest={i===0}
              isEditing={editRecord?.id===rec.id && showEditModal}
              onEdit={openEdit} dob={activeChild.date_of_birth} />
          ))
        )}
      </ScrollView>

      <EditModal visible={showEditModal} rec={editRecord}
        dob={activeChild.date_of_birth} ageMonths={editAgeMonths}
        weight={editWeight} height={editHeight}
        measureDate={editDate} showPicker={editShowPicker} loading={editLoading}
        onWeightChange={setEditWeight} onHeightChange={setEditHeight}
        onDateToggle={()=>setEditShowPicker(p=>!p)} onDateChange={d=>setEditDate(d)}
        onSubmit={handleEditSubmit} onCancel={cancelEdit} onDelete={handleDelete} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:{ flex:1, backgroundColor:C.gray },
  hero:{ backgroundColor:C.blue, paddingHorizontal:16, paddingBottom:0, borderBottomLeftRadius:28, borderBottomRightRadius:28 },
  heroTop:{ flexDirection:'row', alignItems:'center', marginBottom:14, gap:10 },
  backBtn:{ width:34, height:34, borderRadius:17, backgroundColor:'rgba(255,255,255,0.12)', borderWidth:0.5, borderColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' },
  heroTitleBlock:{ flex:1 },
  heroScreenLabel:{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'500', letterSpacing:0.5, textTransform:'uppercase' },
  heroScreenTitle:{ fontSize:20, fontWeight:'700', color:C.white, marginTop:1 },
  addBtn:{ width:34, height:34, borderRadius:17, backgroundColor:'rgba(255,255,255,0.18)', borderWidth:0.5, borderColor:'rgba(255,255,255,0.3)', alignItems:'center', justifyContent:'center' },
  childPill:{ backgroundColor:C.white, borderRadius:18, padding:12, flexDirection:'row', alignItems:'center', gap:12, marginBottom:14 },
  childAvatar:{ width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center', position:'relative' },
  childAvatarText:{ fontSize:18, fontWeight:'700' },
  genderDot:{ position:'absolute', bottom:0, right:0, width:16, height:16, borderRadius:8, alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:C.white },
  childInfo:{ flex:1 },
  childName:{ fontSize:14, fontWeight:'700', color:C.text },
  ageBadge:{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:C.blueLight, alignSelf:'flex-start', paddingHorizontal:8, paddingVertical:3, borderRadius:20, marginTop:4 },
  ageBadgeText:{ fontSize:11, fontWeight:'600', color:C.blue },
  recordsBadge:{ backgroundColor:'rgba(255,255,255,0.2)', borderWidth:0.5, borderColor:'rgba(255,255,255,0.3)', borderRadius:99, paddingHorizontal:10, paddingVertical:3 },
  recordsBadgeText:{ fontSize:11, fontWeight:'600', color:C.white },
  statsStrip:{ flexDirection:'row', gap:8, paddingBottom:16 },
  statTile:{ flex:1, backgroundColor:'rgba(255,255,255,0.13)', borderRadius:12, padding:9, borderWidth:0.5, borderColor:'rgba(255,255,255,0.18)' },
  statTileLabel:{ fontSize:9, color:'rgba(255,255,255,0.6)', fontWeight:'500', letterSpacing:0.5, textTransform:'uppercase' },
  statTileValue:{ fontSize:16, fontWeight:'700', color:C.white, marginTop:2, marginBottom:3 },
  statTileUnit:{ fontSize:10, color:'rgba(255,255,255,0.6)', fontWeight:'400' },
  pillsRow:{ flexDirection:'row', gap:8, paddingBottom:14 },
  pill:{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:6, borderRadius:20, backgroundColor:'rgba(255,255,255,0.15)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)' },
  pillActive:{ backgroundColor:'rgba(255,255,255,0.3)', borderColor:C.white },
  pillText:{ fontSize:12, fontWeight:'600', color:'rgba(255,255,255,0.75)' },
  pillTextActive:{ color:C.white },
  body:{ paddingHorizontal:14, paddingTop:14, gap:10 },
  sectionLabel:{ fontSize:11, fontWeight:'600', color:C.grayDark, letterSpacing:0.5, textTransform:'uppercase', marginLeft:2, marginBottom:6, marginTop:4 },
  formCard:{ backgroundColor:C.white, borderRadius:16, borderWidth:1.5, borderStyle:'dashed', borderColor:C.blue, padding:16, marginBottom:2 },
  formCardHeader:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 },
  formCardIcon:{ width:30, height:30, borderRadius:8, alignItems:'center', justifyContent:'center' },
  formCardTitle:{ fontSize:14, fontWeight:'700', color:C.text },
  dataCard:{ backgroundColor:C.white, borderRadius:16, borderWidth:0.5, borderColor:C.grayBorder, padding:14, overflow:'hidden' },
  whoClassRow:{ flexDirection:'row', alignItems:'center', gap:8, borderRadius:10, paddingHorizontal:10, paddingVertical:8, marginBottom:12 },
  whoClassDot:{ width:8, height:8, borderRadius:4 },
  whoClassText:{ flex:1, fontSize:12, fontWeight:'600' },
  measureRow:{ flexDirection:'row', borderWidth:0.5, borderColor:C.grayBorder, borderRadius:12, overflow:'hidden', marginBottom:10 },
  measureBlock:{ flex:1, padding:11 },
  measureBlockBorder:{ borderLeftWidth:0.5, borderLeftColor:C.grayBorder },
  measureRawLabel:{ fontSize:10, color:C.grayMuted, fontWeight:'500' },
  measureRawValue:{ fontSize:22, fontWeight:'700', color:C.text, marginTop:2, marginBottom:2 },
  measureRawUnit:{ fontSize:12, color:C.grayMuted, fontWeight:'400' },
  measureInterp:{ borderRadius:6, paddingHorizontal:8, paddingVertical:3, alignSelf:'flex-start', marginTop:4 },
  measureInterpText:{ fontSize:11, fontWeight:'700' },
  zscoreGrid:{ flexDirection:'row', gap:6, marginBottom:10 },
  legendLine:{ flexDirection:'row', alignItems:'flex-start', gap:5, paddingTop:8, borderTopWidth:0.5, borderTopColor:C.grayBorder },
  legendText:{ fontSize:10, color:C.grayMuted, lineHeight:15, flex:1 },
  chartNudge:{ flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.blueLight, borderRadius:10, paddingHorizontal:12, paddingVertical:10, borderWidth:0.5, borderColor:'#B5D4F4' },
  chartNudgeText:{ fontSize:12, color:C.blueDark, fontWeight:'500', flex:1 },
  editHintBanner:{ flexDirection:'row', alignItems:'center', gap:6, backgroundColor:C.blueLight, borderRadius:10, paddingHorizontal:12, paddingVertical:7 },
  editHintText:{ fontSize:12, color:C.blueDark, fontWeight:'500' },
  emptyWrap:{ flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  emptyIconCircle:{ width:88, height:88, borderRadius:44, backgroundColor:C.blueLight, alignItems:'center', justifyContent:'center', marginBottom:16 },
  emptyTitle:{ fontSize:20, fontWeight:'700', color:C.text, marginBottom:8 },
  emptySub:{ fontSize:13, color:C.grayMuted, textAlign:'center', lineHeight:20, marginBottom:24 },
  emptyBtn:{ backgroundColor:C.blue, borderRadius:99, paddingHorizontal:22, paddingVertical:12, flexDirection:'row', alignItems:'center', gap:8 },
  emptyBtnText:{ color:C.white, fontWeight:'700', fontSize:14 },
  emptyRecords:{ alignItems:'center', paddingVertical:32, gap:10 },
  emptyRecordsIcon:{ width:80, height:80, borderRadius:40, backgroundColor:C.blueLight, alignItems:'center', justifyContent:'center' },
  emptyRecordsTitle:{ fontSize:16, fontWeight:'700', color:C.text },
  emptyRecordsSub:{ fontSize:13, color:C.grayMuted, textAlign:'center', lineHeight:20 },
  emptyRecordsBtn:{ backgroundColor:C.blue, borderRadius:99, paddingHorizontal:20, paddingVertical:11, flexDirection:'row', alignItems:'center', gap:8, marginTop:4 },
  emptyRecordsBtnText:{ color:C.white, fontWeight:'700', fontSize:14 },
});

const gc = StyleSheet.create({
  chartCard:{ backgroundColor:C.white, borderRadius:16, borderWidth:0.5, borderColor:C.grayBorder, padding:14, marginBottom:2, overflow:'hidden' },
  chartHeader:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:12 },
  chartDot:{ width:10, height:10, borderRadius:5 },
  chartTitle:{ fontSize:13, fontWeight:'700', color:C.text },
  chartSub:{ fontSize:10, color:C.grayMuted, marginTop:1 },
  genderPill:{ flexDirection:'row', alignItems:'center', gap:4, borderRadius:99, paddingHorizontal:8, paddingVertical:3 },
  genderPillTxt:{ fontSize:10, fontWeight:'700' },
  legend:{ flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:12, paddingTop:10, borderTopWidth:0.5, borderTopColor:C.grayBorder },
  legendItem:{ flexDirection:'row', alignItems:'center', gap:5 },
  legendSwatch:{ width:10, height:10, borderRadius:2, borderWidth:0.5 },
  legendLabel:{ fontSize:10, color:C.grayMuted, fontWeight:'500' },
  emptyChart:{ alignItems:'center', justifyContent:'center', gap:8, backgroundColor:C.gray, borderRadius:12 },
  emptyChartText:{ fontSize:12, color:C.grayMuted },
});

const zc = StyleSheet.create({
  chip:{ flex:1, borderRadius:10, padding:8, alignItems:'center', overflow:'hidden', borderWidth:0.5, borderColor:'transparent' },
  stripe:{ position:'absolute', top:0, left:0, right:0, height:3 },
  label:{ fontSize:9, fontWeight:'600', color:C.grayDark, letterSpacing:0.3, textTransform:'uppercase', marginBottom:2, marginTop:2 },
  value:{ fontSize:17, fontWeight:'700', marginBottom:1 },
  meaning:{ fontSize:10, fontWeight:'700' },
});
const ip = StyleSheet.create({
  pill:{ borderRadius:99, paddingHorizontal:7, paddingVertical:2, alignSelf:'flex-start' },
  text:{ fontSize:10, fontWeight:'600' },
});
const dp = StyleSheet.create({
  wrap:{ backgroundColor:C.gray, borderRadius:12, padding:12, marginTop:8, marginBottom:4, borderWidth:0.5, borderColor:C.grayBorder },
  rowLabel:{ fontSize:11, fontWeight:'700', color:C.grayDark, marginTop:10, marginBottom:6, textTransform:'uppercase', letterSpacing:0.4 },
  row:{ flexDirection:'row', gap:8 },
  chip:{ paddingHorizontal:14, paddingVertical:8, borderRadius:99, backgroundColor:C.white, borderWidth:0.5, borderColor:C.grayBorder },
  dayChip:{ paddingHorizontal:10, minWidth:36, alignItems:'center' },
  chipOn:{ backgroundColor:C.blue, borderColor:C.blue },
  chipTxt:{ fontSize:13, fontWeight:'600', color:C.grayDark },
  chipTxtOn:{ color:C.white, fontWeight:'700' },
});
const ff = StyleSheet.create({
  container:{ paddingTop:4 },
  label:{ fontSize:12, fontWeight:'700', color:C.grayDark, marginBottom:6, marginTop:14 },
  quickRow:{ flexDirection:'row', gap:8 },
  quickBtn:{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:4, paddingVertical:9, borderRadius:10, backgroundColor:C.white, borderWidth:0.5, borderColor:C.grayBorder },
  quickBtnOn:{ backgroundColor:C.blue, borderColor:C.blue },
  quickBtnText:{ fontSize:12, fontWeight:'600', color:C.blue },
  quickBtnTextOn:{ color:C.white },
  readonlyRow:{ flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.gray, borderRadius:10, padding:12, borderWidth:0.5, borderColor:C.grayBorder, opacity:0.8 },
  readonlyText:{ fontSize:13, color:C.grayDark, fontWeight:'500' },
  inputWrap:{ flexDirection:'row', alignItems:'center', backgroundColor:C.gray, borderRadius:10, borderWidth:0.5, borderColor:C.grayBorder, overflow:'hidden' },
  inputIcon:{ width:42, height:44, alignItems:'center', justifyContent:'center' },
  input:{ flex:1, paddingVertical:12, fontSize:14, color:C.text, fontWeight:'600' },
  inputUnit:{ fontSize:12, color:C.grayMuted, paddingRight:12, fontWeight:'500' },
  submitBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, borderRadius:12, padding:15, marginTop:18, ...Platform.select({ ios:{ shadowColor:'#000', shadowOffset:{ width:0, height:3 }, shadowOpacity:0.2, shadowRadius:6 }, android:{ elevation:4 } }) },
  submitText:{ color:C.white, fontWeight:'800', fontSize:15 },
});
const em = StyleSheet.create({
  overlay:{ flex:1, justifyContent:'flex-end' },
  backdrop:{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.45)' },
  sheet:{ backgroundColor:C.white, borderTopLeftRadius:24, borderTopRightRadius:24, paddingHorizontal:20, paddingTop:12, maxHeight:'90%', ...Platform.select({ ios:{ shadowColor:'#000', shadowOffset:{ width:0, height:-4 }, shadowOpacity:0.1, shadowRadius:14 }, android:{ elevation:16 } }) },
  handle:{ width:40, height:4, borderRadius:2, backgroundColor:C.grayBorder, alignSelf:'center', marginBottom:16 },
  sheetHeader:{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:4, paddingBottom:16, borderBottomWidth:0.5, borderBottomColor:C.grayBorder },
  sheetHeaderIcon:{ width:38, height:38, borderRadius:10, alignItems:'center', justifyContent:'center' },
  sheetTitle:{ fontSize:17, fontWeight:'700', color:C.text },
  sheetSub:{ fontSize:12, color:C.grayMuted, marginTop:2 },
  closeBtn:{ width:32, height:32, borderRadius:16, backgroundColor:C.gray, alignItems:'center', justifyContent:'center' },
  deleteBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, borderRadius:12, padding:14, marginTop:10, borderWidth:1, borderColor:'#F09595' },
  deleteBtnText:{ color:C.red, fontWeight:'700', fontSize:14 },
  cancelBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', borderRadius:12, padding:14, marginTop:8, borderWidth:0.5, borderColor:C.grayBorder },
  cancelBtnText:{ color:C.grayDark, fontWeight:'600', fontSize:14 },
});
const rc = StyleSheet.create({
  card:{ backgroundColor:C.white, borderRadius:14, padding:13, marginBottom:8, borderWidth:0.5, borderColor:C.grayBorder, ...Platform.select({ ios:{ shadowColor:'#000', shadowOffset:{ width:0, height:1 }, shadowOpacity:0.05, shadowRadius:4 }, android:{ elevation:2 } }) },
  topRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  agePill:{ flexDirection:'row', alignItems:'center', backgroundColor:C.blueLight, borderRadius:99, paddingHorizontal:10, paddingVertical:4 },
  agePillText:{ fontSize:11, fontWeight:'700', color:C.blue },
  dateRow:{ flexDirection:'row', alignItems:'center', gap:4 },
  dateText:{ fontSize:11, color:C.grayMuted, fontWeight:'500' },
  measures:{ flexDirection:'row', alignItems:'center', marginBottom:10, gap:10 },
  measureBlock:{ flexDirection:'row', alignItems:'center', gap:7 },
  measureIcon:{ width:30, height:30, borderRadius:8, alignItems:'center', justifyContent:'center' },
  measureVal:{ fontSize:15, fontWeight:'700', color:C.text },
  measureLbl:{ fontSize:10, color:C.grayMuted },
  measureDivider:{ width:0.5, height:28, backgroundColor:C.grayBorder },
  editHint:{ width:28, height:28, borderRadius:14, backgroundColor:C.gray, alignItems:'center', justifyContent:'center' },
  zRow:{ flexDirection:'row', gap:5 },
});
const sb = StyleSheet.create({
  banner:{ flexDirection:'row', alignItems:'flex-start', gap:10, borderRadius:14, padding:12, borderWidth:0.5 },
  icon:{ width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', flexShrink:0 },
  titleRow:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:2 },
  title:{ fontSize:13, fontWeight:'700', flex:1 },
  sub:{ fontSize:12, lineHeight:18 },
  extraAlerts:{ fontSize:11, fontWeight:'600', marginTop:6, opacity:0.8 },
});
const wl = StyleSheet.create({
  wrap:{ backgroundColor:C.white, borderRadius:12, borderWidth:0.5, borderColor:C.grayBorder, paddingHorizontal:12, paddingVertical:10 },
  heading:{ fontSize:10, fontWeight:'700', color:C.grayDark, letterSpacing:0.5, textTransform:'uppercase', marginBottom:8 },
  row:{ flexDirection:'row', gap:8 },
  item:{ flex:1, flexDirection:'row', alignItems:'center', gap:6, borderLeftWidth:3, paddingLeft:7, paddingVertical:3 },
  dot:{ width:7, height:7, borderRadius:3.5 },
  code:{ fontSize:11, fontWeight:'800' },
  desc:{ fontSize:9, color:C.grayMuted, fontWeight:'500', marginTop:1 },
});
const wb = StyleSheet.create({
  badge:{ borderRadius:99, alignItems:'center', justifyContent:'center' },
  text:{ fontWeight:'800', letterSpacing:0.3 },
});