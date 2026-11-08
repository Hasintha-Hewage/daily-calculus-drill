import * as SQLite from 'expo-sqlite';
import { DrillHistory, DrillStatus, UserProgress } from '../types';

const DATABASE_NAME = 'daily_calculus_drill.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Returns today's local date in ISO YYYY-MM-DD format.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates calendar day difference between two YYYY-MM-DD strings.
 */
export function getDayDifference(fromDateStr: string, toDateStr: string): number {
  const [fY, fM, fD] = fromDateStr.split('-').map(Number);
  const [tY, tM, tD] = toDateStr.split('-').map(Number);
  const utcFrom = Date.UTC(fY, fM - 1, fD);
  const utcTo = Date.UTC(tY, tM - 1, tD);
  return Math.floor((utcTo - utcFrom) / (1000 * 60 * 60 * 24));
}

/**
 * Opens and initializes the SQLite database with required schema migrations.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_level INTEGER NOT NULL DEFAULT 1,
      streak INTEGER NOT NULL DEFAULT 0,
      last_attempt_date TEXT,
      notification_hour INTEGER NOT NULL DEFAULT 7,
      notification_minute INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS drill_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      level INTEGER NOT NULL,
      problem_latex TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      user_answer TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('PENDING', 'SOLVED', 'FAILED', 'SKIPPED')),
      solved_at TEXT,
      attempts_used INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER,
      category TEXT,
      hint TEXT
    );

    INSERT OR IGNORE INTO user_progress (
      id,
      current_level,
      streak,
      last_attempt_date,
      notification_hour,
      notification_minute
    ) VALUES (1, 1, 0, NULL, 7, 0);
  `);

  dbInstance = db;
  return db;
}

/**
 * Fetches the single-row user_progress record.
 */
export async function getUserProgress(): Promise<UserProgress> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserProgress>(
    'SELECT * FROM user_progress WHERE id = 1;'
  );

  if (!row) {
    return {
      id: 1,
      current_level: 1,
      streak: 0,
      last_attempt_date: null,
      notification_hour: 7,
      notification_minute: 0,
    };
  }
  return row;
}

/**
 * Evaluates day rollover rules on app startup or foreground:
 * 1. Any past record still in 'PENDING' state is marked 'FAILED' (expired without solve).
 * 2. If the user missed yesterday (or failed yesterday), streak resets to 0 while current_level stays unchanged.
 */
export async function reconcileDailyRollover(todayDate: string = getLocalDateString()): Promise<UserProgress> {
  const db = await getDatabase();

  // Mark any uncompleted drills from earlier dates as FAILED
  await db.runAsync(
    `UPDATE drill_history
     SET status = 'FAILED'
     WHERE date < ? AND status = 'PENDING';`,
    [todayDate]
  );

  const progress = await getUserProgress();

  if (progress.last_attempt_date) {
    const diff = getDayDifference(progress.last_attempt_date, todayDate);
    // If more than 1 day has elapsed since the last solved/attempted date, reset streak to 0
    if (diff > 1) {
      await db.runAsync(
        `UPDATE user_progress SET streak = 0 WHERE id = 1;`
      );
      return await getUserProgress();
    }

    // Also verify if the most recent past day was FAILED or SKIPPED
    if (diff === 1) {
      const lastDrill = await getDrillByDate(progress.last_attempt_date);
      if (lastDrill && lastDrill.status !== 'SOLVED') {
        await db.runAsync(
          `UPDATE user_progress SET streak = 0 WHERE id = 1;`
        );
        return await getUserProgress();
      }
    }
  }

  return progress;
}

/**
 * Fetches a drill record for a specific YYYY-MM-DD date.
 */
export async function getDrillByDate(date: string): Promise<DrillHistory | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DrillHistory>(
    'SELECT * FROM drill_history WHERE date = ?;',
    [date]
  );
  return row ?? null;
}

/**
 * Creates or returns today's drill record in the database.
 */
export async function getOrCreateDailyDrill(params: {
  date: string;
  level: number;
  problemLatex: string;
  correctAnswer: string;
  category: string;
  hint: string;
}): Promise<DrillHistory> {
  const existing = await getDrillByDate(params.date);
  if (existing) {
    return existing;
  }

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO drill_history (
      date,
      level,
      problem_latex,
      correct_answer,
      user_answer,
      status,
      solved_at,
      attempts_used,
      duration_seconds,
      category,
      hint
    ) VALUES (?, ?, ?, ?, '', 'PENDING', NULL, 0, 0, ?, ?);`,
    [
      params.date,
      params.level,
      params.problemLatex,
      params.correctAnswer,
      params.category,
      params.hint,
    ]
  );

  const created = await getDrillByDate(params.date);
  if (!created) {
    throw new Error('Failed to create daily drill record');
  }
  return created;
}

/**
 * Records a user attempt.
 * - If solved: marks status = 'SOLVED', increments current_level + 1, increments streak + 1.
 * - If failed on attempt >= 3 or giveUp: marks status = 'FAILED', keeps current_level unchanged, resets streak = 0.
 * - If failed with attempts remaining (< 3): increments attempts_used and stores latest user_answer.
 */
export async function recordDrillAttempt(params: {
  date: string;
  userAnswer: string;
  isCorrect: boolean;
  giveUp?: boolean;
  durationSeconds: number;
}): Promise<{ updatedDrill: DrillHistory; updatedProgress: UserProgress }> {
  const db = await getDatabase();
  const currentDrill = await getDrillByDate(params.date);

  if (!currentDrill) {
    throw new Error(`No drill found for date ${params.date}`);
  }

  if (currentDrill.status === 'SOLVED' || currentDrill.status === 'FAILED') {
    const progress = await getUserProgress();
    return { updatedDrill: currentDrill, updatedProgress: progress };
  }

  const nextAttempts = params.giveUp
    ? Math.max(currentDrill.attempts_used, 3)
    : currentDrill.attempts_used + 1;

  const nowIso = new Date().toISOString();

  if (params.isCorrect) {
    await db.runAsync(
      `UPDATE drill_history
       SET user_answer = ?,
           status = 'SOLVED',
           solved_at = ?,
           attempts_used = ?,
           duration_seconds = ?
       WHERE date = ?;`,
      [params.userAnswer, nowIso, nextAttempts, params.durationSeconds, params.date]
    );

    await db.runAsync(
      `UPDATE user_progress
       SET current_level = current_level + 1,
           streak = streak + 1,
           last_attempt_date = ?
       WHERE id = 1;`,
      [params.date]
    );
  } else if (params.giveUp || nextAttempts >= 3) {
    const finalStatus: DrillStatus = 'FAILED';
    await db.runAsync(
      `UPDATE drill_history
       SET user_answer = ?,
           status = ?,
           solved_at = ?,
           attempts_used = ?,
           duration_seconds = ?
       WHERE date = ?;`,
      [
        params.userAnswer || (params.giveUp ? 'GAVE UP' : ''),
        finalStatus,
        nowIso,
        nextAttempts,
        params.durationSeconds,
        params.date,
      ]
    );

    // Keep current_level unchanged, reset streak to 0
    await db.runAsync(
      `UPDATE user_progress
       SET streak = 0,
           last_attempt_date = ?
       WHERE id = 1;`,
      [params.date]
    );
  } else {
    // Still has attempts left
    await db.runAsync(
      `UPDATE drill_history
       SET user_answer = ?,
           attempts_used = ?,
           duration_seconds = ?
       WHERE date = ?;`,
      [params.userAnswer, nextAttempts, params.durationSeconds, params.date]
    );
  }

  const updatedDrill = await getDrillByDate(params.date);
  const updatedProgress = await getUserProgress();

  return {
    updatedDrill: updatedDrill!,
    updatedProgress,
  };
}

/**
 * Returns all past drill attempts ordered newest first.
 */
export async function getAllDrillHistory(): Promise<DrillHistory[]> {
  const db = await getDatabase();
  return await db.getAllAsync<DrillHistory>(
    'SELECT * FROM drill_history ORDER BY date DESC, id DESC;'
  );
}

/**
 * Updates the user's preferred daily notification time.
 */
export async function updateNotificationTime(
  hour: number,
  minute: number
): Promise<UserProgress> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE user_progress
     SET notification_hour = ?, notification_minute = ?
     WHERE id = 1;`,
    [hour, minute]
  );
  return await getUserProgress();
}

/**
 * Exports the entire database state as a serialized JSON object for manual backup.
 */
export async function exportDatabaseBackup(): Promise<string> {
  const progress = await getUserProgress();
  const history = await getAllDrillHistory();
  return JSON.stringify(
    {
      app: 'Daily Calculus Drill',
      exportedAt: new Date().toISOString(),
      user_progress: progress,
      drill_history: history,
    },
    null,
    2
  );
}

/**
 * Resets all progress and clears history back to Level 1.
 */
export async function resetAllProgress(): Promise<UserProgress> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM drill_history;
    UPDATE user_progress
    SET current_level = 1,
        streak = 0,
        last_attempt_date = NULL
    WHERE id = 1;
  `);
  return await getUserProgress();
}
