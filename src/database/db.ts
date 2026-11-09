import * as SQLite from 'expo-sqlite';
import {
  DEFAULT_TOPIC_MASTERY,
  DIFFICULTY_PROFILES,
  parseTopicMastery,
  updateSkillModelAfterAttempt,
} from '../ai/localMathAIModel';
import {
  CalculusProblem,
  CalculusTopicKey,
  DrillHistory,
  DrillStatus,
  SkillDifficulty,
  ThemeMode,
  UserProgress,
} from '../types';

const DATABASE_NAME = 'daily_calculus_drill.db';
const SCHEMA_VERSION = 5;

let dbInstance: SQLite.SQLiteDatabase | null = null;
let appliedSchemaVersion = 0;

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

async function safeAddColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  columnDef: string
): Promise<void> {
  try {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`);
  } catch {
    // Column already exists
  }
}

/**
 * Opens and initializes the SQLite database with required schema migrations.
 * Ensures migrations execute even across Expo Fast Refresh cycles.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  if (appliedSchemaVersion < SCHEMA_VERSION) {
    const db = dbInstance;
    const defaultMasteryJson = JSON.stringify(DEFAULT_TOPIC_MASTERY);

    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_level INTEGER NOT NULL DEFAULT 1,
        streak INTEGER NOT NULL DEFAULT 0,
        last_attempt_date TEXT,
        notification_hour INTEGER NOT NULL DEFAULT 7,
        notification_minute INTEGER NOT NULL DEFAULT 0,
        selected_difficulty TEXT NOT NULL DEFAULT 'BEGINNER',
        skill_rating INTEGER NOT NULL DEFAULT 800,
        topic_mastery_json TEXT NOT NULL DEFAULT '${defaultMasteryJson}',
        hide_onboarding_modal INTEGER NOT NULL DEFAULT 0,
        theme_mode TEXT NOT NULL DEFAULT 'DARK'
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
        hint TEXT,
        ai_reasoning TEXT,
        difficulty TEXT,
        topic_key TEXT
      );
    `);

    await safeAddColumn(
      db,
      'user_progress',
      "selected_difficulty TEXT NOT NULL DEFAULT 'BEGINNER'"
    );
    await safeAddColumn(
      db,
      'user_progress',
      'skill_rating INTEGER NOT NULL DEFAULT 800'
    );
    await safeAddColumn(
      db,
      'user_progress',
      `topic_mastery_json TEXT NOT NULL DEFAULT '${defaultMasteryJson}'`
    );
    await safeAddColumn(
      db,
      'user_progress',
      'hide_onboarding_modal INTEGER NOT NULL DEFAULT 0'
    );
    await safeAddColumn(
      db,
      'user_progress',
      "theme_mode TEXT NOT NULL DEFAULT 'DARK'"
    );
    await safeAddColumn(db, 'drill_history', 'ai_reasoning TEXT');
    await safeAddColumn(db, 'drill_history', 'difficulty TEXT');
    await safeAddColumn(db, 'drill_history', 'topic_key TEXT');

    await db.runAsync(
      `INSERT OR IGNORE INTO user_progress (
        id,
        current_level,
        streak,
        last_attempt_date,
        notification_hour,
        notification_minute,
        selected_difficulty,
        skill_rating,
        topic_mastery_json
      ) VALUES (1, 1, 0, NULL, 7, 0, 'BEGINNER', 800, ?);`,
      [defaultMasteryJson]
    );

    appliedSchemaVersion = SCHEMA_VERSION;
  }

  return dbInstance;
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
      selected_difficulty: 'BEGINNER',
      skill_rating: 800,
      topic_mastery_json: JSON.stringify(DEFAULT_TOPIC_MASTERY),
      hide_onboarding_modal: 0,
      theme_mode: 'DARK',
    };
  }

  return {
    ...row,
    current_level: Number(row.current_level ?? 1),
    streak: Number(row.streak ?? 0),
    notification_hour: Number(row.notification_hour ?? 7),
    notification_minute: Number(row.notification_minute ?? 0),
    selected_difficulty:
      (row.selected_difficulty as SkillDifficulty) || 'BEGINNER',
    skill_rating: Number(row.skill_rating ?? 800),
    topic_mastery_json:
      row.topic_mastery_json || JSON.stringify(DEFAULT_TOPIC_MASTERY),
    hide_onboarding_modal: Number(row.hide_onboarding_modal ?? 0),
    theme_mode: (row.theme_mode as ThemeMode) === 'LIGHT' ? 'LIGHT' : 'DARK',
  };
}

/**
 * Evaluates day rollover rules on app startup or foreground.
 */
export async function reconcileDailyRollover(
  todayDate: string = getLocalDateString()
): Promise<UserProgress> {
  const db = await getDatabase();
  const initialProgress = await getUserProgress();

  // If the user already solved their daily drill on last_attempt_date (streak > 0)
  // and later tapped "New AI Q" for extra practice leaving that row PENDING,
  // restore that row to SOLVED before expiring unfinished prior days.
  if (
    initialProgress.last_attempt_date &&
    initialProgress.last_attempt_date < todayDate &&
    initialProgress.streak > 0
  ) {
    await db.runAsync(
      `UPDATE drill_history
       SET status = 'SOLVED'
       WHERE date = ? AND status = 'PENDING';`,
      [initialProgress.last_attempt_date]
    );
  }

  await db.runAsync(
    `UPDATE drill_history
     SET status = 'FAILED'
     WHERE date < ? AND status = 'PENDING';`,
    [todayDate]
  );

  const progress = await getUserProgress();

  if (progress.last_attempt_date) {
    const diff = getDayDifference(progress.last_attempt_date, todayDate);
    if (diff > 1) {
      await db.runAsync(`UPDATE user_progress SET streak = 0 WHERE id = 1;`);
      return await getUserProgress();
    }

    if (diff === 1) {
      const lastDrill = await getDrillByDate(progress.last_attempt_date);
      if (lastDrill && lastDrill.status !== 'SOLVED') {
        await db.runAsync(`UPDATE user_progress SET streak = 0 WHERE id = 1;`);
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
  if (!row) return null;
  return {
    ...row,
    attempts_used: Number(row.attempts_used ?? 0),
    duration_seconds: Number(row.duration_seconds ?? 0),
  };
}

/**
 * Creates or returns today's drill record in the database.
 */
export async function getOrCreateDailyDrill(params: {
  date: string;
  problem: CalculusProblem;
}): Promise<DrillHistory> {
  const existing = await getDrillByDate(params.date);
  if (existing) {
    return existing;
  }

  const db = await getDatabase();
  const { problem } = params;

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
      hint,
      ai_reasoning,
      difficulty,
      topic_key
    ) VALUES (?, ?, ?, ?, '', 'PENDING', NULL, 0, 0, ?, ?, ?, ?, ?);`,
    [
      params.date,
      problem.level,
      problem.problemLatex,
      problem.correctAnswer,
      problem.category,
      problem.hint,
      problem.aiReasoning,
      problem.difficulty,
      problem.topicKey,
    ]
  );

  const created = await getDrillByDate(params.date);
  if (!created) {
    throw new Error('Failed to create daily drill record');
  }
  return created;
}

/**
 * Replaces today's active drill with a newly synthesized AI problem
 * and resets attempts_used = 0 and status = 'PENDING'.
 */
export async function replaceDailyDrillWithAIProblem(params: {
  date: string;
  problem: CalculusProblem;
}): Promise<DrillHistory> {
  const db = await getDatabase();
  const { problem } = params;

  const existing = await getDrillByDate(params.date);
  if (existing) {
    await db.runAsync(
      `UPDATE drill_history
       SET level = ?,
           problem_latex = ?,
           correct_answer = ?,
           user_answer = '',
           status = 'PENDING',
           solved_at = NULL,
           attempts_used = 0,
           duration_seconds = 0,
           category = ?,
           hint = ?,
           ai_reasoning = ?,
           difficulty = ?,
           topic_key = ?
       WHERE date = ?;`,
      [
        problem.level,
        problem.problemLatex,
        problem.correctAnswer,
        problem.category,
        problem.hint,
        problem.aiReasoning,
        problem.difficulty,
        problem.topicKey,
        params.date,
      ]
    );
  } else {
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
        hint,
        ai_reasoning,
        difficulty,
        topic_key
      ) VALUES (?, ?, ?, ?, '', 'PENDING', NULL, 0, 0, ?, ?, ?, ?, ?);`,
      [
        params.date,
        problem.level,
        problem.problemLatex,
        problem.correctAnswer,
        problem.category,
        problem.hint,
        problem.aiReasoning,
        problem.difficulty,
        problem.topicKey,
      ]
    );
  }

  const updated = await getDrillByDate(params.date);
  if (!updated) {
    throw new Error('Failed to replace daily drill');
  }
  return updated;
}

/**
 * Updates the user's selected difficulty experience tier and adjusts base level/rating accordingly.
 */
export async function updateSelectedDifficulty(
  difficulty: SkillDifficulty
): Promise<UserProgress> {
  const db = await getDatabase();
  const progress = await getUserProgress();
  const profile = DIFFICULTY_PROFILES[difficulty];

  const updatedRating = Math.round(
    progress.skill_rating * 0.35 + profile.baseRating * 0.65
  );

  await db.runAsync(
    `UPDATE user_progress
     SET selected_difficulty = ?,
         skill_rating = ?
     WHERE id = 1;`,
    [difficulty, updatedRating]
  );

  return await getUserProgress();
}

/**
 * Records a user attempt and updates the Local AI Skill & Mastery model.
 * - Attempt 1 wrong -> attempts_used = 1, status = 'PENDING' (2 attempts left)
 * - Attempt 2 wrong -> attempts_used = 2, status = 'PENDING' (1 attempt left)
 * - Attempt 3 wrong (or Give Up) -> attempts_used = 3, status = 'FAILED' (0 attempts left)
 */
export async function recordDrillAttempt(params: {
  date: string;
  userAnswer: string;
  isCorrect: boolean;
  giveUp?: boolean;
  durationSeconds: number;
  currentAttemptsUsed?: number;
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

  const progressBefore = await getUserProgress();
  const currentMastery = parseTopicMastery(progressBefore.topic_mastery_json);
  const topicKey: CalculusTopicKey =
    (currentDrill.topic_key as CalculusTopicKey) || 'polynomial';

  const baseAttempts =
    params.currentAttemptsUsed !== undefined
      ? params.currentAttemptsUsed
      : Number(currentDrill.attempts_used ?? 0);

  const nextAttempts = params.giveUp
    ? Math.max(baseAttempts, 3)
    : baseAttempts + 1;

  const nowIso = new Date().toISOString();
  const alreadySolvedToday =
    progressBefore.last_attempt_date === params.date &&
    progressBefore.streak > 0;

  if (params.isCorrect) {
    const { nextRating, nextMastery } = updateSkillModelAfterAttempt({
      currentRating: progressBefore.skill_rating,
      currentMastery,
      topicKey,
      isCorrect: true,
      attemptsUsed: nextAttempts,
      durationSeconds: params.durationSeconds,
    });

    await db.runAsync(
      `UPDATE drill_history
       SET user_answer = ?,
           status = 'SOLVED',
           solved_at = ?,
           attempts_used = ?,
           duration_seconds = ?
       WHERE date = ?;`,
      [
        params.userAnswer,
        nowIso,
        nextAttempts,
        params.durationSeconds,
        params.date,
      ]
    );

    const nextStreak = alreadySolvedToday
      ? progressBefore.streak
      : progressBefore.streak + 1;

    await db.runAsync(
      `UPDATE user_progress
       SET current_level = current_level + 1,
           streak = ?,
           last_attempt_date = ?,
           skill_rating = ?,
           topic_mastery_json = ?
       WHERE id = 1;`,
      [nextStreak, params.date, nextRating, JSON.stringify(nextMastery)]
    );
  } else if (params.giveUp || nextAttempts >= 3) {
    const finalStatus: DrillStatus = 'FAILED';
    const { nextRating, nextMastery } = updateSkillModelAfterAttempt({
      currentRating: progressBefore.skill_rating,
      currentMastery,
      topicKey,
      isCorrect: false,
      attemptsUsed: nextAttempts,
      durationSeconds: params.durationSeconds,
    });

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

    // If the user already solved today's daily drill, failing an extra bonus question
    // adjusts their AI Skill Rating without wiping the daily streak they already earned today.
    const nextStreakOnFail = alreadySolvedToday ? progressBefore.streak : 0;

    await db.runAsync(
      `UPDATE user_progress
       SET streak = ?,
           last_attempt_date = ?,
           skill_rating = ?,
           topic_mastery_json = ?
       WHERE id = 1;`,
      [nextStreakOnFail, params.date, nextRating, JSON.stringify(nextMastery)]
    );
  } else {
    // Attempts 1 or 2 wrong: keep status = 'PENDING' and increment attempts_used
    await db.runAsync(
      `UPDATE drill_history
       SET user_answer = ?,
           status = 'PENDING',
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
 * Persists the "Do not show again" onboarding popup preference in SQLite.
 */
export async function updateOnboardingPreference(
  hideModal: boolean
): Promise<UserProgress> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE user_progress
     SET hide_onboarding_modal = ?
     WHERE id = 1;`,
    [hideModal ? 1 : 0]
  );
  return await getUserProgress();
}

/**
 * Updates the user's preferred theme mode ('DARK' or 'LIGHT') in SQLite.
 */
export async function updateThemePreference(
  themeMode: ThemeMode
): Promise<UserProgress> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE user_progress
     SET theme_mode = ?
     WHERE id = 1;`,
    [themeMode]
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
  const defaultMasteryJson = JSON.stringify(DEFAULT_TOPIC_MASTERY);
  await db.runAsync(`DELETE FROM drill_history;`);
  await db.runAsync(
    `UPDATE user_progress
     SET current_level = 1,
         streak = 0,
         last_attempt_date = NULL,
         selected_difficulty = 'BEGINNER',
         skill_rating = 800,
         topic_mastery_json = ?
     WHERE id = 1;`,
    [defaultMasteryJson]
  );
  return await getUserProgress();
}
