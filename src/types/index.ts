export type DrillStatus = 'PENDING' | 'SOLVED' | 'FAILED' | 'SKIPPED';

export type ThemeMode = 'DARK' | 'LIGHT';

export type SkillDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'MASTER';

export type CalculusTopicKey =
  | 'polynomial'
  | 'trig'
  | 'exponential'
  | 'logarithmic'
  | 'product_quotient'
  | 'chain_by_parts';

export type TopicMasteryMap = Record<CalculusTopicKey, number>;

export type ProblemCategory =
  | 'Power Rule & Polynomials'
  | 'Trig, Exponential & Log'
  | 'Product, Quotient & U-Sub'
  | 'Chain Rule & Integration by Parts';

export type ProblemType = 'DERIVATIVE' | 'INTEGRAL';

/**
 * Single-row table: `user_progress`
 */
export interface UserProgress {
  id: number;
  current_level: number;
  streak: number;
  last_attempt_date: string | null; // YYYY-MM-DD
  notification_hour: number;        // Default 7 (07:00 AM)
  notification_minute: number;      // Default 0
  selected_difficulty: SkillDifficulty; // User-selected experience tier
  skill_rating: number;             // Adaptive Elo-style rating (400 - 2400)
  topic_mastery_json: string;       // JSON string of TopicMasteryMap (0.0 - 1.0 per topic)
  hide_onboarding_modal: number;    // 0 = show on startup, 1 = do not show again
  theme_mode: ThemeMode;            // 'DARK' (default) | 'LIGHT'
}

/**
 * Row model for `drill_history` table
 */
export interface DrillHistory {
  id: number;
  date: string;                     // YYYY-MM-DD
  level: number;
  problem_latex: string;            // e.g., \int 2x \, dx
  correct_answer: string;           // Canonical mathjs expression, e.g., x^2 + C
  user_answer: string;
  status: DrillStatus;
  solved_at: string | null;         // ISO timestamp
  attempts_used: number;            // 0..3
  duration_seconds: number | null;  // Time taken in seconds
  category?: string;
  hint?: string;
  ai_reasoning?: string;            // Why the local AI model selected/generated this problem
  difficulty?: SkillDifficulty;
  topic_key?: CalculusTopicKey;
}

/**
 * Generated calculus challenge from the Local AI Engine
 */
export interface CalculusProblem {
  level: number;
  type: ProblemType;
  category: ProblemCategory;
  topicKey: CalculusTopicKey;
  difficulty: SkillDifficulty;
  complexityScore: number;          // 1 - 100
  promptText: string;               // e.g. "Evaluate the indefinite integral" or "Find the derivative"
  problemLatex: string;             // e.g. "\\int 2x \\, dx"
  correctAnswer: string;            // Canonical simplified expression e.g. "x^2 + C"
  correctAnswerLatex: string;       // Display LaTeX e.g. "x^2 + C"
  requiresConstantC: boolean;       // True for indefinite integrals
  hint: string;                     // Step-by-step rule hint
  aiReasoning: string;              // Personalized explanation of why the AI generated this problem
}

export interface VerificationResult {
  isCorrect: boolean;
  missingConstantC?: boolean;
  normalizedUserAnswer: string;
  errorMessage?: string;
}

export type RootTabParamList = {
  DailyDrill: undefined;
  History: undefined;
  Settings: undefined;
};
