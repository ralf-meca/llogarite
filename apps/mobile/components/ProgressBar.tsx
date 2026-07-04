import { StyleSheet, View } from 'react-native';

type ProgressBarProps = {
  ratio: number;
  height?: number;
};

function colorForRatio(ratio: number): string {
  if (ratio >= 1) {
    return '#dc2626';
  }
  if (ratio >= 0.8) {
    return '#f59e0b';
  }
  return '#10b981';
}

export function ProgressBar({ ratio, height = 10 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(ratio, 1));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            height,
            borderRadius: height / 2,
            backgroundColor: colorForRatio(ratio),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  fill: {
    minWidth: 4,
  },
});
