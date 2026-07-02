import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

export function GlassTextInput(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="rgba(31,41,55,0.45)"
      {...props}
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
    backgroundColor: 'rgba(255,255,255,0.35)',
    color: '#1f2937',
  },
});
