import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../lib/theme';

type CodeInputProps = {
  value: string;
  length: number;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
};

// One box per digit, but a single TextInput behind them. Six real inputs would
// mean juggling focus on every keystroke and on backspace, and would break
// paste and the one-time-code autofill, all of which a single field gets for
// free.
export function CodeInput({ value, length, onChangeText, autoFocus, editable = true }: CodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const cells = Array.from({ length }, (_, index) => value[index] ?? '');
  // The cell the next digit lands in, which is the last one once it is full.
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
      {cells.map((digit, index) => {
        const isActive = isFocused && editable && index === activeIndex;
        return (
          <View
            key={index}
            style={[styles.cell, digit !== '' && styles.cellFilled, isActive && styles.cellActive]}
          >
            <Text style={styles.cellText}>{digit}</Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        style={styles.field}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        editable={editable}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        // Lets the OS fill the code straight from the email/SMS it arrived in.
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        // The field covers the boxes, so a tap anywhere on them lands here. The
        // caret is drawn by the boxes instead, and the selection is pinned to
        // the end so a tap in the middle cannot start typing between digits.
        caretHidden
        selection={{ start: value.length, end: value.length }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  cell: {
    flex: 1,
    maxWidth: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card - 4,
    backgroundColor: colors.primaryTint,
  },
  cellFilled: {
    borderColor: colors.primarySubtle,
  },
  cellActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cellText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textDark,
    includeFontPadding: false,
  },
  // Invisible rather than unmounted: it still has to take focus, hold the
  // value and receive a paste.
  field: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    // Android shrinks a zero-opacity field's hit area to its text without this.
    fontSize: 24,
    textAlign: 'center',
    color: 'transparent',
  },
});
