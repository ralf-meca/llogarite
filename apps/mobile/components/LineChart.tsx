import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import type { ChartPoint } from '../lib/productPrices';

type LineChartProps = {
  points: ChartPoint[];
  width?: number;
  height?: number;
  color?: string;
};

function pickLabelIndices(count: number): number[] {
  if (count <= 1) {
    return count === 1 ? [0] : [];
  }
  if (count <= 5) {
    return Array.from({ length: count }, (_, index) => index);
  }
  return Array.from(new Set([0, Math.floor((count - 1) / 2), count - 1]));
}

export function LineChart({ points, width = 300, height = 200, color = '#2563eb' }: LineChartProps) {
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

  return (
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
        <Circle key={index} cx={coord.x} cy={coord.y} r={3} fill={color} />
      ))}
      {labelIndices.map((index) => (
        <SvgText key={index} x={coords[index].x} y={height - 6} fontSize={10} fill="#6b7280" textAnchor="middle">
          {points[index].label}
        </SvgText>
      ))}
    </Svg>
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
});
