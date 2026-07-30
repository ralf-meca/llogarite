import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { Buddy } from '../lib/buddiesApi';
import { colors } from '../lib/theme';
import { UserAvatar } from './UserAvatar';

type Person = Pick<Buddy, 'id' | 'name' | 'email' | 'avatarUrl'>;

type MultiPersonAvatarProps = {
  people: Person[];
  size: number;
};

function getInitials(person: Person): string {
  const source = person.name?.trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  }
  return (person.email?.trim().charAt(0) ?? '?').toUpperCase();
}

// 1 person: plain avatar/initials. 2 people: a "/" slash divides the circle in half,
// one initial per side. 3-4 people: a "+" cross divides it into quadrants, one
// initial per quadrant (a 3rd/4th person's quadrant is simply left empty if unused).
export function MultiPersonAvatar({ people, size }: MultiPersonAvatarProps) {
  if (people.length <= 1) {
    return <UserAvatar user={people[0] ?? null} size={size} />;
  }

  const r = size / 2;
  const cx = r;
  const cy = r;
  const labelSize = Math.max(9, Math.round(size * 0.34));

  const renderLabel = (person: Person, x: number, y: number, key: string, scale = 1) => (
    <Text
      key={key}
      style={[
        styles.label,
        {
          left: x - labelSize * 1.2 * scale,
          top: y - (labelSize * scale) / 2,
          width: labelSize * 2.4 * scale,
          fontSize: labelSize * 0.72 * scale,
        },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {getInitials(person)}
    </Text>
  );

  if (people.length === 2) {
    const offset = r * 0.36;
    const topRight = { x: cx + r * Math.cos(-Math.PI / 4), y: cy + r * Math.sin(-Math.PI / 4) };
    const bottomLeft = { x: cx + r * Math.cos((3 * Math.PI) / 4), y: cy + r * Math.sin((3 * Math.PI) / 4) };
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r - 0.5} fill={colors.primaryTint} stroke={colors.primary} strokeWidth={0.5} />
          <Line
            x1={bottomLeft.x}
            y1={bottomLeft.y}
            x2={topRight.x}
            y2={topRight.y}
            stroke={colors.primary}
            strokeWidth={1}
          />
        </Svg>
        {renderLabel(people[0], cx - offset, cy - offset, 'a')}
        {renderLabel(people[1], cx + offset, cy + offset, 'b')}
      </View>
    );
  }

  const offset = r * 0.4;
  const quadrants = [
    { x: cx - offset, y: cy - offset },
    { x: cx + offset, y: cy - offset },
    { x: cx - offset, y: cy + offset },
    { x: cx + offset, y: cy + offset },
  ];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r - 0.5} fill={colors.primaryTint} stroke={colors.primary} strokeWidth={0.5} />
        <Line x1={cx} y1={0} x2={cx} y2={size} stroke={colors.primary} strokeWidth={1} />
        <Line x1={0} y1={cy} x2={size} y2={cy} stroke={colors.primary} strokeWidth={1} />
      </Svg>
      {people
        .slice(0, 4)
        .map((person, index) => renderLabel(person, quadrants[index].x, quadrants[index].y, person.id, 0.72))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
});
