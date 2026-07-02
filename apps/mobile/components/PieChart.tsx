import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

type PieChartSegment = {
  label: string;
  value: number;
  color: string;
};

type PieChartProps = {
  segments: PieChartSegment[];
  size?: number;
};

const SLICE_STROKE = 'rgba(255,255,255,0.7)';
const SLICE_STROKE_WIDTH = 2;
const SLICE_FILL_OPACITY = 0.88;

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function describeSlice(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

function GlassHighlight({ radius }: { radius: number }) {
  return (
    <>
      <Defs>
        <RadialGradient id="glassHighlight" cx="35%" cy="28%" r="70%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.4} />
          <Stop offset="60%" stopColor="#ffffff" stopOpacity={0.08} />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={radius} cy={radius} r={radius} fill="url(#glassHighlight)" />
      <Circle cx={radius} cy={radius} r={radius - 1} fill="none" stroke={SLICE_STROKE} strokeWidth={SLICE_STROKE_WIDTH} />
    </>
  );
}

export function PieChart({ segments, size = 180 }: PieChartProps) {
  const visible = segments.filter((segment) => segment.value > 0);
  const radius = size / 2;

  if (visible.length === 0) {
    return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} />;
  }

  if (visible.length === 1) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={radius} cy={radius} r={radius} fill={visible[0].color} fillOpacity={SLICE_FILL_OPACITY} />
        <GlassHighlight radius={radius} />
      </Svg>
    );
  }

  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  let angle = -Math.PI / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {visible.map((segment, index) => {
        const sliceAngle = (segment.value / total) * Math.PI * 2;
        const path = describeSlice(radius, radius, radius, angle, angle + sliceAngle);
        angle += sliceAngle;
        return (
          <Path
            key={index}
            d={path}
            fill={segment.color}
            fillOpacity={SLICE_FILL_OPACITY}
            stroke={SLICE_STROKE}
            strokeWidth={SLICE_STROKE_WIDTH}
          />
        );
      })}
      <GlassHighlight radius={radius} />
    </Svg>
  );
}
