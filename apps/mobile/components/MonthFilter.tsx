import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassButton } from './GlassButton';

type MonthFilterProps = {
  value: string | null;
  onChange: (key: string | null) => void;
};

const MONTH_NAMES = [
  'Janar',
  'Shkurt',
  'Mars',
  'Prill',
  'Maj',
  'Qershor',
  'Korrik',
  'Gusht',
  'Shtator',
  'Tetor',
  'Nëntor',
  'Dhjetor',
];

const YEAR_RANGE = 6;

function currentYear(): number {
  return new Date().getFullYear();
}

function years(): number[] {
  const year = currentYear();
  return Array.from({ length: YEAR_RANGE }, (_, index) => year - index);
}

function parseKey(key: string): { month: number; year: number } {
  const [year, month] = key.split('-').map(Number);
  return { month: month - 1, year };
}

function toKey(month: number, year: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function defaultSelection(value: string | null): { month: number; year: number } {
  if (value) {
    return parseKey(value);
  }
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}

export function MonthFilter({ value, onChange }: MonthFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMonth, setPendingMonth] = useState(() => defaultSelection(value).month);
  const [pendingYear, setPendingYear] = useState(() => defaultSelection(value).year);

  const open = () => {
    const current = defaultSelection(value);
    setPendingMonth(current.month);
    setPendingYear(current.year);
    setIsOpen(true);
  };

  const apply = () => {
    onChange(toKey(pendingMonth, pendingYear));
    setIsOpen(false);
  };

  const clear = () => {
    onChange(null);
    setIsOpen(false);
  };

  const selectedLabel = value ? `${MONTH_NAMES[parseKey(value).month]} ${parseKey(value).year}` : 'Të gjitha muajt';

  return (
    <>
      <Pressable style={styles.trigger} onPress={open}>
        <Ionicons name="calendar-outline" size={14} color="#374151" />
        <Text style={styles.triggerText} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down" size={12} color="#6b7280" />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.title}>Zgjidh muajin</Text>

            <View style={styles.columns}>
              <ScrollView style={styles.column} showsVerticalScrollIndicator={false}>
                {MONTH_NAMES.map((name, index) => (
                  <Pressable
                    key={name}
                    style={[styles.optionRow, pendingMonth === index && styles.optionRowActive]}
                    onPress={() => setPendingMonth(index)}
                  >
                    <Text style={[styles.optionText, pendingMonth === index && styles.optionTextActive]}>{name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.columnDivider} />
              <ScrollView style={styles.column} showsVerticalScrollIndicator={false}>
                {years().map((year) => (
                  <Pressable
                    key={year}
                    style={[styles.optionRow, pendingYear === year && styles.optionRowActive]}
                    onPress={() => setPendingYear(year)}
                  >
                    <Text style={[styles.optionText, pendingYear === year && styles.optionTextActive]}>{year}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.actions}>
              <Pressable onPress={clear}>
                <Text style={styles.clearText}>Të gjitha muajt</Text>
              </Pressable>
              <GlassButton label="Zbato" variant="accent" onPress={apply} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.2)',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  columns: {
    flexDirection: 'row',
    height: 220,
  },
  column: {
    flex: 1,
  },
  columnDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  optionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  optionRowActive: {
    backgroundColor: 'rgba(37,99,235,0.1)',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  optionTextActive: {
    color: '#2563eb',
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
});
