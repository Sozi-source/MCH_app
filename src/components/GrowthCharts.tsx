import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ScrollView, Modal, Pressable, Animated,
  Platform,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;

// ─── WHO Child Growth Standards ───────────────────────────────────────────────
const WHO = {
  WAZ: {
    male: {
      months: [0,3,6,9,12,15,18,21,24,30,36,42,48,54,60],
      sd3neg: [1.9,4.4,5.7,6.6,7.1,7.6,8.1,8.6,9.0,9.9,10.8,11.7,12.3,13.0,13.7],
      sd2neg: [2.5,5.1,6.5,7.5,8.1,8.6,9.2,9.7,10.2,11.1,12.0,13.0,13.7,14.5,15.2],
      sd0:    [3.3,6.4,7.9,9.0,9.9,10.6,11.1,11.6,12.2,13.3,14.3,15.3,16.3,17.3,18.3],
      sd2:    [4.4,7.8,9.6,10.8,11.8,12.5,13.2,13.9,14.5,15.7,17.0,18.2,19.3,20.5,21.8],
      sd3:    [5.0,8.7,10.7,12.0,13.1,13.9,14.7,15.5,16.1,17.5,18.9,20.2,21.5,22.8,24.2],
    },
    female: {
      months: [0,3,6,9,12,15,18,21,24,30,36,42,48,54,60],
      sd3neg: [1.9,4.1,5.3,6.2,6.8,7.3,7.8,8.2,8.7,9.5,10.4,11.2,11.8,12.5,13.1],
      sd2neg: [2.4,4.8,6.1,7.0,7.7,8.2,8.8,9.3,9.8,10.7,11.6,12.5,13.2,14.0,14.7],
      sd0:    [3.2,6.0,7.3,8.4,9.2,9.9,10.5,11.1,11.5,12.8,13.9,14.9,15.9,16.9,18.2],
      sd2:    [4.2,7.5,9.0,10.4,11.5,12.4,13.2,14.0,14.5,16.1,17.5,18.9,20.1,21.4,23.0],
      sd3:    [4.8,8.4,10.1,11.7,13.1,14.2,15.1,16.0,16.6,18.5,20.2,21.8,23.3,24.8,26.7],
    },
  },
  HAZ: {
    male: {
      months: [0,3,6,9,12,15,18,21,24,30,36,42,48,54,60],
      sd3neg: [43.6,55.3,61.0,65.2,68.6,71.6,73.9,76.0,78.0,81.6,84.4,87.0,89.9,92.4,95.0],
      sd2neg: [46.1,57.6,63.3,67.7,71.0,74.0,76.0,78.6,80.5,84.4,87.3,90.1,93.0,95.6,98.2],
      sd0:    [49.9,62.0,67.6,72.3,75.7,79.1,81.7,84.2,85.5,89.6,92.5,95.6,99.1,102.3,105.3],
      sd2:    [53.4,66.2,71.9,76.8,80.4,83.9,86.7,89.5,90.4,95.0,97.8,101.2,105.2,108.9,112.4],
      sd3:    [55.6,68.5,74.1,79.1,82.9,86.4,89.3,92.1,93.0,98.1,100.6,104.3,108.3,112.0,115.6],
    },
    female: {
      months: [0,3,6,9,12,15,18,21,24,30,36,42,48,54,60],
      sd3neg: [43.6,54.3,59.8,64.0,67.2,70.1,72.3,74.3,76.5,79.9,83.0,85.8,88.5,91.2,93.6],
      sd2neg: [45.6,56.4,61.8,66.2,69.5,72.5,74.9,77.0,79.3,83.1,85.9,88.9,91.7,94.6,97.0],
      sd0:    [49.1,60.2,65.7,70.1,74.0,77.5,80.0,82.3,85.7,89.9,93.1,96.4,99.9,103.3,106.7],
      sd2:    [52.9,64.3,70.0,74.8,78.9,82.6,85.3,87.8,91.2,96.0,99.1,102.7,106.5,110.4,113.9],
      sd3:    [55.0,66.4,72.3,77.2,81.5,85.4,88.1,90.8,94.3,99.4,102.6,106.4,110.2,114.1,117.9],
    },
  },
  HCZ: {
    male: {
      months: [0,3,6,9,12,15,18,21,24,30,36],
      sd3neg: [30.7,36.3,39.4,41.6,43.2,44.4,45.4,46.3,47.0,48.3,49.3],
      sd2neg: [31.9,37.6,40.6,42.9,44.5,45.7,46.7,47.6,48.3,49.7,50.7],
      sd0:    [34.5,40.5,43.3,45.5,47.2,48.4,49.4,50.3,51.0,52.4,53.5],
      sd2:    [37.1,43.4,46.1,48.2,50.0,51.2,52.2,53.1,53.9,55.4,56.5],
      sd3:    [38.3,44.7,47.4,49.5,51.3,52.5,53.6,54.5,55.4,56.9,58.0],
    },
    female: {
      months: [0,3,6,9,12,15,18,21,24,30,36],
      sd3neg: [30.3,35.6,38.6,40.8,42.4,43.6,44.6,45.5,46.2,47.5,48.5],
      sd2neg: [31.5,36.8,39.9,42.1,43.7,44.9,45.9,46.8,47.6,48.9,50.0],
      sd0:    [33.9,39.5,42.4,44.6,46.3,47.6,48.6,49.5,50.3,51.7,52.9],
      sd2:    [36.2,42.1,45.0,47.3,49.0,50.3,51.4,52.3,53.2,54.7,55.9],
      sd3:    [37.3,43.4,46.3,48.6,50.4,51.7,52.8,53.8,54.7,56.3,57.5],
    },
  },
  WHZ: {
    male: {
      heights: [45,50,55,60,65,70,75,80,85,90,95,100,105,110],
      sd3neg:  [1.2,2.4,3.3,4.5,5.6,6.6,7.7,8.6,9.5,10.3,11.3,12.4,13.5,14.7],
      sd2neg:  [1.7,2.9,3.9,5.1,6.3,7.4,8.5,9.5,10.5,11.4,12.5,13.7,14.9,16.2],
      sd0:     [2.4,3.9,5.0,6.4,7.7,8.9,10.2,11.3,12.4,13.5,14.7,16.0,17.4,18.9],
      sd2:     [3.3,5.3,6.6,8.0,9.6,11.0,12.5,13.8,15.1,16.4,17.9,19.5,21.2,23.1],
      sd3:     [3.9,6.2,7.6,9.2,10.9,12.5,14.1,15.6,17.1,18.6,20.3,22.2,24.2,26.4],
    },
    female: {
      heights: [45,50,55,60,65,70,75,80,85,90,95,100,105,110],
      sd3neg:  [1.1,2.2,3.1,4.2,5.3,6.3,7.3,8.2,9.1,10.0,11.0,12.1,13.2,14.4],
      sd2neg:  [1.5,2.7,3.7,4.9,6.1,7.2,8.3,9.3,10.3,11.3,12.4,13.6,14.9,16.2],
      sd0:     [2.2,3.6,4.8,6.2,7.5,8.7,10.0,11.1,12.2,13.3,14.6,16.0,17.5,19.2],
      sd2:     [3.1,5.0,6.5,8.1,9.7,11.1,12.7,14.0,15.4,16.8,18.5,20.4,22.4,24.7],
      sd3:     [3.7,5.9,7.5,9.3,11.1,12.7,14.5,15.9,17.5,19.2,21.2,23.4,25.8,28.5],
    },
  },
};

function interpolate(xArr: number[], yArr: number[], x: number): number {
  if (x <= xArr[0]) return yArr[0];
  if (x >= xArr[xArr.length - 1]) return yArr[yArr.length - 1];
  for (let i = 0; i < xArr.length - 1; i++) {
    if (x >= xArr[i] && x <= xArr[i + 1]) {
      const t = (x - xArr[i]) / (xArr[i + 1] - xArr[i]);
      return yArr[i] + t * (yArr[i + 1] - yArr[i]);
    }
  }
  return yArr[0];
}

function zColor(z: number | null | undefined): string {
  if (z == null) return '#6B7280';
  if (Math.abs(z) > 3) return '#EF4444';
  if (Math.abs(z) > 2) return '#F97316';
  return '#2A9D6E';
}

function zLabel(z: number | null | undefined): string {
  if (z == null) return 'N/A';
  if (z < -3) return 'Severely Low';
  if (z < -2) return 'Low';
  if (z > 3)  return 'Very High';
  if (z > 2)  return 'High';
  return 'Normal';
}

// ─── Tooltip Modal ─────────────────────────────────────────────────────────────
function TooltipModal({
  visible, onClose, point, type,
}: {
  visible: boolean;
  onClose: () => void;
  point: any;
  type: string;
}) {
  if (!point) return null;
  const isW   = type === 'WAZ';
  const isHC  = type === 'HCZ';
  const isWH  = type === 'WHZ';
  const val   = isW ? point.weight_kg : isHC ? point.head_circ_cm : isWH ? point.weight_kg : point.height_cm;
  const z     = isW ? point.waz : isHC ? null : isWH ? point.whz : point.haz;
  const unit  = isW ? 'kg' : 'cm';
  const label = isW ? 'Weight' : isHC ? 'Head Circ.' : isWH ? 'Weight' : 'Height';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tt.backdrop} onPress={onClose}>
        <View style={tt.card}>
          <View style={tt.header}>
            <Text style={tt.title}>Measurement Detail</Text>
            <TouchableOpacity onPress={onClose} style={tt.closeBtn}>
              <Ionicons name="close" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={tt.row}>
            <View style={tt.col}>
              <Text style={tt.colLabel}>Age</Text>
              <Text style={tt.colValue}>{point.age_months}m</Text>
            </View>
            <View style={tt.col}>
              <Text style={tt.colLabel}>{label}</Text>
              <Text style={tt.colValue}>{val != null ? `${Number(val).toFixed(1)}${unit}` : 'N/A'}</Text>
            </View>
            {z != null && (
              <View style={tt.col}>
                <Text style={tt.colLabel}>Z-score</Text>
                <Text style={[tt.colValue, { color: zColor(z) }]}>{Number(z).toFixed(2)}</Text>
              </View>
            )}
          </View>

          {z != null && (
            <View style={[tt.statusBadge, { backgroundColor: zColor(z) + '20' }]}>
              <Ionicons
                name={Math.abs(z) > 2 ? 'warning' : 'checkmark-circle'}
                size={14}
                color={zColor(z)}
              />
              <Text style={[tt.statusText, { color: zColor(z) }]}>
                {zLabel(z)}
              </Text>
            </View>
          )}

          {point.notes && (
            <Text style={tt.notes}>📝 {point.notes}</Text>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Single Chart ──────────────────────────────────────────────────────────────
function WHOChart({
  records,
  sex,
  type,
}: {
  records: any[];
  sex: string;
  type: 'WAZ' | 'HAZ' | 'HCZ' | 'WHZ';
}) {
  const [selected, setSelected] = useState<any>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const genderKey = sex === 'male' ? 'male' : 'female';
  const ref       = (WHO as any)[type][genderKey];
  const xKey      = type === 'WHZ' ? 'heights' : 'months';
  const xArr: number[] = ref[xKey];

  // Build child data points
  const childPoints = records
    .filter(r => {
      if (type === 'WAZ')  return r.weight_kg > 0;
      if (type === 'HAZ')  return (r.height_cm ?? 0) > 0;
      if (type === 'HCZ')  return (r.head_circ_cm ?? 0) > 0;
      if (type === 'WHZ')  return r.weight_kg > 0 && (r.height_cm ?? 0) > 0;
      return false;
    })
    .map(r => {
      const xVal = type === 'WHZ' ? (r.height_cm ?? 0) : r.age_months;
      const yVal = type === 'WAZ' ? r.weight_kg
                 : type === 'HCZ' ? (r.head_circ_cm ?? 0)
                 : type === 'WHZ' ? r.weight_kg
                 : (r.height_cm ?? 0);
      const z    = type === 'WAZ' ? r.waz : type === 'HAZ' ? r.haz : type === 'WHZ' ? r.whz : null;
      return { xVal, yVal, z, record: r };
    })
    .sort((a, b) => a.xVal - b.xVal);

  if (childPoints.length === 0) {
    return (
      <View style={styles.emptyInner}>
        <Ionicons name="analytics-outline" size={24} color="#9CA3AF" />
        <Text style={styles.emptyInnerText}>No data available for this chart</Text>
      </View>
    );
  }

  const maxX = Math.max(...childPoints.map(p => p.xVal), xArr[xArr.length - 1]);
  const minX = Math.min(xArr[0], ...childPoints.map(p => p.xVal));

  // Build gifted-charts data for child line
  const childData = childPoints.map((p, i) => ({
    value: p.yVal,
    label: type === 'WHZ' ? `${p.xVal}cm` : `${p.xVal}m`,
    dataPointColor: zColor(p.z),
    dataPointRadius: i === childPoints.length - 1 ? 7 : 5,
    showStrip: false,
    onPress: () => {
      setSelected(p.record);
      setTooltipVisible(true);
    },
  }));

  // Build WHO reference lines
  const makeRefData = (arr: number[]) =>
    xArr.map((x, i) => ({
      value: arr[i],
    }));

  const sd0Data    = makeRefData(ref.sd0);
  const sd2Data    = makeRefData(ref.sd2);
  const sd2negData = makeRefData(ref.sd2neg);
  const sd3Data    = makeRefData(ref.sd3);
  const sd3negData = makeRefData(ref.sd3neg);

  const allVals = [...ref.sd3neg, ...ref.sd3, ...childPoints.map(p => p.yVal)];
  const minVal  = Math.floor(Math.min(...allVals) * 0.95);
  const maxVal  = Math.ceil(Math.max(...allVals) * 1.05);

  const latestPoint = childPoints[childPoints.length - 1];
  const z           = latestPoint?.z;

  const chartConfig = {
    'WAZ': { title: 'Weight-for-Age', color: '#2563EB', unit: 'kg', icon: 'scale-outline' },
    'HAZ': { title: 'Height-for-Age', color: '#2A9D6E', unit: 'cm', icon: 'resize-outline' },
    'HCZ': { title: 'Head Circumference', color: '#7C3AED', unit: 'cm', icon: 'radio-button-on-outline' },
    'WHZ': { title: 'Weight-for-Height', color: '#DB2777', unit: 'kg', icon: 'body-outline' },
  }[type];

  return (
    <View style={styles.chartCard}>
      {/* Header */}
      <View style={styles.chartHeader}>
        <View style={[styles.chartIconBadge, { backgroundColor: chartConfig.color + '15' }]}>
          <Ionicons name={chartConfig.icon as any} size={16} color={chartConfig.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chartTitle}>{chartConfig.title}</Text>
          <Text style={styles.chartSubtitle}>WHO {genderKey === 'male' ? 'Boys' : 'Girls'} Standards</Text>
        </View>
        {z != null && (
          <View style={[styles.zBadge, { backgroundColor: zColor(z) + '20' }]}>
            <Text style={[styles.zBadgeText, { color: zColor(z) }]}>
              Z: {Number(z).toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Status bar */}
      {z != null && (
        <View style={[styles.statusBar, { backgroundColor: zColor(z) + '10', borderLeftColor: zColor(z) }]}>
          <Ionicons
            name={Math.abs(z) > 2 ? 'warning-outline' : 'checkmark-circle-outline'}
            size={13}
            color={zColor(z)}
          />
          <Text style={[styles.statusBarText, { color: zColor(z) }]}>
            {zLabel(z)} — {type === 'WAZ' ? `${latestPoint.yVal.toFixed(1)}kg` : `${latestPoint.yVal.toFixed(1)}cm`} at {latestPoint.xVal}months
          </Text>
        </View>
      )}

      {/* Chart */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          data={childData}
          data2={sd0Data}
          data3={sd2Data}
          data4={sd2negData}
          width={Math.max(CHART_WIDTH, xArr.length * 30)}
          height={200}
          spacing={30}
          initialSpacing={10}
          endSpacing={20}
          maxValue={maxVal}
          yAxisOffset={minVal}
          noOfSections={5}
          color1={chartConfig.color}
          color2="#2A9D6E"
          color3="#F97316"
          color4="#F97316"
          thickness1={2.5}
          thickness2={1.5}
          thickness3={1}
          thickness4={1}
          hideDataPoints2
          hideDataPoints3
          hideDataPoints4
          dataPointsColor1={chartConfig.color}
          dataPointsRadius1={5}
          curved
          curvature={0.3}
          yAxisColor="#E5E7EB"
          xAxisColor="#E5E7EB"
          yAxisTextStyle={{ color: '#9CA3AF', fontSize: 9 }}
          xAxisLabelTextStyle={{ color: '#9CA3AF', fontSize: 9 }}
          rulesColor="#F3F4F6"
          rulesType="dashed"
          showVerticalLines
          verticalLinesColor="#F3F4F6"
          backgroundColor="transparent"
          stripColor={chartConfig.color + '30'}
          stripWidth={2}
          onPress={(item: any, index: number) => {
            if (childPoints[index]) {
              setSelected(childPoints[index].record);
              setTooltipVisible(true);
            }
          }}
        />
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: chartConfig.color, label: "Child's growth", line: false },
          { color: '#2A9D6E', label: 'Median (0 SD)', line: true },
          { color: '#F97316', label: '±2 SD range', line: true },
        ].map(({ color, label, line }) => (
          <View key={label} style={styles.legendItem}>
            {line
              ? <View style={[styles.legendLine, { backgroundColor: color }]} />
              : <View style={[styles.legendDot, { backgroundColor: color }]} />
            }
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.tapHint}>
        <Ionicons name="finger-print-outline" size={10} color="#9CA3AF" /> Tap any point for details
      </Text>

      <TooltipModal
        visible={tooltipVisible}
        onClose={() => setTooltipVisible(false)}
        point={selected}
        type={type}
      />
    </View>
  );
}

// ─── Stats Summary ─────────────────────────────────────────────────────────────
function StatsSummary({ records }: { records: any[] }) {
  if (records.length === 0) return null;
  const sorted = [...records].sort((a, b) => a.age_months - b.age_months);
  const last   = sorted[sorted.length - 1];
  const first  = sorted[0];

  const weightGain  = last.weight_kg && first.weight_kg
    ? (last.weight_kg - first.weight_kg).toFixed(1) : null;
  const heightGain  = last.height_cm && first.height_cm
    ? (last.height_cm - first.height_cm).toFixed(1) : null;

  const stats = [
    { icon: 'scale-outline', label: 'Weight', value: last.weight_kg ? `${last.weight_kg}kg` : 'N/A', color: '#2563EB', sub: weightGain ? `+${weightGain}kg total` : '' },
    { icon: 'resize-outline', label: 'Height', value: last.height_cm ? `${last.height_cm}cm` : 'N/A', color: '#2A9D6E', sub: heightGain ? `+${heightGain}cm total` : '' },
    { icon: 'analytics-outline', label: 'WAZ', value: last.waz != null ? Number(last.waz).toFixed(1) : 'N/A', color: zColor(last.waz), sub: zLabel(last.waz) },
    { icon: 'bar-chart-outline', label: 'Records', value: `${records.length}`, color: '#7C3AED', sub: `since ${sorted[0].age_months}mo` },
  ];

  return (
    <View style={styles.statsGrid}>
      {stats.map(({ icon, label, value, color, sub }) => (
        <View key={label} style={styles.statCard}>
          <View style={[styles.statIconCircle, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon as any} size={16} color={color} />
          </View>
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
          {!!sub && <Text style={styles.statSub}>{sub}</Text>}
        </View>
      ))}
    </View>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
const TABS: { id: 'WAZ' | 'HAZ' | 'HCZ' | 'WHZ'; icon: string; label: string }[] = [
  { id: 'WAZ', icon: 'scale-outline',             label: 'Weight/Age'  },
  { id: 'HAZ', icon: 'resize-outline',             label: 'Height/Age'  },
  { id: 'HCZ', icon: 'radio-button-on-outline',   label: 'Head Circ.'  },
  { id: 'WHZ', icon: 'body-outline',               label: 'Weight/Ht'  },
];

export default function GrowthCharts({
  records,
  sex,
  childName,
}: {
  records: any[];
  sex: string;
  childName: string;
}) {
  const [activeTab, setActiveTab] = useState<'WAZ' | 'HAZ' | 'HCZ' | 'WHZ'>('WAZ');

  if (records.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="analytics-outline" size={36} color="#9CA3AF" />
        </View>
        <Text style={styles.emptyTitle}>No Growth Data Yet</Text>
        <Text style={styles.emptyText}>
          Add {childName}'s measurements to see growth plotted against WHO standards
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats summary */}
      <StatsSummary records={records} />

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContent}
      >
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const color  = {
            WAZ: '#2563EB', HAZ: '#2A9D6E', HCZ: '#7C3AED', WHZ: '#DB2777',
          }[tab.id];
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, active && { backgroundColor: color, borderColor: color }]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon as any}
                size={13}
                color={active ? '#fff' : '#9CA3AF'}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Chart */}
      <WHOChart records={records} sex={sex} type={activeTab} />

      {/* WHO source note */}
      <View style={styles.sourceRow}>
        <Ionicons name="shield-checkmark-outline" size={11} color="#9CA3AF" />
        <Text style={styles.sourceText}>
          WHO Child Growth Standards (2006). Normal range: -2 SD to +2 SD.
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { marginBottom: 8 },
  statsGrid:        { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard:         { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', gap: 4 },
  statIconCircle:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue:        { fontSize: 16, fontWeight: '800' },
  statLabel:        { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  statSub:          { fontSize: 9, color: '#C4B5FD', textAlign: 'center' },
  tabScroll:        { marginBottom: 12 },
  tabContent:       { gap: 8, paddingHorizontal: 2 },
  tab:              { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  tabText:          { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive:    { color: '#fff' },
  chartCard:        { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 6 }, default: {} }), elevation: 3 },
  chartHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  chartIconBadge:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chartTitle:       { fontSize: 14, fontWeight: '700', color: '#111827' },
  chartSubtitle:    { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  zBadge:           { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  zBadgeText:       { fontSize: 12, fontWeight: '700' },
  statusBar:        { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 10, borderLeftWidth: 3, marginBottom: 10 },
  statusBarText:    { fontSize: 12, fontWeight: '600', flex: 1 },
  legend:           { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  legendItem:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLine:       { width: 18, height: 2.5, borderRadius: 2 },
  legendDot:        { width: 9, height: 9, borderRadius: 4.5 },
  legendText:       { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  tapHint:          { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  sourceRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  sourceText:       { flex: 1, fontSize: 10, color: '#9CA3AF', fontStyle: 'italic' },
  empty:            { backgroundColor: '#F9FAFB', borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  emptyIconCircle:  { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:       { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText:        { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
  emptyInner:       { padding: 20, alignItems: 'center', gap: 8 },
  emptyInnerText:   { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
});

const tt = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:        { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 }, android: { elevation: 6 }, default: {} }), elevation: 10 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:       { fontSize: 15, fontWeight: '700', color: '#111827' },
  closeBtn:    { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  row:         { flexDirection: 'row', gap: 12, marginBottom: 12 },
  col:         { flex: 1, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 10 },
  colLabel:    { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginBottom: 4 },
  colValue:    { fontSize: 18, fontWeight: '800', color: '#111827' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 12, marginBottom: 8 },
  statusText:  { fontSize: 13, fontWeight: '700' },
  notes:       { fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 18 },
});