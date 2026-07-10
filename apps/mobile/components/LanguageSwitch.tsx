import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { colors, radius } from '../lib/theme';

const LANGUAGES: { code: 'sq' | 'en'; label: string }[] = [
  { code: 'sq', label: 'ALB' },
  { code: 'en', label: 'ENG' },
];

export function LanguageSwitch() {
  const { language, setLanguage } = useTranslation();

  return (
    <View style={styles.wrapper}>
      {LANGUAGES.map((option) => {
        const isActive = option.code === language;
        return (
          <Pressable
            key={option.code}
            style={[styles.option, isActive && styles.optionActive]}
            onPress={() => setLanguage(option.code)}
            hitSlop={4}
          >
            <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{option.label}</Text>
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
