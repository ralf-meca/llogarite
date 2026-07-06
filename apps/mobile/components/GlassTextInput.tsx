import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, radius } from '../lib/theme';

export function GlassTextInput(props: TextInputProps) {
  const [homeSelection, setHomeSelection] = useState<{ start: number; end: number } | undefined>({
    start: 0,
    end: 0,
  });

  const releaseSelection = () => {
    if (homeSelection) {
      setHomeSelection(undefined);
    }
  };

  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      selection={props.selection ?? homeSelection}
      onFocus={(event) => {
        releaseSelection();
        props.onFocus?.(event);
      }}
      onChangeText={(text) => {
        releaseSelection();
        props.onChangeText?.(text);
      }}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card - 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.primaryTint,
    color: colors.textDark,
  },
});
