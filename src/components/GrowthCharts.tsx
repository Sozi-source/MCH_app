import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
} from 'react-native';
import Svg, {
  Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop, Rect, G,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '@/lib/theme';
import { GrowthRecord } from '@/store/childStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 36, left: 40 };
const PLOT_W = CHART_WIDTH - PAD.left - PAD.right;
const PLOT_H = CHART_HEIGHT - PAD.top - PAD.bottom;

// WHO Child Growth Standards reference curves
// Source: WHO (2006) - Weight-for-age and Length/Height-for-age
const WHO_WAZ_BOYS = {
  months: [0,3,6,9,12,18,24,36,48,60],
  sd3neg: [1.9,4.4,5.7,6.6,7.1,8.1,9.0,10.8,12.3,13.7],
  sd2neg: [2.5,5.1,6.5,7.5,8.1,9.2,10.2,12.0,13.7,15.2],
  sd0:    [3.3,6.4,7.9,9.0,9.9,11.1,12.2,14.3,16.3,18.3],
  sd2:    [4.4,7.8,9.6,10.8,11.8,13.2,14.5,17.0,19.3,21.8],
  sd3:    [5.0,8.7,10.7,12.0,13.1,14.7,16.1,18.9,21.5,24.2],
};
const WHO_WAZ_GIRLS = {
  months: [0,3,6,9,12,18,24,36,48,60],
  sd3neg: [1.9,4.1,5.3,6.2,6.8,7.8,8.7,10.4,11.8,13.1],
  sd2neg: [2.4,4.8,6.1,7.0,7.7,8.8,9.8,11.6,13.2,14.7],
  sd0:    [3.2,6.0,7.3,8.4,9.2,10.5,11.5,13.9,15.9,18.2],
  sd2:    [4.2,7.5,9.0,10.4,11.5,13.2,14.5,17.5,20.1,23.0],
  sd3:    [4.8,8.4,10.1,11.7,13.1,15.1,16.6,20.2,23.3,26.7],
};
const WHO_HAZ_BOYS = {
  months: [0,3,6,9,12,18,24,36,48,60],
  sd3neg: [43.6,55.3,61.0,65.2,68.6,73.9,78.0,84.4,89.9,95.0],
  sd2neg: [46.1,57.6,63.3,67.7,71.0,76.0,80.5,87.3,93.0,98.2],
  sd0:    [49.9,62.0,67.6,72.3,75.7,80.7,85.5,92.5,99.1,105.3],
  sd2:    [53.4,66.2,71.9,76.8,80.4,85.2,90.4,97.8,105.2,112.4],
  sd3:    [55.6,68.5,74.1,79.1,82.9,87.5,93.0,100.6,108.3,115.6],
};
const WHO_HAZ_GIRLS = {
  months: [0,3,6,9,12,18,24,36,48,60],
  sd3neg: [43.6,54.3,59.8,64.0,67.2,72.3,76.5,83.0,88.5,93.6],
  sd2neg: [45.6,56.4,61.8,66.2,69.5,74.9,79.3,85.9,91.7,97.0],
  sd0:    [49.1,60.2,65.7,70.1,74.0,80.0,85.7,93.1,99.9,106.7],
  sd2:    [52.9,64.3,70.0,74.8,78.9,85.3,91.2,99.1,106.5,113.9],
  sd3:    [55.0,66.4,72.3,77.2,81.5,88.1,94.3,102.6,110.2,117.9],
};

function interpolate(months: number[], values: number[], age: number) {
  if (age <= months[0]) return values[0];
  if (age >= months[months.length - 1]) return values[values.length - 1];
  for (let i = 0; i < months.length - 1; i++) {
    if (age >= months[i] && age <= months[i + 1]) {
      const t = (age - months[i]) / (months[i + 1] - months[i]);
      return values[i] + t * (values[i + 1] - values[i]);
    }
  }
  return values[0];
}

function toX(age: number, minAge: number, maxAge: number) {
  return PAD.left + ((age - minAge) / (maxAge - minAge)) * PLOT_W;
}
function toY(val: number, minVal: number, maxVal: number) {
  return PAD.top + PLOT_H - ((val - minVal) / (maxVal - minVal)) * PLOT_H;
}
function buildPath(monthsArr: number[], valArr: number[], minAge: number, maxAge: number, minVal: number, maxVal: number) {
  return valArr.map((v, i) => {
    const x = toX(monthsArr[i], minAge, maxAge);
    const y = toY(v, minVal, maxVal);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}
function buildArea(monthsArr: number[], upper: number[], lower: number[], minAge: number, maxAge: number, minVal: number, maxVal: number) {
  const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(monthsArr[i],minAge,maxAge).toFixed(1)} ${toY(v,minVal,maxVal).toFixed(1)}`).join(' ');
  const bot = [...lower].reverse().map((v, i) => `L ${toX(monthsArr[lower.length-1-i],minAge,maxAge).toFixed(1)} ${toY(v,minVal,maxVal).toFixed(1)}`).join(' ');
  return `${top} ${bot} Z`;
}

function GrowthChart({ records, sex, type }: { records: any[]; sex: string; type: string }) {
  const ref = sex === 'male'
    ? (type === 'WAZ' ? WHO_WAZ_BOYS : WHO_HAZ_BOYS)
    : (type === 'WAZ' ? WHO_WAZ_GIRLS : WHO_HAZ_GIRLS);

  const { months, sd3neg, sd2neg, sd0, sd2, sd3 } = ref;

  const allAges = records.map(r => r.age_months);
  const minAge = 0;
  const maxAge = Math.max(24, ...(allAges.length ? allAges : [24]));

  const childVals = records.map(r => type === 'WAZ' ? r.weight_kg : (r.height_cm ?? 0)).filter(Boolean);
  const allVals = [...sd3neg, ...sd3, ...childVals];
  const minVal = Math.floor(Math.min(...allVals) * 0.95);
  const maxVal = Math.ceil(Math.max(...allVals) * 1.05);

  const yTicks = Array.from({ length: 5 }, (_, i) => minVal + ((maxVal - minVal) / 4) * i);
  const xTicks = [];
  for (let m = 0; m <= maxAge; m += 6) xTicks.push(m);

  const childPoints = records
    .filter(r => type === 'WAZ' ? r.weight_kg > 0 : (r.height_cm ?? 0) > 0)
    .map(r => ({ age: r.age_months, val: type === 'WAZ' ? r.weight_kg : r.height_cm, z: type === 'WAZ' ? r.waz : r.haz }))
    .sort((a, b) => a.age - b.age);

  const childPath = childPoints.map((p, i) => {
    const x = toX(p.age, minAge, maxAge);
    const y = toY(p.val, minVal, maxVal);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const unit = type === 'WAZ' ? 'kg' : 'cm';
  const gradId = `cg${type}`;

  return (
    <View style={cs.chartBox}>
      <View style={cs.chartTitleRow}>
        <View style={[cs.badge, { backgroundColor: type === 'WAZ' ? '#E8F4FB' : '#F0FAF5' }]}>
          <Text style={[cs.badgeText, { color: type === 'WAZ' ? '#185FA5' : '#0F6E56' }]}>
            {type === 'WAZ' ? 'Weight-for-Age' : 'Height-for-Age'}
          </Text>
        </View>
        <View style={cs.whoTag}>
          <Ionicons name="shield-checkmark" size={10} color="#2A9D6E" />
          <Text style={cs.whoTagText}>WHO Standards</Text>
        </View>
      </View>

      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="nz" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2A9D6E" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#2A9D6E" stopOpacity="0.03" />
          </LinearGradient>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#2563EB" stopOpacity="1" />
            <Stop offset="1" stopColor="#0F6E56" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {yTicks.map((tick, i) => {
          const y = toY(tick, minVal, maxVal);
          return (
            <G key={i}>
              <Line x1={PAD.left} y1={y} x2={PAD.left + PLOT_W} y2={y} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4,4" />
              <SvgText x={PAD.left - 4} y={y + 4} fontSize="9" fill="#9CA3AF" textAnchor="end">{tick.toFixed(0)}</SvgText>
            </G>
          );
        })}

        {xTicks.map((tick, i) => {
          const x = toX(tick, minAge, maxAge);
          return (
            <G key={i}>
              <Line x1={x} y1={PAD.top} x2={x} y2={PAD.top + PLOT_H} stroke="#F3F4F6" strokeWidth="1" />
              <SvgText x={x} y={PAD.top + PLOT_H + 14} fontSize="9" fill="#9CA3AF" textAnchor="middle">{tick}</SvgText>
            </G>
          );
        })}

        <SvgText x={PAD.left + PLOT_W / 2} y={CHART_HEIGHT - 2} fontSize="9" fill="#6B7280" textAnchor="middle">Age (months)</SvgText>
        <SvgText x={10} y={PAD.top + PLOT_H / 2} fontSize="9" fill="#6B7280" textAnchor="middle" rotation="-90" originX={10} originY={PAD.top + PLOT_H / 2}>{unit}</SvgText>

        <Path d={buildArea(months, sd2, sd2neg, minAge, maxAge, minVal, maxVal)} fill="url(#nz)" />

        <Path d={buildPath(months, sd3,   minAge, maxAge, minVal, maxVal)} stroke="#EF4444" strokeWidth="1"   strokeDasharray="5,3" fill="none" opacity="0.6" />
        <Path d={buildPath(months, sd2,   minAge, maxAge, minVal, maxVal)} stroke="#F97316" strokeWidth="1"   strokeDasharray="4,2" fill="none" opacity="0.7" />
        <Path d={buildPath(months, sd0,   minAge, maxAge, minVal, maxVal)} stroke="#2A9D6E" strokeWidth="1.5" fill="none" />
        <Path d={buildPath(months, sd2neg,minAge, maxAge, minVal, maxVal)} stroke="#F97316" strokeWidth="1"   strokeDasharray="4,2" fill="none" opacity="0.7" />
        <Path d={buildPath(months, sd3neg,minAge, maxAge, minVal, maxVal)} stroke="#EF4444" strokeWidth="1"   strokeDasharray="5,3" fill="none" opacity="0.6" />

        {[{arr:sd3,lbl:'+3SD',c:'#EF4444'},{arr:sd2,lbl:'+2SD',c:'#F97316'},{arr:sd0,lbl:'Med',c:'#2A9D6E'},{arr:sd2neg,lbl:'-2SD',c:'#F97316'},{arr:sd3neg,lbl:'-3SD',c:'#EF4444'}].map(({arr,lbl,c}) => {
          const lastAge = Math.min(months[months.length-1], maxAge);
          const lastVal = interpolate(months, arr, lastAge);
          const x = toX(lastAge, minAge, maxAge);
          const y = toY(lastVal, minVal, maxVal);
          return <SvgText key={lbl} x={x-2} y={y-3} fontSize="7.5" fill={c} textAnchor="end">{lbl}</SvgText>;
        })}

        {childPoints.length > 1 && (
          <Path d={childPath} stroke={`url(#${gradId})`} strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {childPoints.map((p, i) => {
          const x = toX(p.age, minAge, maxAge);
          const y = toY(p.val, minVal, maxVal);
          const z = p.z ?? 0;
          const dotColor = Math.abs(z) > 3 ? '#EF4444' : Math.abs(z) > 2 ? '#F97316' : '#2563EB';
          const isLast = i === childPoints.length - 1;
          return (
            <G key={i}>
              {isLast && <Circle cx={x} cy={y} r={10} fill={dotColor} opacity={0.15} />}
              <Circle cx={x} cy={y} r={isLast ? 5 : 4} fill={dotColor} stroke="white" strokeWidth={isLast ? 2 : 1.5} />
              {isLast && p.z !== null && p.z !== undefined && (
                <>
                  <Rect x={x-14} y={y-22} width={28} height={14} rx={4} fill={dotColor} />
                  <SvgText x={x} y={y-12} fontSize="8.5" fill="white" textAnchor="middle" fontWeight="bold">{p.z.toFixed(1)}</SvgText>
                </>
              )}
            </G>
          );
        })}

        <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top+PLOT_H} stroke="#D1D5DB" strokeWidth="1" />
        <Line x1={PAD.left} y1={PAD.top+PLOT_H} x2={PAD.left+PLOT_W} y2={PAD.top+PLOT_H} stroke="#D1D5DB" strokeWidth="1" />
      </Svg>

      <View style={cs.legend}>
        {[{color:'#2A9D6E',label:'Median'},{color:'#F97316',label:'Ã‚Â±2 SD'},{color:'#EF4444',label:'Ã‚Â±3 SD'},{color:'#2563EB',label:'Child',dot:true}].map(({color,label,dot}) => (
          <View key={label} style={cs.legendItem}>
            {dot
              ? <View style={[cs.legendDot,{backgroundColor:color}]} />
              : <View style={[cs.legendLine,{backgroundColor:color}]} />
            }
            <Text style={cs.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatsSummary({ records, type }: { records: any[]; type: string }) {
  if (records.length < 2) return null;
  const sorted = [...records].sort((a, b) => a.age_months - b.age_months);
  const first = sorted[0];
  const last  = sorted[sorted.length - 1];
  const isW   = type === 'WAZ';
  const diff  = isW
    ? (last.weight_kg - first.weight_kg).toFixed(1)
    : ((last.height_cm ?? 0) - (first.height_cm ?? 0)).toFixed(1);
  const unit  = isW ? 'kg' : 'cm';
  const zNow  = isW ? last.waz : last.haz;
  const latestVal = isW ? last.weight_kg : last.height_cm;
  return (
    <View style={cs.statsRow}>
      {[
        { val: `${latestVal}${unit}`, label: 'Latest' },
        { val: `+${diff}${unit}`,     label: 'Total gain', color: '#2A9D6E' },
        { val: zNow !== null && zNow !== undefined ? zNow.toFixed(1) : 'N/A', label: 'Z-score',
          color: zNow !== null && zNow !== undefined ? (Math.abs(zNow) > 3 ? '#EF4444' : Math.abs(zNow) > 2 ? '#F97316' : '#2A9D6E') : undefined },
        { val: `${records.length}`, label: 'Records' },
      ].map(({ val, label, color }) => (
        <View key={label} style={cs.statBox}>
          <Text style={[cs.statVal, color ? { color } : {}]}>{val}</Text>
          <Text style={cs.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function GrowthCharts({ records, sex, childName }: { records: any[]; sex: string; childName: string }) {
  const [activeTab, setActiveTab] = React.useState('WAZ');

  if (records.length === 0) {
    return (
      <View style={cs.emptyChart}>
        <Ionicons name="analytics-outline" size={32} color="#9CA3AF" />
        <Text style={cs.emptyChartText}>
          Add measurements to see {childName}'s growth plotted against WHO standards
        </Text>
      </View>
    );
  }

  return (
    <View style={cs.container}>
      <View style={cs.tabRow}>
        {[{id:'WAZ',icon:'scale-outline' as const,label:'Weight'},{id:'HAZ',icon:'resize-outline' as const,label:'Height'}].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[cs.tab, activeTab === tab.id && cs.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons name={tab.icon} size={14} color={activeTab === tab.id ? '#fff' : '#9CA3AF'} />
            <Text style={[cs.tabText, activeTab === tab.id && cs.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <StatsSummary records={records} type={activeTab} />
      <GrowthChart records={records} sex={sex} type={activeTab} />

      <View style={cs.sourceRow}>
        <Ionicons name="information-circle-outline" size={12} color="#9CA3AF" />
        <Text style={cs.sourceText}>
          Reference curves: WHO Child Growth Standards (2006). Green shaded zone = normal range (-2SD to +2SD).
        </Text>
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  container:    { marginBottom: 8 },
  tabRow:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  tabActive:    { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  tabText:      { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive:{ color: '#fff' },
  chartBox:     { backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  chartTitleRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText:    { fontSize: 12, fontWeight: '700' },
  whoTag:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
  whoTagText:   { fontSize: 10, color: '#2A9D6E', fontWeight: '600', fontStyle: 'italic' },
  legend:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLine:   { width: 16, height: 2.5, borderRadius: 2 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendText:   { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  statsRow:     { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBox:      { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  statVal:      { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 2 },
  statLabel:    { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  sourceRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  sourceText:   { flex: 1, fontSize: 10, color: '#9CA3AF', fontStyle: 'italic', lineHeight: 14 },
  emptyChart:   { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 24, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  emptyChartText:{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
});