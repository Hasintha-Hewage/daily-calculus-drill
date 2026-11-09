import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDrill } from '../context/DrillContext';

interface HowToPlayModalProps {
  visible: boolean;
  initialDoNotShowAgain: boolean;
  onClose: (doNotShowAgain: boolean) => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  visible,
  initialDoNotShowAgain,
  onClose,
}) => {
  const { themeColors } = useDrill();
  const [doNotShowAgain, setDoNotShowAgain] = useState<boolean>(
    initialDoNotShowAgain
  );

  useEffect(() => {
    setDoNotShowAgain(initialDoNotShowAgain);
  }, [initialDoNotShowAgain, visible]);

  const handleClose = () => {
    onClose(doNotShowAgain);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
        >
          {/* Top Header with Title & Top-Right Close Button */}
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <View style={styles.titleIconBadge}>
                <Ionicons
                  name="book-outline"
                  size={20}
                  color={themeColors.primaryText}
                />
              </View>
              <Text
                style={[styles.modalTitle, { color: themeColors.textPrimary }]}
              >
                How to Play 📐
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.closeIconButton,
                {
                  backgroundColor: themeColors.innerBox,
                  borderColor: themeColors.border,
                },
              ]}
              onPress={handleClose}
              activeOpacity={0.7}
              accessibilityLabel="Close guide"
            >
              <Ionicons
                name="close"
                size={22}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
          >
            {/* Step 1: How the App Works */}
            <View
              style={[
                styles.stepCard,
                {
                  backgroundColor: themeColors.innerBox,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <View style={styles.stepHeader}>
                <Ionicons
                  name="calendar-outline"
                  size={19}
                  color={themeColors.accentBlue}
                />
                <Text
                  style={[styles.stepTitle, { color: themeColors.textPrimary }]}
                >
                  1. Daily Calculus Habit
                </Text>
              </View>
              <Text
                style={[styles.stepText, { color: themeColors.textSecondary }]}
              >
                Every morning at 07:00 AM (customizable in Settings), you receive
                a fresh derivative or indefinite integral puzzle. Solve it daily
                to build your streak!
              </Text>
            </View>

            {/* Step 2: How to Play & 3-Attempt Rule */}
            <View
              style={[
                styles.stepCard,
                {
                  backgroundColor: themeColors.innerBox,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <View style={styles.stepHeader}>
                <Ionicons name="trophy-outline" size={19} color="#FBBF24" />
                <Text
                  style={[styles.stepTitle, { color: themeColors.textPrimary }]}
                >
                  2. How to Play & Level Up
                </Text>
              </View>
              <Text
                style={[styles.stepText, { color: themeColors.textSecondary }]}
              >
                • Type your math answer using the{' '}
                <Text
                  style={[styles.highlight, { color: themeColors.textPrimary }]}
                >
                  Quick-Insert Toolbar
                </Text>{' '}
                (e.g.,{' '}
                <Text style={[styles.code, { color: themeColors.accentBlue }]}>
                  3*x^2
                </Text>{' '}
                or{' '}
                <Text style={[styles.code, { color: themeColors.accentBlue }]}>
                  x^2 + C
                </Text>{' '}
                for integrals).{'\n'}• You get{' '}
                <Text
                  style={[styles.highlight, { color: themeColors.textPrimary }]}
                >
                  3 attempts
                </Text>{' '}
                per question.{'\n'}•{' '}
                <Text style={styles.successText}>Solving</Text> advances you to
                the next{' '}
                <Text
                  style={[styles.highlight, { color: themeColors.textPrimary }]}
                >
                  Level (+1)
                </Text>{' '}
                and grows your{' '}
                <Text
                  style={[styles.highlight, { color: themeColors.textPrimary }]}
                >
                  Streak 🔥
                </Text>
                .{'\n'}• <Text style={styles.dangerText}>Failing 3 attempts</Text>{' '}
                reveals the canonical answer and keeps you at your current level.
              </Text>
            </View>

            {/* Step 3: Adjust Difficulty & Local AI */}
            <View
              style={[
                styles.stepCard,
                {
                  backgroundColor: themeColors.innerBox,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <View style={styles.stepHeader}>
                <Ionicons
                  name="sparkles-outline"
                  size={19}
                  color={themeColors.primaryText}
                />
                <Text
                  style={[styles.stepTitle, { color: themeColors.textPrimary }]}
                >
                  3. Adjust Difficulty (Local AI)
                </Text>
              </View>
              <Text
                style={[styles.stepText, { color: themeColors.textSecondary }]}
              >
                • Select your experience level anytime at the top of the screen:{' '}
                <Text
                  style={[styles.highlight, { color: themeColors.textPrimary }]}
                >
                  Beginner, Intermediate, Advanced, or Master
                </Text>
                .{'\n'}• The on-device{' '}
                <Text
                  style={[styles.highlight, { color: themeColors.textPrimary }]}
                >
                  Local AI Model
                </Text>{' '}
                tracks your Skill Elo and automatically generates questions
                targeting your weakest topics.{'\n'}• Tap{' '}
                <Text
                  style={[styles.highlight, { color: themeColors.textPrimary }]}
                >
                  &quot;New AI Q&quot;
                </Text>{' '}
                anytime to practice extra AI-generated problems!
              </Text>
            </View>
          </ScrollView>

          {/* Footer: "Do not show again" checkbox + Confirm Button */}
          <View
            style={[styles.footer, { borderTopColor: themeColors.border }]}
          >
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setDoNotShowAgain((prev) => !prev)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.checkboxBox,
                  {
                    backgroundColor: themeColors.innerBox,
                    borderColor: themeColors.textMuted,
                  },
                  doNotShowAgain && {
                    backgroundColor: themeColors.primary,
                    borderColor: themeColors.primary,
                  },
                ]}
              >
                {doNotShowAgain && (
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                )}
              </View>
              <Text
                style={[
                  styles.checkboxLabel,
                  { color: themeColors.textSecondary },
                ]}
              >
                Do not show again on startup
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.gotItButton,
                { backgroundColor: themeColors.primary },
              ]}
              onPress={handleClose}
              activeOpacity={0.85}
            >
              <Text style={styles.gotItButtonText}>Got It, Let&apos;s Play!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '86%',
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  closeIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    marginBottom: 14,
  },
  stepCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  stepTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  stepText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
  },
  highlight: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  code: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  successText: {
    color: '#34D399',
    fontWeight: '700',
  },
  dangerText: {
    color: '#F87171',
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingVertical: 4,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#64748B',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkboxLabel: {
    color: '#E2E8F0',
    fontSize: 13.5,
    fontWeight: '600',
  },
  gotItButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
