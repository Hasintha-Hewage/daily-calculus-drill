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
  UserProgress,
} from '../types';

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
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

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
      topic_mastery_json TEXT NOT NULL DEFAULT '${defaultMasteryJson}'
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

  // Safe migrations for existing installations
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
      selected_difficulty: 'BEGINNER',
      skill_rating: 800,
      topic_mastery_json: JSON.stringify(DEFAULT_TOPIC_MASTERY),
    };
  }

  return {
    ...row,
    selected_difficulty: (row.selected_difficulty as SkillDifficulty) || 'BEGINNER',
    skill_rating: row.skill_rating ?? 800,
    topic_mastery_json:
      row.topic_mastery_json || JSON.stringify(DEFAULT_TOPIC_MASTERY),
  };
}

/**
 * Evaluates day rollover rules on app startup or foreground:
 * 1. Any past record still in 'PENDING' state is marked 'FAILED' (expired without solve).
 * 2. If the user missed yesterday (or failed yesterday), streak resets to 0 while current_level stays unchanged.
 */
export async function reconcileDailyRollover(
  todayDate: string = getLocalDateString()
): Promise<UserProgress> {
  const db = await getDatabase();

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
  return row ?? null;
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
 * (used when the user switches difficulty tier or requests a new AI problem).
 */
export async function replaceDailyDrillWithAIProblem(params: {
  date: string;
  problem: CalculusProblem;
}): Promise<DrillHistory> {
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
    ) VALUES (?, ?, ?, ?, '', 'PENDING', NULL, 0, 0, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      level = excluded.level,
      problem_latex = excluded.problem_latex,
      correct_answer = excluded.correct_answer,
      user_answer = '',
      status = 'PENDING',
      solved_at = NULL,
      attempts_used = 0,
      duration_seconds = 0,
      category = excluded.category,
      hint = excluded.hint,
      ai_reasoning = excluded.ai_reasoning,
      difficulty = excluded.difficulty,
      topic_key = excluded.topic_key;`,
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

  // Blend current rating toward the selected difficulty tier's target rating
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

  const progressBefore = await getUserProgress();
  const currentMastery = parseTopicMastery(progressBefore.topic_mastery_json);
  const topicKey: CalculusTopicKey =
    (currentDrill.topic_key as CalculusTopicKey) || 'polynomial';

  const nextAttempts = params.giveUp
    ? Math.max(currentDrill.attempts_used, 3)
    : currentDrill.attempts_used + 1;

  const nowIso = new Date().toISOString();

  if (params.isCorrect) {
    // Update AI Skill Rating & Topic Mastery on solve
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

    await db.runAsync(
      `UPDATE user_progress
       SET current_level = current_level + 1,
           streak = streak + 1,
           last_attempt_date = ?,
           skill_rating = ?,
           topic_mastery_json = ?
       WHERE id = 1;`,
      [params.date, nextRating, JSON.stringify(nextMastery)]
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

    // Keep current_level unchanged, reset streak to 0, update AI mastery weights
    await db.runAsync(
      `UPDATE user_progress
       SET streak = 0,
           last_attempt_date = ?,
           skill_rating = ?,
           topic_mastery_json = ?
       WHERE id = 1;`,
      [params.date, nextRating, JSON.stringify(nextMastery)]
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
  const defaultMasteryJson = JSON.stringify(DEFAULT_TOPIC_MASTERY);
  await db.runAsync(
    `DELETE FROM drill_history;`
  );
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
