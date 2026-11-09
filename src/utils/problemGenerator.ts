import {
  DEFAULT_TOPIC_MASTERY,
  DIFFICULTY_PROFILES,
  generatePersonalizedAIProblem,
} from '../ai/localMathAIModel';
import {
  CalculusProblem,
  DrillHistory,
  SkillDifficulty,
  TopicMasteryMap,
} from '../types';

/**
 * Infers default difficulty tier from numeric level when not explicitly specified.
 */
export function inferDifficultyFromLevel(level: number): SkillDifficulty {
  if (level <= 5) return 'BEGINNER';
  if (level <= 10) return 'INTERMEDIATE';
  if (level <= 20) return 'ADVANCED';
  return 'MASTER';
}

/**
 * Generates a personalized calculus challenge using the on-device Local Neuro-Symbolic AI Model.
 */
export function generateDailyProblem(
  level: number,
  dateStr?: string,
  options?: {
    difficulty?: SkillDifficulty;
    skillRating?: number;
    mastery?: TopicMasteryMap;
    recentHistory?: DrillHistory[];
    customSeed?: string;
  }
): CalculusProblem {
  const safeLevel = Math.max(1, Math.floor(level));
  const difficulty = options?.difficulty ?? inferDifficultyFromLevel(safeLevel);
  const profile = DIFFICULTY_PROFILES[difficulty];
  const skillRating = options?.skillRating ?? profile.baseRating;
  const mastery = options?.mastery ?? DEFAULT_TOPIC_MASTERY;
  const seedKey = options?.customSeed ?? dateStr ?? `level-${safeLevel}`;

  return generatePersonalizedAIProblem({
    level: safeLevel,
    difficulty,
    skillRating,
    mastery,
    recentHistory: options?.recentHistory ?? [],
    seedKey,
  });
}
