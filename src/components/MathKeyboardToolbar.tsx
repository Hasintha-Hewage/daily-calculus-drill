import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDrill } from '../context/DrillContext';

export interface MathSymbolToken {
  label: string;
  insertText: string;
  highlight?: boolean;
}

const MATH_TOKENS: MathSymbolToken[] = [
  { label: '+ C', insertText: ' + C', highlight: true },
  { label: 'x', insertText: 'x' },
  { label: '^', insertText: '^' },
  { label: '√()', insertText: 'sqrt(' },
  { label: 'e^x', insertText: 'e^x' },
  { label: 'ln()', insertText: 'ln(' },
  { label: 'sin()', insertText: 'sin(' },
  { label: 'cos()', insertText: 'cos(' },
  { label: 'tan()', insertText: 'tan(' },
  { label: 'sec()', insertText: 'sec(' },
  { label: 'π', insertText: 'pi' },
  { label: '(', insertText: '(' },
  { label: ')', insertText: ')' },
  { label: '/', insertText: '/' },
  { label: '*', insertText: '*' },
  { label: '+', insertText: ' + ' },
  { label: '-', insertText: ' - ' },
];

interface MathKeyboardToolbarProps {
  onInsertSymbol: (token: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export const MathKeyboardToolbar: React.FC<MathKeyboardToolbarProps> = ({
  onInsertSymbol,
  onClear,
  disabled = false,
}) => {
  const { themeColors } = useDrill();

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={[styles.toolbarLabel, { color: themeColors.textMuted }]}>
          QUICK INSERT SYMBOLS
        </Text>
        <TouchableOpacity
          onPress={onClear}
          disabled={disabled}
          style={[
            styles.clearBtn,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
            disabled && styles.disabledBtn,
          ]}
        >
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.scrollContent}
      >
        {MATH_TOKENS.map((item) => (
          <TouchableOpacity
            key={item.label}
            disabled={disabled}
            onPress={() => onInsertSymbol(item.insertText)}
            style={[
              styles.chip,
              {
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
              },
              item.highlight && {
                backgroundColor: 'rgba(99, 102, 241, 0.16)',
                borderColor: themeColors.primary,
              },
              disabled && styles.disabledBtn,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                { color: themeColors.textPrimary },
                item.highlight && {
                  color: themeColors.primaryText,
                  fontWeight: '700',
                },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 10,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  toolbarLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  scrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.45,
  },
});
