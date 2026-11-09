import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DIFFICULTY_PROFILES } from '../ai/localMathAIModel';
import { MathKeyboardToolbar } from '../components/MathKeyboardToolbar';
import { MathRenderer } from '../components/MathRenderer';
import { useDrill } from '../context/DrillContext';
import { SkillDifficulty } from '../types';
import { userInputToLatex } from '../utils/mathVerifier';

const DIFFICULTY_OPTIONS: SkillDifficulty[] = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'MASTER',
];

export const DailyDrillScreen: React.FC = () => {
  const {
    isLoading,
    progress,
    themeColors,
    todayDrill,
    todayProblem,
    elapsedSeconds,
    submitAnswer,
    giveUpToday,
    retryCurrentProblem,
    changeDifficulty,
    generateNewAIProblem,
  } = useDrill();

  const [answerInput, setAnswerInput] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerErrorShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 12,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -12,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 55,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleInsertSymbol = (token: string) => {
    setFeedbackMessage(null);
    setAnswerInput((prev) => `${prev}${token}`);
  };

  const handleClearInput = () => {
    setFeedbackMessage(null);
    setAnswerInput('');
  };

  const handleSelectDifficulty = async (diff: SkillDifficulty) => {
    setFeedbackMessage(null);
    setAnswerInput('');
    setShowHint(false);
    await changeDifficulty(diff);
  };

  const handleGenerateNewAI = async () => {
    setFeedbackMessage(null);
    setAnswerInput('');
    setShowHint(false);
    setShowSuccessModal(false);
    await generateNewAIProblem();
  };

  const handleSubmit = async () => {
    if (!todayDrill || todayDrill.status !== 'PENDING') return;

    const outcome = await submitAnswer(answerInput);

    if (outcome.verification.isCorrect) {
      setFeedbackMessage(null);
      setShowSuccessModal(true);
    } else {
      triggerErrorShake();
      const remaining = outcome.attemptsRemaining;
      const baseError =
        outcome.verification.errorMessage || 'Incorrect expression.';
      if (outcome.statusAfterAttempt === 'FAILED') {
        setFeedbackMessage(
          'Out of attempts. Review the solution below or tap "New AI Q" to practice more!'
        );
      } else {
        setFeedbackMessage(
          `${baseError} (${remaining} ${
            remaining === 1 ? 'attempt' : 'attempts'
          } left)`
        );
      }
    }
  };

  const handleGiveUp = async () => {
    if (!todayDrill || todayDrill.status !== 'PENDING') return;
    await giveUpToday();
    setFeedbackMessage(
      'Marked as FAILED. Study the canonical answer below or generate a new AI question!'
    );
  };

  const formatDuration = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  if (isLoading || !todayDrill || !todayProblem) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: themeColors.background },
        ]}
      >
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textMuted }]}>
          Synthesizing Personalized AI Calculus Drill...
        </Text>
      </View>
    );
  }

  const isCompleted =
    todayDrill.status === 'SOLVED' || todayDrill.status === 'FAILED';
  const attemptsRemaining = Math.max(0, 3 - todayDrill.attempts_used);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header: Level, Timer & Streak Badges */}
        <View style={styles.headerRow}>
          <View
            style={[
              styles.levelBadge,
              { borderColor: themeColors.primary },
            ]}
          >
            <Ionicons
              name="school-outline"
              size={18}
              color={themeColors.primaryText}
            />
            <Text
              style={[
                styles.levelBadgeText,
                { color: themeColors.primaryText },
              ]}
            >
              LEVEL {todayDrill.level}
            </Text>
          </View>

          <View
            style={[
              styles.timerChip,
              {
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={themeColors.textMuted}
            />
            <Text
              style={[styles.timerText, { color: themeColors.textSecondary }]}
            >
              {formatDuration(elapsedSeconds)}
            </Text>
          </View>

          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={18} color="#F59E0B" />
            <Text style={styles.streakBadgeText}>
              {progress.streak} {progress.streak === 1 ? 'DAY' : 'DAYS'}
            </Text>
          </View>
        </View>

        {/* User Skill Experience / Difficulty Selector */}
        <View
          style={[
            styles.difficultyCard,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
        >
          <View style={styles.difficultyHeaderRow}>
            <View style={styles.difficultyTitleWrap}>
              <Ionicons
                name="sparkles"
                size={15}
                color={themeColors.primaryText}
              />
              <Text
                style={[
                  styles.difficultyTitle,
                  { color: themeColors.primaryText },
                ]}
              >
                YOUR EXPERIENCE LEVEL (LOCAL AI)
              </Text>
            </View>
            <Text
              style={[styles.ratingText, { color: themeColors.accentBlue }]}
            >
              Skill Elo: {progress.skill_rating}
            </Text>
          </View>

          <View style={styles.difficultyPillsRow}>
            {DIFFICULTY_OPTIONS.map((diffKey) => {
              const cfg = DIFFICULTY_PROFILES[diffKey];
              const isSelected = progress.selected_difficulty === diffKey;
              return (
                <TouchableOpacity
                  key={diffKey}
                  style={[
                    styles.diffPill,
                    {
                      backgroundColor: themeColors.innerBox,
                      borderColor: isSelected
                        ? themeColors.primary
                        : themeColors.border,
                    },
                    isSelected && styles.diffPillActive,
                  ]}
                  onPress={() => handleSelectDifficulty(diffKey)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.diffPillText,
                      {
                        color: isSelected
                          ? themeColors.primaryText
                          : themeColors.textMuted,
                      },
                      isSelected && styles.diffPillTextActive,
                    ]}
                  >
                    {cfg.shortLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* AI Reasoning & Refresh Row */}
          <View
            style={[
              styles.aiInsightRow,
              { backgroundColor: themeColors.innerBox },
            ]}
          >
            <Text
              style={[
                styles.aiReasoningText,
                { color: themeColors.textSecondary },
              ]}
              numberOfLines={2}
            >
              {todayProblem.aiReasoning}
            </Text>
            <TouchableOpacity
              style={[
                styles.newAiBtn,
                { borderColor: themeColors.accentBlue },
              ]}
              onPress={handleGenerateNewAI}
              activeOpacity={0.75}
            >
              <Ionicons
                name="refresh"
                size={14}
                color={themeColors.accentBlue}
              />
              <Text
                style={[
                  styles.newAiBtnText,
                  { color: themeColors.accentBlue },
                ]}
              >
                New AI Q
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category & Date Subheader */}
        <View style={styles.metaRow}>
          <Text style={[styles.categoryTag, { color: themeColors.textMuted }]}>
            {todayProblem.category}
          </Text>
          <Text style={[styles.dateText, { color: themeColors.textMuted }]}>
            {todayDrill.date}
          </Text>
        </View>

        {/* Problem LaTeX Card */}
        <View
          style={[
            styles.problemCard,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
        >
          <Text style={[styles.promptLabel, { color: themeColors.textMuted }]}>
            {todayProblem.promptText}
          </Text>
          <View
            style={[
              styles.equationBox,
              {
                backgroundColor: themeColors.innerBox,
                borderColor: themeColors.border,
              },
            ]}
          >
            <MathRenderer
              latex={todayProblem.problemLatex}
              fontSize={28}
              color={themeColors.mathText}
              height={95}
            />
          </View>

          {/* Attempts Indicator */}
          <View style={styles.attemptsRow}>
            <Text
              style={[styles.attemptsLabel, { color: themeColors.textMuted }]}
            >
              Attempts Remaining: {attemptsRemaining} / 3
            </Text>
            <View style={styles.dotsRow}>
              {[1, 2, 3].map((idx) => (
                <View
                  key={idx}
                  style={[
                    styles.attemptDot,
                    idx <= attemptsRemaining
                      ? { backgroundColor: themeColors.primary }
                      : { backgroundColor: themeColors.border },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Hint Accordion */}
        <TouchableOpacity
          style={[
            styles.hintToggle,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
          onPress={() => setShowHint((prev) => !prev)}
          activeOpacity={0.75}
        >
          <View style={styles.hintToggleLeft}>
            <Ionicons name="bulb-outline" size={18} color="#F59E0B" />
            <Text
              style={[
                styles.hintToggleText,
                { color: themeColors.textPrimary },
              ]}
            >
              {showHint ? 'Hide AI Step-by-Step Hint' : 'Need an AI Hint?'}
            </Text>
          </View>
          <Ionicons
            name={showHint ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={themeColors.textMuted}
          />
        </TouchableOpacity>

        {showHint && (
          <View style={styles.hintBox}>
            <Text
              style={[
                styles.hintText,
                {
                  color:
                    themeColors.mode === 'DARK' ? '#FDE68A' : '#92400E',
                },
              ]}
            >
              {todayProblem.hint}
            </Text>
          </View>
        )}

        {/* Active Input OR Completed Summary */}
        {!isCompleted ? (
          <Animated.View
            style={[
              styles.inputSection,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            <Text style={[styles.inputLabel, { color: themeColors.textMuted }]}>
              YOUR EXPRESSION
            </Text>
            <TextInput
              style={[
                styles.mathInput,
                {
                  backgroundColor: themeColors.card,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
                feedbackMessage ? styles.mathInputError : null,
              ]}
              value={answerInput}
              onChangeText={(text) => {
                setFeedbackMessage(null);
                setAnswerInput(text);
              }}
              placeholder={
                todayProblem.requiresConstantC
                  ? 'e.g., x^2 + C'
                  : 'e.g., 3*x^2'
              }
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {/* Live LaTeX Preview of User Input */}
            {answerInput.trim().length > 0 && (
              <View
                style={[
                  styles.previewBox,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.previewCaption,
                    { color: themeColors.textMuted },
                  ]}
                >
                  Live Preview:
                </Text>
                <MathRenderer
                  latex={userInputToLatex(answerInput)}
                  fontSize={20}
                  color={themeColors.mathText}
                  height={52}
                />
              </View>
            )}

            {/* Error / Warning Message */}
            {feedbackMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errorBannerText}>{feedbackMessage}</Text>
              </View>
            )}

            {/* Quick-Insert Math Symbol Toolbar */}
            <MathKeyboardToolbar
              onInsertSymbol={handleInsertSymbol}
              onClear={handleClearInput}
            />

            {/* Primary Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: themeColors.primary },
              ]}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit Answer</Text>
            </TouchableOpacity>

            {/* Give Up / Show Answer Button */}
            <TouchableOpacity
              style={styles.giveUpButton}
              onPress={handleGiveUp}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.giveUpButtonText,
                  { color: themeColors.textMuted },
                ]}
              >
                Give Up / Show Answer
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View
            style={[
              styles.resultCard,
              todayDrill.status === 'SOLVED'
                ? styles.resultCardSolved
                : styles.resultCardFailed,
            ]}
          >
            <View style={styles.resultHeaderRow}>
              <Ionicons
                name={
                  todayDrill.status === 'SOLVED'
                    ? 'checkmark-done-circle'
                    : 'close-circle'
                }
                size={28}
                color={todayDrill.status === 'SOLVED' ? '#10B981' : '#EF4444'}
              />
              <Text
                style={[
                  styles.resultTitle,
                  {
                    color:
                      todayDrill.status === 'SOLVED' ? '#10B981' : '#EF4444',
                  },
                ]}
              >
                {todayDrill.status === 'SOLVED'
                  ? 'Challenge Solved!'
                  : 'Challenge Ended'}
              </Text>
            </View>

            <Text
              style={[
                styles.resultSubtext,
                { color: themeColors.textSecondary },
              ]}
            >
              {todayDrill.status === 'SOLVED'
                ? `Awesome work! Your AI Skill Rating is now ${progress.skill_rating} and you advanced to Level ${progress.current_level}.`
                : `Your AI Skill Rating adjusted to ${progress.skill_rating}. Review the canonical answer below or generate another AI puzzle!`}
            </Text>

            <View
              style={[
                styles.canonicalSolutionBox,
                {
                  backgroundColor: themeColors.innerBox,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.canonicalLabel,
                  { color: themeColors.textMuted },
                ]}
              >
                CANONICAL SOLUTION
              </Text>
              <MathRenderer
                latex={todayProblem.correctAnswerLatex}
                fontSize={24}
                color={themeColors.mathText}
                height={68}
              />
              <Text
                style={[
                  styles.canonicalAscii,
                  { color: themeColors.textMuted },
                ]}
              >
                Input form: {todayProblem.correctAnswer}
              </Text>
            </View>

            {todayDrill.status === 'FAILED' && (
              <TouchableOpacity
                style={[
                  styles.practiceAnotherBtn,
                  { backgroundColor: '#475569', marginBottom: 10 },
                ]}
                onPress={async () => {
                  setFeedbackMessage(null);
                  setAnswerInput('');
                  await retryCurrentProblem();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <Text style={styles.practiceAnotherBtnText}>
                  Retry This Question (Reset 3 Attempts)
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.practiceAnotherBtn,
                { backgroundColor: themeColors.primary },
              ]}
              onPress={handleGenerateNewAI}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
              <Text style={styles.practiceAnotherBtnText}>
                Generate Next Adaptive AI Problem
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Immediate Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
              },
            ]}
          >
            <View style={styles.modalIconCircle}>
              <Ionicons name="trophy" size={38} color="#FBBF24" />
            </View>
            <Text
              style={[styles.modalTitle, { color: themeColors.textPrimary }]}
            >
              Level Up! 🎉
            </Text>
            <Text
              style={[styles.modalBody, { color: themeColors.textSecondary }]}
            >
              You solved Level {todayDrill.level} in{' '}
              {formatDuration(todayDrill.duration_seconds ?? elapsedSeconds)}!
            </Text>

            <View
              style={[
                styles.modalStatsRow,
                { backgroundColor: themeColors.innerBox },
              ]}
            >
              <View style={styles.modalStatItem}>
                <Text
                  style={[
                    styles.modalStatValue,
                    { color: themeColors.textPrimary },
                  ]}
                >
                  Level {progress.current_level}
                </Text>
                <Text
                  style={[
                    styles.modalStatLabel,
                    { color: themeColors.textMuted },
                  ]}
                >
                  Next Level
                </Text>
              </View>
              <View
                style={[
                  styles.modalStatDivider,
                  { backgroundColor: themeColors.border },
                ]}
              />
              <View style={styles.modalStatItem}>
                <Text
                  style={[
                    styles.modalStatValue,
                    { color: themeColors.textPrimary },
                  ]}
                >
                  {progress.skill_rating} ⚡
                </Text>
                <Text
                  style={[
                    styles.modalStatLabel,
                    { color: themeColors.textMuted },
                  ]}
                >
                  AI Skill Rating
                </Text>
              </View>
              <View
                style={[
                  styles.modalStatDivider,
                  { backgroundColor: themeColors.border },
                ]}
              />
              <View style={styles.modalStatItem}>
                <Text
                  style={[
                    styles.modalStatValue,
                    { color: themeColors.textPrimary },
                  ]}
                >
                  {progress.streak} 🔥
                </Text>
                <Text
                  style={[
                    styles.modalStatLabel,
                    { color: themeColors.textMuted },
                  ]}
                >
                  Streak
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.modalCloseBtn,
                { backgroundColor: themeColors.primary },
              ]}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  levelBadgeText: {
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  streakBadgeText: {
    color: '#D97706',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  difficultyCard: {
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    marginBottom: 14,
  },
  difficultyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  difficultyTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  difficultyTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  difficultyPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  diffPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
  },
  diffPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  diffPillTextActive: {
    fontWeight: '800',
  },
  aiInsightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiReasoningText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  newAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newAiBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryTag: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  problemCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  promptLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  equationBox: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  attemptsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attemptsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  attemptDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  hintToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  hintToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hintBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  inputSection: {
    marginTop: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  mathInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
  },
  mathInputError: {
    borderColor: '#EF4444',
  },
  previewBox: {
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  previewCaption: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  errorBannerText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  submitButton: {
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  giveUpButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giveUpButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  resultCard: {
    marginTop: 8,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  resultCardSolved: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
  },
  resultCardFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
  },
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  resultSubtext: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  canonicalSolutionBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  canonicalLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  canonicalAscii: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  practiceAnotherBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  practiceAnotherBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalStatsRow: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalStatLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  modalStatDivider: {
    width: 1,
  },
  modalCloseBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
