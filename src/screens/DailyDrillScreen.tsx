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
    todayDrill,
    todayProblem,
    elapsedSeconds,
    submitAnswer,
    giveUpToday,
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
          'Out of attempts. Review the solution below or tap "New AI Question" to practice more!'
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header: Level, Timer & Streak Badges */}
        <View style={styles.headerRow}>
          <View style={styles.levelBadge}>
            <Ionicons name="school-outline" size={18} color="#818CF8" />
            <Text style={styles.levelBadgeText}>LEVEL {todayDrill.level}</Text>
          </View>

          <View style={styles.timerChip}>
            <Ionicons name="time-outline" size={16} color="#94A3B8" />
            <Text style={styles.timerText}>{formatDuration(elapsedSeconds)}</Text>
          </View>

          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={18} color="#F59E0B" />
            <Text style={styles.streakBadgeText}>
              {progress.streak} {progress.streak === 1 ? 'DAY' : 'DAYS'}
            </Text>
          </View>
        </View>

        {/* User Skill Experience / Difficulty Selector */}
        <View style={styles.difficultyCard}>
          <View style={styles.difficultyHeaderRow}>
            <View style={styles.difficultyTitleWrap}>
              <Ionicons name="sparkles" size={15} color="#A5B4FC" />
              <Text style={styles.difficultyTitle}>
                YOUR EXPERIENCE LEVEL (LOCAL AI)
              </Text>
            </View>
            <Text style={styles.ratingText}>
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
                    isSelected && styles.diffPillActive,
                  ]}
                  onPress={() => handleSelectDifficulty(diffKey)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.diffPillText,
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
          <View style={styles.aiInsightRow}>
            <Text style={styles.aiReasoningText} numberOfLines={2}>
              {todayProblem.aiReasoning}
            </Text>
            <TouchableOpacity
              style={styles.newAiBtn}
              onPress={handleGenerateNewAI}
              activeOpacity={0.75}
            >
              <Ionicons name="refresh" size={14} color="#38BDF8" />
              <Text style={styles.newAiBtnText}>New AI Q</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category & Date Subheader */}
        <View style={styles.metaRow}>
          <Text style={styles.categoryTag}>{todayProblem.category}</Text>
          <Text style={styles.dateText}>{todayDrill.date}</Text>
        </View>

        {/* Problem LaTeX Card */}
        <View style={styles.problemCard}>
          <Text style={styles.promptLabel}>{todayProblem.promptText}</Text>
          <View style={styles.equationBox}>
            <MathRenderer
              latex={todayProblem.problemLatex}
              fontSize={28}
              color="#F8FAFC"
              height={95}
            />
          </View>

          {/* Attempts Indicator */}
          <View style={styles.attemptsRow}>
            <Text style={styles.attemptsLabel}>Attempts Remaining:</Text>
            <View style={styles.dotsRow}>
              {[1, 2, 3].map((idx) => (
                <View
                  key={idx}
                  style={[
                    styles.attemptDot,
                    idx <= attemptsRemaining
                      ? styles.attemptDotActive
                      : styles.attemptDotSpent,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Hint Accordion */}
        <TouchableOpacity
          style={styles.hintToggle}
          onPress={() => setShowHint((prev) => !prev)}
          activeOpacity={0.75}
        >
          <View style={styles.hintToggleLeft}>
            <Ionicons name="bulb-outline" size={18} color="#FBBF24" />
            <Text style={styles.hintToggleText}>
              {showHint ? 'Hide AI Step-by-Step Hint' : 'Need an AI Hint?'}
            </Text>
          </View>
          <Ionicons
            name={showHint ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#94A3B8"
          />
        </TouchableOpacity>

        {showHint && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>{todayProblem.hint}</Text>
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
            <Text style={styles.inputLabel}>YOUR EXPRESSION</Text>
            <TextInput
              style={[
                styles.mathInput,
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
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {/* Live LaTeX Preview of User Input */}
            {answerInput.trim().length > 0 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewCaption}>Live Preview:</Text>
                <MathRenderer
                  latex={userInputToLatex(answerInput)}
                  fontSize={20}
                  color="#CBD5E1"
                  height={52}
                />
              </View>
            )}

            {/* Error / Warning Message */}
            {feedbackMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#F87171" />
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
              style={styles.submitButton}
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
              <Text style={styles.giveUpButtonText}>
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
                color={todayDrill.status === 'SOLVED' ? '#34D399' : '#F87171'}
              />
              <Text
                style={[
                  styles.resultTitle,
                  {
                    color:
                      todayDrill.status === 'SOLVED' ? '#34D399' : '#F87171',
                  },
                ]}
              >
                {todayDrill.status === 'SOLVED'
                  ? 'Challenge Solved!'
                  : 'Challenge Ended'}
              </Text>
            </View>

            <Text style={styles.resultSubtext}>
              {todayDrill.status === 'SOLVED'
                ? `Awesome work! Your AI Skill Rating is now ${progress.skill_rating} and you advanced to Level ${progress.current_level}.`
                : `Your AI Skill Rating adjusted to ${progress.skill_rating}. Review the canonical answer below or generate another AI puzzle!`}
            </Text>

            <View style={styles.canonicalSolutionBox}>
              <Text style={styles.canonicalLabel}>CANONICAL SOLUTION</Text>
              <MathRenderer
                latex={todayProblem.correctAnswerLatex}
                fontSize={24}
                color="#F8FAFC"
                height={68}
              />
              <Text style={styles.canonicalAscii}>
                Input form: {todayProblem.correctAnswer}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.practiceAnotherBtn}
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
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="trophy" size={38} color="#FBBF24" />
            </View>
            <Text style={styles.modalTitle}>Level Up! 🎉</Text>
            <Text style={styles.modalBody}>
              You solved Level {todayDrill.level} in{' '}
              {formatDuration(todayDrill.duration_seconds ?? elapsedSeconds)}!
            </Text>

            <View style={styles.modalStatsRow}>
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatValue}>
                  Level {progress.current_level}
                </Text>
                <Text style={styles.modalStatLabel}>Next Level</Text>
              </View>
              <View style={styles.modalStatDivider} />
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatValue}>
                  {progress.skill_rating} ⚡
                </Text>
                <Text style={styles.modalStatLabel}>AI Skill Rating</Text>
              </View>
              <View style={styles.modalStatDivider} />
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatValue}>
                  {progress.streak} 🔥
                </Text>
                <Text style={styles.modalStatLabel}>Streak</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
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
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
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
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
    borderWidth: 1,
    borderColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  levelBadgeText: {
    color: '#A5B4FC',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
  },
  timerText: {
    color: '#CBD5E1',
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
    color: '#FCD34D',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  difficultyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  ratingText: {
    color: '#38BDF8',
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
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366F1',
  },
  diffPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  diffPillTextActive: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  aiInsightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiReasoningText: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 11.5,
    lineHeight: 16,
  },
  newAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newAiBtnText: {
    color: '#38BDF8',
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
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  dateText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  problemCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  promptLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  equationBox: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  attemptsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attemptsLabel: {
    color: '#94A3B8',
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
  attemptDotActive: {
    backgroundColor: '#6366F1',
  },
  attemptDotSpent: {
    backgroundColor: '#334155',
  },
  hintToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 10,
  },
  hintToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintToggleText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  hintBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  hintText: {
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 19,
  },
  inputSection: {
    marginTop: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  mathInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#475569',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
  },
  mathInputError: {
    borderColor: '#EF4444',
  },
  previewBox: {
    marginTop: 10,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewCaption: {
    fontSize: 11,
    color: '#64748B',
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
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#6366F1',
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
    color: '#94A3B8',
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
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  canonicalSolutionBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  canonicalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  canonicalAscii: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  practiceAnotherBtn: {
    backgroundColor: '#6366F1',
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
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#F8FAFC',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
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
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  modalStatLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  modalStatDivider: {
    width: 1,
    backgroundColor: '#334155',
  },
  modalCloseBtn: {
    backgroundColor: '#6366F1',
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
