import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, radius } from '../lib/theme';

export const GlassTextInput = forwardRef<TextInput, TextInputProps>(function GlassTextInput(props, ref) {
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
      ref={ref}
      placeholderTextColor={colors.textMuted}
      {...props}
      // A field that selects its text on focus has to be left to it: a caret pinned to
      // the start would take the selection straight back off.
      selection={props.selection ?? (props.selectTextOnFocus ? undefined : homeSelection)}
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
});

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
