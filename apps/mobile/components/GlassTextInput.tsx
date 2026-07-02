import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

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
      placeholderTextColor="rgba(31,41,55,0.45)"
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
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    color: '#1f2937',
  },
});
