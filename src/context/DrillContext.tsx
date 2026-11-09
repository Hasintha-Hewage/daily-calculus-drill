import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  DEFAULT_TOPIC_MASTERY,
  parseTopicMastery,
} from '../ai/localMathAIModel';
import {
  exportDatabaseBackup,
  getAllDrillHistory,
  getLocalDateString,
  getOrCreateDailyDrill,
  reconcileDailyRollover,
  recordDrillAttempt,
  replaceDailyDrillWithAIProblem,
  resetAllProgress,
  updateNotificationTime,
  updateOnboardingPreference,
  updateSelectedDifficulty,
  updateThemePreference,
} from '../database/db';
import { getThemePalette, ThemePalette } from '../theme/colors';
import {
  requestNotificationPermissions,
  scheduleDailyDrillNotification,
} from '../services/notificationService';
import {
  CalculusProblem,
  CalculusTopicKey,
  DrillHistory,
  ProblemCategory,
  SkillDifficulty,
  ThemeMode,
  TopicMasteryMap,
  UserProgress,
  VerificationResult,
} from '../types';
import { verifyCalculusAnswer } from '../utils/mathVerifier';
import { generateDailyProblem } from '../utils/problemGenerator';

interface SubmitOutcome {
  verification: VerificationResult;
  statusAfterAttempt: DrillHistory['status'];
  attemptsRemaining: number;
}

interface DrillContextValue {
  isLoading: boolean;
  progress: UserProgress;
  themeMode: ThemeMode;
  themeColors: ThemePalette;
  topicMastery: TopicMasteryMap;
  todayDrill: DrillHistory | null;
  todayProblem: CalculusProblem | null;
  history: DrillHistory[];
  elapsedSeconds: number;
  isHelpModalVisible: boolean;
  openHelpModal: () => void;
  closeHelpModal: (doNotShowAgain: boolean) => Promise<void>;
  changeThemeMode: (mode: ThemeMode) => Promise<void>;
  submitAnswer: (rawInput: string) => Promise<SubmitOutcome>;
  giveUpToday: () => Promise<void>;
  retryCurrentProblem: () => Promise<void>;
  changeDifficulty: (difficulty: SkillDifficulty) => Promise<void>;
  generateNewAIProblem: () => Promise<void>;
  updateReminderSchedule: (hour: number, minute: number) => Promise<void>;
  exportBackupJson: () => Promise<string>;
  resetProgressData: () => Promise<void>;
  refreshState: () => Promise<void>;
}

const DEFAULT_PROGRESS: UserProgress = {
  id: 1,
  current_level: 1,
  streak: 0,
  last_attempt_date: null,
  notification_hour: 7,
  notification_minute: 0,
  selected_difficulty: 'BEGINNER',
  skill_rating: 800,
  topic_mastery_json: JSON.stringify(DEFAULT_TOPIC_MASTERY),
  hide_onboarding_modal: 0,
  theme_mode: 'DARK',
};

const DrillContext = createContext<DrillContextValue | undefined>(undefined);

/**
 * Reconstructs a CalculusProblem object from a persisted DrillHistory row
 * so reloads preserve the exact AI-generated question and answer.
 */
function buildProblemFromDrillRow(
  row: DrillHistory,
  fallbackProblem: CalculusProblem
): CalculusProblem {
  const isIntegral = row.problem_latex.includes('\\int');
  return {
    level: row.level,
    type: isIntegral ? 'INTEGRAL' : 'DERIVATIVE',
    category: (row.category as ProblemCategory) || fallbackProblem.category,
    topicKey: (row.topic_key as CalculusTopicKey) || fallbackProblem.topicKey,
    difficulty: (row.difficulty as SkillDifficulty) || fallbackProblem.difficulty,
    complexityScore: fallbackProblem.complexityScore,
    promptText: isIntegral
      ? 'Evaluate the indefinite integral:'
      : 'Find the derivative with respect to x:',
    problemLatex: row.problem_latex,
    correctAnswer: row.correct_answer,
    correctAnswerLatex: row.correct_answer.replace(/\*/g, ''),
    requiresConstantC: isIntegral,
    hint: row.hint || fallbackProblem.hint,
    aiReasoning: row.ai_reasoning || fallbackProblem.aiReasoning,
  };
}

export const DrillProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);
  const [todayDrill, setTodayDrill] = useState<DrillHistory | null>(null);
  const [todayProblem, setTodayProblem] = useState<CalculusProblem | null>(null);
  const [history, setHistory] = useState<DrillHistory[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState<boolean>(false);

  const sessionStartRef = useRef<number>(Date.now());
  const loadedDateRef = useRef<string | null>(null);
  const hasShownInitialHelpRef = useRef<boolean>(false);

  const loadAndSyncDailyState = useCallback(async () => {
    try {
      setIsLoading(true);
      const todayDate = getLocalDateString();
      loadedDateRef.current = todayDate;

      // 1. Reconcile any missed days or expired pending drills
      const currentProgress = await reconcileDailyRollover(todayDate);
      setProgress(currentProgress);

      if (
        !hasShownInitialHelpRef.current &&
        Number(currentProgress.hide_onboarding_modal ?? 0) === 0
      ) {
        hasShownInitialHelpRef.current = true;
        setIsHelpModalVisible(true);
      }

      const allHistory = await getAllDrillHistory();
      const mastery = parseTopicMastery(currentProgress.topic_mastery_json);

      // 2. Ask the Local AI Model to synthesize today's personalized problem
      const aiProblem = generateDailyProblem(
        currentProgress.current_level,
        todayDate,
        {
          difficulty: currentProgress.selected_difficulty,
          skillRating: currentProgress.skill_rating,
          mastery,
          recentHistory: allHistory,
        }
      );

      // 3. Get or create today's row in drill_history
      const drillRow = await getOrCreateDailyDrill({
        date: todayDate,
        problem: aiProblem,
      });

      const activeProblem = buildProblemFromDrillRow(drillRow, aiProblem);

      setTodayDrill({ ...drillRow });
      setTodayProblem(activeProblem);
      setElapsedSeconds(drillRow.duration_seconds ?? 0);
      sessionStartRef.current = Date.now();

      // 4. Refresh full chronological history
      const refreshedHistory = await getAllDrillHistory();
      setHistory(refreshedHistory);

      // 5. Request permissions and ensure daily 07:00 AM (or custom time) notification is scheduled
      await requestNotificationPermissions();
      await scheduleDailyDrillNotification({
        currentLevel: currentProgress.current_level,
        hour: currentProgress.notification_hour,
        minute: currentProgress.notification_minute,
      });
    } catch (error) {
      console.error('Failed to initialize Daily Calculus Drill:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAndSyncDailyState();

    // Re-check date rollover when app returns to the foreground on a new calendar day
    const sub = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          nextState === 'active' &&
          loadedDateRef.current !== null &&
          loadedDateRef.current !== getLocalDateString()
        ) {
          loadAndSyncDailyState();
        }
      }
    );

    return () => {
      sub.remove();
    };
  }, [loadAndSyncDailyState]);

  // Live timer while today's drill is still PENDING
  useEffect(() => {
    if (!todayDrill || todayDrill.status !== 'PENDING') {
      return;
    }

    const baseSeconds = todayDrill.duration_seconds ?? 0;
    sessionStartRef.current = Date.now();

    const timer = setInterval(() => {
      const delta = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setElapsedSeconds(baseSeconds + delta);
    }, 1000);

    return () => clearInterval(timer);
  }, [todayDrill?.status, todayDrill?.date]);

  const submitAnswer = useCallback(
    async (rawInput: string): Promise<SubmitOutcome> => {
      if (!todayDrill || !todayProblem) {
        throw new Error('Daily drill is not loaded yet.');
      }

      const currentUsed = Number(todayDrill.attempts_used ?? 0);

      // Only empty input is ignored
      if (!rawInput.trim()) {
        return {
          verification: {
            isCorrect: false,
            normalizedUserAnswer: '',
            errorMessage: 'Please enter an expression before submitting.',
          },
          statusAfterAttempt: todayDrill.status,
          attemptsRemaining: Math.max(0, 3 - currentUsed),
        };
      }

      const verification = verifyCalculusAnswer(
        rawInput,
        todayProblem.correctAnswer
      );

      // Compute deterministic next attempt count (1 -> 2 -> 3)
      const nextAttempts = currentUsed + 1;
      const nextStatus: DrillHistory['status'] = verification.isCorrect
        ? 'SOLVED'
        : nextAttempts >= 3
        ? 'FAILED'
        : 'PENDING';

      // Immediately update UI state so the attempt counter & dots always respond
      const optimisticDrill: DrillHistory = {
        ...todayDrill,
        user_answer: rawInput.trim(),
        attempts_used: nextAttempts,
        status: nextStatus,
        duration_seconds: Math.max(1, elapsedSeconds),
      };
      setTodayDrill(optimisticDrill);

      try {
        const { updatedDrill, updatedProgress } = await recordDrillAttempt({
          date: todayDrill.date,
          userAnswer: rawInput.trim(),
          isCorrect: verification.isCorrect,
          durationSeconds: Math.max(1, elapsedSeconds),
          currentAttemptsUsed: currentUsed,
        });

        setTodayDrill({ ...updatedDrill });
        setProgress({ ...updatedProgress });

        const allHistory = await getAllDrillHistory();
        setHistory(allHistory);

        if (verification.isCorrect) {
          await scheduleDailyDrillNotification({
            currentLevel: updatedProgress.current_level,
            hour: updatedProgress.notification_hour,
            minute: updatedProgress.notification_minute,
          });
        }

        return {
          verification,
          statusAfterAttempt: updatedDrill.status,
          attemptsRemaining: Math.max(
            0,
            3 - Number(updatedDrill.attempts_used ?? nextAttempts)
          ),
        };
      } catch (err) {
        console.warn('DB attempt update fallback:', err);
        return {
          verification,
          statusAfterAttempt: nextStatus,
          attemptsRemaining: Math.max(0, 3 - nextAttempts),
        };
      }
    },
    [todayDrill, todayProblem, elapsedSeconds]
  );

  const giveUpToday = useCallback(async (): Promise<void> => {
    if (!todayDrill) return;

    const currentUsed = Number(todayDrill.attempts_used ?? 0);
    setTodayDrill({
      ...todayDrill,
      user_answer: todayDrill.user_answer || 'GAVE UP',
      attempts_used: Math.max(currentUsed, 3),
      status: 'FAILED',
    });

    try {
      const { updatedDrill, updatedProgress } = await recordDrillAttempt({
        date: todayDrill.date,
        userAnswer: todayDrill.user_answer || 'GAVE UP',
        isCorrect: false,
        giveUp: true,
        durationSeconds: Math.max(1, elapsedSeconds),
        currentAttemptsUsed: currentUsed,
      });

      setTodayDrill({ ...updatedDrill });
      setProgress({ ...updatedProgress });

      const allHistory = await getAllDrillHistory();
      setHistory(allHistory);
    } catch (err) {
      console.warn('Give up DB fallback:', err);
    }
  }, [todayDrill, elapsedSeconds]);

  const retryCurrentProblem = useCallback(async (): Promise<void> => {
    if (!todayProblem) return;
    const todayDate = getLocalDateString();

    const resetRow: DrillHistory = {
      id: todayDrill?.id ?? 1,
      date: todayDate,
      level: todayProblem.level,
      problem_latex: todayProblem.problemLatex,
      correct_answer: todayProblem.correctAnswer,
      user_answer: '',
      status: 'PENDING',
      solved_at: null,
      attempts_used: 0,
      duration_seconds: 0,
      category: todayProblem.category,
      hint: todayProblem.hint,
      ai_reasoning: todayProblem.aiReasoning,
      difficulty: todayProblem.difficulty,
      topic_key: todayProblem.topicKey,
    };
    setTodayDrill(resetRow);
    setElapsedSeconds(0);
    sessionStartRef.current = Date.now();

    try {
      const updatedDrill = await replaceDailyDrillWithAIProblem({
        date: todayDate,
        problem: todayProblem,
      });
      setTodayDrill({ ...updatedDrill });
      const allHistory = await getAllDrillHistory();
      setHistory(allHistory);
    } catch (err) {
      console.warn('Retry problem DB fallback:', err);
    }
  }, [todayDrill, todayProblem]);

  const changeDifficulty = useCallback(
    async (difficulty: SkillDifficulty): Promise<void> => {
      const todayDate = getLocalDateString();
      try {
        const updatedProgress = await updateSelectedDifficulty(difficulty);
        setProgress({ ...updatedProgress });

        const mastery = parseTopicMastery(updatedProgress.topic_mastery_json);
        const newAIProblem = generateDailyProblem(
          updatedProgress.current_level,
          todayDate,
          {
            difficulty,
            skillRating: updatedProgress.skill_rating,
            mastery,
            recentHistory: history,
            customSeed: `${todayDate}-${difficulty}-${Date.now()}`,
          }
        );

        setTodayProblem(newAIProblem);
        const updatedDrill = await replaceDailyDrillWithAIProblem({
          date: todayDate,
          problem: newAIProblem,
        });

        setTodayDrill({ ...updatedDrill });
        setElapsedSeconds(0);
        sessionStartRef.current = Date.now();

        const allHistory = await getAllDrillHistory();
        setHistory(allHistory);
      } catch (err) {
        console.warn('Change difficulty fallback:', err);
      }
    },
    [history]
  );

  const generateNewAIProblem = useCallback(async (): Promise<void> => {
    const todayDate = getLocalDateString();
    const mastery = parseTopicMastery(progress.topic_mastery_json);

    const newAIProblem = generateDailyProblem(
      progress.current_level,
      todayDate,
      {
        difficulty: progress.selected_difficulty,
        skillRating: progress.skill_rating,
        mastery,
        recentHistory: history,
        customSeed: `${todayDate}-${progress.selected_difficulty}-${Date.now()}`,
      }
    );

    setTodayProblem(newAIProblem);
    setElapsedSeconds(0);
    sessionStartRef.current = Date.now();

    try {
      const updatedDrill = await replaceDailyDrillWithAIProblem({
        date: todayDate,
        problem: newAIProblem,
      });
      setTodayDrill({ ...updatedDrill });
      const allHistory = await getAllDrillHistory();
      setHistory(allHistory);
    } catch (err) {
      setTodayDrill({
        id: todayDrill?.id ?? 1,
        date: todayDate,
        level: newAIProblem.level,
        problem_latex: newAIProblem.problemLatex,
        correct_answer: newAIProblem.correctAnswer,
        user_answer: '',
        status: 'PENDING',
        solved_at: null,
        attempts_used: 0,
        duration_seconds: 0,
        category: newAIProblem.category,
        hint: newAIProblem.hint,
        ai_reasoning: newAIProblem.aiReasoning,
        difficulty: newAIProblem.difficulty,
        topic_key: newAIProblem.topicKey,
      });
    }
  }, [progress, history, todayDrill]);

  const updateReminderSchedule = useCallback(
    async (hour: number, minute: number): Promise<void> => {
      const updated = await updateNotificationTime(hour, minute);
      setProgress({ ...updated });
      await scheduleDailyDrillNotification({
        currentLevel: updated.current_level,
        hour: updated.notification_hour,
        minute: updated.notification_minute,
      });
    },
    []
  );

  const exportBackupJson = useCallback(async (): Promise<string> => {
    return await exportDatabaseBackup();
  }, []);

  const openHelpModal = useCallback(() => {
    setIsHelpModalVisible(true);
  }, []);

  const closeHelpModal = useCallback(
    async (doNotShowAgain: boolean): Promise<void> => {
      setIsHelpModalVisible(false);
      setProgress((prev) => ({
        ...prev,
        hide_onboarding_modal: doNotShowAgain ? 1 : 0,
      }));
      try {
        const updated = await updateOnboardingPreference(doNotShowAgain);
        setProgress({ ...updated });
      } catch (err) {
        console.warn('Could not save onboarding preference:', err);
      }
    },
    []
  );

  const changeThemeMode = useCallback(
    async (mode: ThemeMode): Promise<void> => {
      setProgress((prev) => ({
        ...prev,
        theme_mode: mode,
      }));
      try {
        const updated = await updateThemePreference(mode);
        setProgress({ ...updated });
      } catch (err) {
        console.warn('Could not save theme preference:', err);
      }
    },
    []
  );

  const resetProgressData = useCallback(async (): Promise<void> => {
    await resetAllProgress();
    await loadAndSyncDailyState();
  }, [loadAndSyncDailyState]);

  const topicMastery = parseTopicMastery(progress.topic_mastery_json);
  const themeMode: ThemeMode =
    progress.theme_mode === 'LIGHT' ? 'LIGHT' : 'DARK';
  const themeColors = getThemePalette(themeMode);

  return (
    <DrillContext.Provider
      value={{
        isLoading,
        progress,
        themeMode,
        themeColors,
        topicMastery,
        todayDrill,
        todayProblem,
        history,
        elapsedSeconds,
        isHelpModalVisible,
        openHelpModal,
        closeHelpModal,
        changeThemeMode,
        submitAnswer,
        giveUpToday,
        retryCurrentProblem,
        changeDifficulty,
        generateNewAIProblem,
        updateReminderSchedule,
        exportBackupJson,
        resetProgressData,
        refreshState: loadAndSyncDailyState,
      }}
    >
      {children}
    </DrillContext.Provider>
  );
};

export function useDrill(): DrillContextValue {
  const ctx = useContext(DrillContext);
  if (!ctx) {
    throw new Error('useDrill must be used within a DrillProvider');
  }
  return ctx;
}
