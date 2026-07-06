import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { formatAmount } from '../lib/formatAmount';
import type { ChartPoint } from '../lib/productPrices';
import { colors } from '../lib/theme';

type LineChartProps = {
  points: ChartPoint[];
  width?: number;
  height?: number;
  color?: string;
};

const HIT_RADIUS = 14;

function pickLabelIndices(count: number): number[] {
  if (count <= 1) {
    return count === 1 ? [0] : [];
  }
  if (count <= 5) {
    return Array.from({ length: count }, (_, index) => index);
  }
  return Array.from(new Set([0, Math.floor((count - 1) / 2), count - 1]));
}

export function LineChart({ points, width = 300, height = 200, color = colors.primary }: LineChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Nuk ka të dhëna për këtë periudhë.</Text>
      </View>
    );
  }

  const paddingX = 16;
  const paddingTop = 16;
  const paddingBottom = 24;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0;

  const coords = points.map((point, index) => {
    const x = paddingX + (points.length > 1 ? index * stepX : chartWidth / 2);
    const y = paddingTop + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
    return { x, y };
  });

  const polylinePoints = coords.map((coord) => `${coord.x},${coord.y}`).join(' ');
  const labelIndices = pickLabelIndices(points.length);

  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const activeCoord = activeIndex !== null ? coords[activeIndex] : null;

  let tooltip: { x: number; y: number; w: number; h: number } | null = null;
  if (activePoint && activeCoord) {
    const valueText = formatAmount(activePoint.value);
    const textWidth = Math.max(valueText.length, activePoint.label.length) * 6.5 + 16;
    const tooltipWidth = Math.max(64, textWidth);
    const tooltipHeight = 36;
    const tooltipX = Math.min(Math.max(activeCoord.x - tooltipWidth / 2, 4), width - tooltipWidth - 4);
    const tooltipY = activeCoord.y - tooltipHeight - 12 >= 0 ? activeCoord.y - tooltipHeight - 12 : activeCoord.y + 12;
    tooltip = { x: tooltipX, y: tooltipY, w: tooltipWidth, h: tooltipHeight };
  }

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Line
          x1={paddingX}
          y1={paddingTop + chartHeight}
          x2={paddingX + chartWidth}
          y2={paddingTop + chartHeight}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
        {coords.length > 1 && <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2} />}
        {coords.map((coord, index) => (
          <Circle key={index} cx={coord.x} cy={coord.y} r={index === activeIndex ? 5 : 3} fill={color} />
        ))}
        {labelIndices.map((index) => (
          <SvgText key={index} x={coords[index].x} y={height - 6} fontSize={10} fill="#6b7280" textAnchor="middle">
            {points[index].label}
          </SvgText>
        ))}
        {tooltip && activePoint && (
          <>
            <Rect x={tooltip.x} y={tooltip.y} width={tooltip.w} height={tooltip.h} rx={8} fill={colors.textDark} />
            <SvgText
              x={tooltip.x + tooltip.w / 2}
              y={tooltip.y + 14}
              fontSize={9}
              fill={colors.primarySubtle}
              textAnchor="middle"
            >
              {activePoint.label}
            </SvgText>
            <SvgText
              x={tooltip.x + tooltip.w / 2}
              y={tooltip.y + 27}
              fontSize={12}
              fontWeight="600"
              fill={colors.white}
              textAnchor="middle"
            >
              {formatAmount(activePoint.value)}
            </SvgText>
          </>
        )}
      </Svg>
      {coords.map((coord, index) => (
        <Pressable
          key={index}
          onPress={() => setActiveIndex((current) => (current === index ? null : index))}
          style={[
            styles.hitTarget,
            { left: coord.x - HIT_RADIUS, top: coord.y - HIT_RADIUS, width: HIT_RADIUS * 2, height: HIT_RADIUS * 2 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
  },
  hitTarget: {
    position: 'absolute',
  },
});
