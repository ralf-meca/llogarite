import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CURRENCIES, type Currency } from '../lib/currency';
import { colors, radius } from '../lib/theme';

type CurrencySwitchProps = {
  value: Currency;
  onValueChange: (value: Currency) => void;
};

// The same two-sided pill as the language switch, between lek and euros.
export function CurrencySwitch({ value, onValueChange }: CurrencySwitchProps) {
  return (
    <View style={styles.wrapper}>
      {CURRENCIES.map((currency) => {
        const isActive = currency === value;
        return (
          <Pressable
            key={currency}
            style={[styles.option, isActive && styles.optionActive]}
            onPress={() => onValueChange(currency)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{currency}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  option: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  optionActive: {
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  optionTextActive: {
    color: colors.white,
  },
});
