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
  updateSelectedDifficulty,
} from '../database/db';
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
  topicMastery: TopicMasteryMap;
  todayDrill: DrillHistory | null;
  todayProblem: CalculusProblem | null;
  history: DrillHistory[];
  elapsedSeconds: number;
  submitAnswer: (rawInput: string) => Promise<SubmitOutcome>;
  giveUpToday: () => Promise<void>;
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

  const sessionStartRef = useRef<number>(Date.now());
  const loadedDateRef = useRef<string | null>(null);

  const loadAndSyncDailyState = useCallback(async () => {
    try {
      setIsLoading(true);
      const todayDate = getLocalDateString();
      loadedDateRef.current = todayDate;

      // 1. Reconcile any missed days or expired pending drills
      const currentProgress = await reconcileDailyRollover(todayDate);
      setProgress(currentProgress);

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

      setTodayDrill(drillRow);
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
  }, [todayDrill]);

  const submitAnswer = useCallback(
    async (rawInput: string): Promise<SubmitOutcome> => {
      if (!todayDrill || !todayProblem) {
        throw new Error('Daily drill is not loaded yet.');
      }

      const verification = verifyCalculusAnswer(
        rawInput,
        todayProblem.correctAnswer
      );

      // Empty or syntax-invalid input does not consume one of the 3 attempts
      if (
        !rawInput.trim() ||
        verification.errorMessage?.startsWith('Invalid syntax')
      ) {
        return {
          verification,
          statusAfterAttempt: todayDrill.status,
          attemptsRemaining: Math.max(0, 3 - todayDrill.attempts_used),
        };
      }

      const { updatedDrill, updatedProgress } = await recordDrillAttempt({
        date: todayDrill.date,
        userAnswer: rawInput.trim(),
        isCorrect: verification.isCorrect,
        durationSeconds: Math.max(1, elapsedSeconds),
      });

      setTodayDrill(updatedDrill);
      setProgress(updatedProgress);

      const allHistory = await getAllDrillHistory();
      setHistory(allHistory);

      // If level increased on solve, update the scheduled notification text for tomorrow
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
        attemptsRemaining: Math.max(0, 3 - updatedDrill.attempts_used),
      };
    },
    [todayDrill, todayProblem, elapsedSeconds]
  );

  const giveUpToday = useCallback(async (): Promise<void> => {
    if (!todayDrill) return;

    const { updatedDrill, updatedProgress } = await recordDrillAttempt({
      date: todayDrill.date,
      userAnswer: todayDrill.user_answer || 'GAVE UP',
      isCorrect: false,
      giveUp: true,
      durationSeconds: Math.max(1, elapsedSeconds),
    });

    setTodayDrill(updatedDrill);
    setProgress(updatedProgress);

    const allHistory = await getAllDrillHistory();
    setHistory(allHistory);
  }, [todayDrill, elapsedSeconds]);

  const changeDifficulty = useCallback(
    async (difficulty: SkillDifficulty): Promise<void> => {
      const updatedProgress = await updateSelectedDifficulty(difficulty);
      setProgress(updatedProgress);

      const todayDate = getLocalDateString();
      const mastery = parseTopicMastery(updatedProgress.topic_mastery_json);

      // Synthesize a new personalized problem matching the user's newly selected experience tier
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

      const updatedDrill = await replaceDailyDrillWithAIProblem({
        date: todayDate,
        problem: newAIProblem,
      });

      setTodayDrill(updatedDrill);
      setTodayProblem(newAIProblem);
      setElapsedSeconds(0);
      sessionStartRef.current = Date.now();

      const allHistory = await getAllDrillHistory();
      setHistory(allHistory);
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

    const updatedDrill = await replaceDailyDrillWithAIProblem({
      date: todayDate,
      problem: newAIProblem,
    });

    setTodayDrill(updatedDrill);
    setTodayProblem(newAIProblem);
    setElapsedSeconds(0);
    sessionStartRef.current = Date.now();

    const allHistory = await getAllDrillHistory();
    setHistory(allHistory);
  }, [progress, history]);

  const updateReminderSchedule = useCallback(
    async (hour: number, minute: number): Promise<void> => {
      const updated = await updateNotificationTime(hour, minute);
      setProgress(updated);
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

  const resetProgressData = useCallback(async (): Promise<void> => {
    await resetAllProgress();
    await loadAndSyncDailyState();
  }, [loadAndSyncDailyState]);

  const topicMastery = parseTopicMastery(progress.topic_mastery_json);

  return (
    <DrillContext.Provider
      value={{
        isLoading,
        progress,
        topicMastery,
        todayDrill,
        todayProblem,
        history,
        elapsedSeconds,
        submitAnswer,
        giveUpToday,
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
