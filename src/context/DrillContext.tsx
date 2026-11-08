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
  exportDatabaseBackup,
  getAllDrillHistory,
  getLocalDateString,
  getOrCreateDailyDrill,
  reconcileDailyRollover,
  recordDrillAttempt,
  resetAllProgress,
  updateNotificationTime,
} from '../database/db';
import {
  requestNotificationPermissions,
  scheduleDailyDrillNotification,
} from '../services/notificationService';
import {
  CalculusProblem,
  DrillHistory,
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
  todayDrill: DrillHistory | null;
  todayProblem: CalculusProblem | null;
  history: DrillHistory[];
  elapsedSeconds: number;
  submitAnswer: (rawInput: string) => Promise<SubmitOutcome>;
  giveUpToday: () => Promise<void>;
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
};

const DrillContext = createContext<DrillContextValue | undefined>(undefined);

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

      // 2. Generate problem for current level (or existing level if today's drill already exists)
      const generatedForCurrent = generateDailyProblem(
        currentProgress.current_level,
        todayDate
      );

      // 3. Get or create today's row in drill_history
      const drillRow = await getOrCreateDailyDrill({
        date: todayDate,
        level: currentProgress.current_level,
        problemLatex: generatedForCurrent.problemLatex,
        correctAnswer: generatedForCurrent.correctAnswer,
        category: generatedForCurrent.category,
        hint: generatedForCurrent.hint,
      });

      // Ensure the displayed problem matches the level stored on today's drill row
      // (in case today was already SOLVED and current_level incremented for tomorrow)
      const activeProblem =
        drillRow.level === generatedForCurrent.level
          ? generatedForCurrent
          : generateDailyProblem(drillRow.level, todayDate);

      setTodayDrill(drillRow);
      setTodayProblem(activeProblem);
      setElapsedSeconds(drillRow.duration_seconds ?? 0);
      sessionStartRef.current = Date.now();

      // 4. Load full chronological history
      const allHistory = await getAllDrillHistory();
      setHistory(allHistory);

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
      if (!rawInput.trim() || verification.errorMessage?.startsWith('Invalid syntax')) {
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

  return (
    <DrillContext.Provider
      value={{
        isLoading,
        progress,
        todayDrill,
        todayProblem,
        history,
        elapsedSeconds,
        submitAnswer,
        giveUpToday,
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
