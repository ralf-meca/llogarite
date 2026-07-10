export type PieSegmentInput = { label: string; total: number };

const PIE_SEGMENT_LIMIT = 6;

export function toPieSegments(items: PieSegmentInput[], otherLabel: string): PieSegmentInput[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.label, (merged.get(item.label) ?? 0) + item.total);
  }

  const sorted = Array.from(merged.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);

  if (sorted.length <= PIE_SEGMENT_LIMIT) {
    return sorted;
  }
  const top = sorted.slice(0, PIE_SEGMENT_LIMIT);
  const rest = sorted.slice(PIE_SEGMENT_LIMIT).reduce((sum, item) => sum + item.total, 0);
  return [...top, { label: otherLabel, total: rest }];
}
