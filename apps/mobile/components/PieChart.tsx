import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors } from '../lib/theme';

type PieChartSegment = {
  label: string;
  value: number;
  color: string;
};

type PieChartProps = {
  segments: PieChartSegment[];
  size?: number;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
};

const SLICE_STROKE = colors.white;
const SLICE_STROKE_WIDTH = 2;
const EXPLODE_RATIO = 0.08;

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function describeSlice(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

export function PieChart({ segments, size = 180, selectedIndex, onSelectIndex }: PieChartProps) {
  const visible = segments.filter((segment) => segment.value > 0);
  const explodeOffset = size * EXPLODE_RATIO;
  const center = size / 2;
  const radius = center - explodeOffset - 4;

  if (visible.length === 0) {
    return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} />;
  }

  if (visible.length === 1) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={radius} fill={visible[0].color} />
      </Svg>
    );
  }

  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  let angle = -Math.PI / 2;
  const slices = visible.map((segment, index) => {
    const sliceAngle = (segment.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sliceAngle;
    angle = end;
    return { segment, index, start, end };
  });

  const ordered = [...slices].sort((a, b) => (a.index === selectedIndex ? 1 : b.index === selectedIndex ? -1 : 0));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {ordered.map(({ segment, index, start, end }) => {
        const path = describeSlice(center, center, radius, start, end);
        const isSelected = index === selectedIndex;
        const mid = (start + end) / 2;
        const dx = isSelected ? Math.cos(mid) * explodeOffset : 0;
        const dy = isSelected ? Math.sin(mid) * explodeOffset : 0;
        return (
          <G key={segment.label} transform={`translate(${dx}, ${dy})`}>
            <Path
              d={path}
              fill={segment.color}
              stroke={SLICE_STROKE}
              strokeWidth={SLICE_STROKE_WIDTH}
              strokeLinejoin="round"
              onPress={() => onSelectIndex(index)}
            />
          </G>
        );
      })}
    </Svg>
  );
}
