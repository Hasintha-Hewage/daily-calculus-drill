import { derivative, simplify } from 'mathjs';
import {
  CalculusProblem,
  CalculusTopicKey,
  DrillHistory,
  ProblemCategory,
  ProblemType,
  SkillDifficulty,
  TopicMasteryMap,
} from '../types';

export interface DifficultyProfileConfig {
  id: SkillDifficulty;
  label: string;
  shortLabel: string;
  description: string;
  baseRating: number;
  allowedTopics: CalculusTopicKey[];
  coeffMax: number;
  powerMax: number;
}

export const DIFFICULTY_PROFILES: Record<SkillDifficulty, DifficultyProfileConfig> = {
  BEGINNER: {
    id: 'BEGINNER',
    label: 'Beginner (Calc Basics)',
    shortLabel: 'Beginner',
    description: 'Power rule derivatives & simple polynomial integrals.',
    baseRating: 800,
    allowedTopics: ['polynomial'],
    coeffMax: 5,
    powerMax: 4,
  },
  INTERMEDIATE: {
    id: 'INTERMEDIATE',
    label: 'Intermediate (Calc I)',
    shortLabel: 'Intermediate',
    description: 'Trigonometric, exponential, logarithmic & multi-term polynomials.',
    baseRating: 1150,
    allowedTopics: ['polynomial', 'trig', 'exponential', 'logarithmic'],
    coeffMax: 8,
    powerMax: 5,
  },
  ADVANCED: {
    id: 'ADVANCED',
    label: 'Advanced (Calc I/II)',
    shortLabel: 'Advanced',
    description: 'Product rule, quotient rule, and u-substitution integrals.',
    baseRating: 1500,
    allowedTopics: ['trig', 'exponential', 'logarithmic', 'product_quotient'],
    coeffMax: 9,
    powerMax: 5,
  },
  MASTER: {
    id: 'MASTER',
    label: 'Master (Calc II Veteran)',
    shortLabel: 'Master',
    description: 'Integration by parts, nested chain rule & composite functions.',
    baseRating: 1850,
    allowedTopics: ['product_quotient', 'chain_by_parts', 'trig', 'exponential'],
    coeffMax: 12,
    powerMax: 6,
  },
};

export const DEFAULT_TOPIC_MASTERY: TopicMasteryMap = {
  polynomial: 0.5,
  trig: 0.4,
  exponential: 0.4,
  logarithmic: 0.4,
  product_quotient: 0.3,
  chain_by_parts: 0.25,
};

const TOPIC_DISPLAY_NAMES: Record<CalculusTopicKey, string> = {
  polynomial: 'Power Rule & Polynomials',
  trig: 'Trigonometric Calculus',
  exponential: 'Exponential Functions',
  logarithmic: 'Logarithmic Calculus',
  product_quotient: 'Product, Quotient & U-Sub',
  chain_by_parts: 'Chain Rule & Integration by Parts',
};

const TOPIC_TO_CATEGORY: Record<CalculusTopicKey, ProblemCategory> = {
  polynomial: 'Power Rule & Polynomials',
  trig: 'Trig, Exponential & Log',
  exponential: 'Trig, Exponential & Log',
  logarithmic: 'Trig, Exponential & Log',
  product_quotient: 'Product, Quotient & U-Sub',
  chain_by_parts: 'Chain Rule & Integration by Parts',
};

/**
 * Parses serialized TopicMasteryMap safely with defaults.
 */
export function parseTopicMastery(jsonStr?: string | null): TopicMasteryMap {
  if (!jsonStr) return { ...DEFAULT_TOPIC_MASTERY };
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      ...DEFAULT_TOPIC_MASTERY,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_TOPIC_MASTERY };
  }
}

/**
 * Deterministic PRNG (Mulberry32) so a given seed produces reproducible parameters.
 */
function createSeededRandom(seedString: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 16777619);
  }
  return function () {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Bayesian Knowledge Tracing + Elo Skill Rating update after a drill attempt.
 */
export function updateSkillModelAfterAttempt(params: {
  currentRating: number;
  currentMastery: TopicMasteryMap;
  topicKey: CalculusTopicKey;
  isCorrect: boolean;
  attemptsUsed: number;
  durationSeconds: number;
}): { nextRating: number; nextMastery: TopicMasteryMap } {
  const {
    currentRating,
    currentMastery,
    topicKey,
    isCorrect,
    attemptsUsed,
    durationSeconds,
  } = params;

  const prevTopicScore = currentMastery[topicKey] ?? 0.4;
  let nextTopicScore = prevTopicScore;
  let ratingDelta = 0;

  if (isCorrect) {
    // Reward faster first-try solves more strongly
    const attemptBonus = attemptsUsed === 1 ? 1.0 : attemptsUsed === 2 ? 0.65 : 0.35;
    const speedFactor = durationSeconds <= 35 ? 1.2 : durationSeconds <= 90 ? 1.0 : 0.8;
    ratingDelta = Math.round(28 * attemptBonus * speedFactor);
    nextTopicScore = Math.min(0.98, prevTopicScore + 0.09 * attemptBonus);
  } else {
    ratingDelta = -22;
    nextTopicScore = Math.max(0.1, prevTopicScore - 0.08);
  }

  const nextRating = Math.max(400, Math.min(2600, currentRating + ratingDelta));
  const nextMastery: TopicMasteryMap = {
    ...currentMastery,
    [topicKey]: Number(nextTopicScore.toFixed(3)),
  };

  return { nextRating, nextMastery };
}

/**
 * Contextual Bandit Policy: selects which calculus topic the user needs most right now
 * based on their chosen difficulty experience tier, topic mastery weights, and recent history.
 */
export function selectTargetTopicWithAI(params: {
  difficulty: SkillDifficulty;
  mastery: TopicMasteryMap;
  recentHistory: DrillHistory[];
  rng: () => number;
}): { selectedTopic: CalculusTopicKey; focusReason: string } {
  const profile = DIFFICULTY_PROFILES[params.difficulty] ?? DIFFICULTY_PROFILES.BEGINNER;
  const allowed = profile.allowedTopics;

  if (allowed.length === 1) {
    const topic = allowed[0];
    const masteryPct = Math.round((params.mastery[topic] ?? 0.5) * 100);
    return {
      selectedTopic: topic,
      focusReason: `Tailored for ${profile.shortLabel} profile (${TOPIC_DISPLAY_NAMES[topic]} mastery: ${masteryPct}%).`,
    };
  }

  // Score each allowed topic: prioritize lower mastery (weakness targeting) + slight exploration noise
  const lastTopic = params.recentHistory[0]?.topic_key;
  let bestTopic = allowed[0];
  let highestUtility = -Infinity;

  for (const topic of allowed) {
    const m = params.mastery[topic] ?? 0.4;
    const weaknessNeed = 1.0 - m; // Higher when mastery is low
    const recencyPenalty = topic === lastTopic ? -0.15 : 0;
    const explorationNoise = params.rng() * 0.25;
    const utility = weaknessNeed * 0.75 + recencyPenalty + explorationNoise;

    if (utility > highestUtility) {
      highestUtility = utility;
      bestTopic = topic;
    }
  }

  const masteryPct = Math.round((params.mastery[bestTopic] ?? 0.4) * 100);
  const focusReason =
    masteryPct < 55
      ? `Targeting ${TOPIC_DISPLAY_NAMES[bestTopic]} (current mastery ${masteryPct}%) to strengthen your ${profile.shortLabel} foundation.`
      : `Advancing ${TOPIC_DISPLAY_NAMES[bestTopic]} fluency (${masteryPct}% mastery) at ${profile.shortLabel} difficulty.`;

  return { selectedTopic: bestTopic, focusReason };
}

/**
 * Uses mathjs symbolic differentiation (`derivative`) to verify or compute derivatives dynamically.
 */
function computeSymbolicDerivative(expr: string): string {
  try {
    return simplify(derivative(expr, 'x')).toString();
  } catch {
    return expr;
  }
}

/**
 * Tiny Local Neuro-Symbolic AI Generator:
 * Synthesizes a personalized calculus question on-device according to:
 *  - User's selected difficulty experience (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `MASTER`)
 *  - User's adaptive `skillRating` and `level`
 *  - User's per-topic mastery weights (`TopicMasteryMap`)
 *  - Symbolic differentiation & algebraic simplification via `mathjs`
 */
export function generatePersonalizedAIProblem(params: {
  level: number;
  difficulty: SkillDifficulty;
  skillRating: number;
  mastery: TopicMasteryMap;
  recentHistory?: DrillHistory[];
  seedKey: string;
}): CalculusProblem {
  const {
    level,
    difficulty,
    skillRating,
    mastery,
    recentHistory = [],
    seedKey,
  } = params;

  const profile = DIFFICULTY_PROFILES[difficulty] ?? DIFFICULTY_PROFILES.BEGINNER;
  const rng = createSeededRandom(`${seedKey}-${difficulty}-${level}`);

  const { selectedTopic, focusReason } = selectTargetTopicWithAI({
    difficulty,
    mastery,
    recentHistory,
    rng,
  });

  // Scale coefficient magnitudes smoothly with skillRating and level
  const ratingScale = Math.max(0, Math.min(1, (skillRating - 600) / 1400));
  const maxCoeff = Math.max(2, Math.round(profile.coeffMax * (0.6 + 0.4 * ratingScale)));
  const maxPower = profile.powerMax;

  let type: ProblemType = rng() < 0.5 ? 'DERIVATIVE' : 'INTEGRAL';
  let problemLatex = '';
  let correctAnswer = '';
  let correctAnswerLatex = '';
  let hint = '';
  let complexityScore = Math.min(100, Math.round(20 + ratingScale * 75));

  if (selectedTopic === 'polynomial') {
    if (type === 'DERIVATIVE') {
      const a = randInt(rng, 2, maxCoeff);
      const n = randInt(rng, 2, maxPower);
      const b = randInt(rng, 1, maxCoeff);
      const c = randInt(rng, 1, 9);

      if (difficulty === 'BEGINNER' && rng() < 0.45) {
        // Single-term power rule derivative computed symbolically by mathjs
        const rawFunc = `${a}*x^${n}`;
        const symbolicDeriv = computeSymbolicDerivative(rawFunc);
        problemLatex = `\\frac{d}{dx}\\left[${a}x^{${n}}\\right]`;
        correctAnswer = symbolicDeriv;
        correctAnswerLatex = `${a * n}x^{${n - 1 === 1 ? '' : n - 1}}`.replace('^{}', '');
        hint = `Power Rule: multiply coefficient ${a} by exponent ${n}, then subtract 1 from the exponent.`;
      } else {
        // Multi-term polynomial derivative computed symbolically by mathjs
        const rawFunc = `${a}*x^${n} + ${b}*x - ${c}`;
        const symbolicDeriv = computeSymbolicDerivative(rawFunc);
        problemLatex = `\\frac{d}{dx}\\left[${a}x^{${n}} + ${b}x - ${c}\\right]`;
        correctAnswer = symbolicDeriv;
        correctAnswerLatex = `${a * n}x^{${n - 1 === 1 ? '' : n - 1}} + ${b}`.replace('^{}', '');
        hint = `Differentiate term-by-term: d/dx[${a}x^${n}] = ${a * n}x^${n - 1}, d/dx[${b}x] = ${b}, and d/dx[${c}] = 0.`;
      }
    } else {
      // Synthesize polynomial integral with clean integer coefficients
      const n = randInt(rng, 1, Math.min(4, maxPower - 1));
      const m = randInt(rng, 1, 4);
      const coeff = m * (n + 1);
      const b = randInt(rng, 1, 6);

      if (difficulty === 'BEGINNER' && rng() < 0.5) {
        problemLatex = `\\int ${coeff}x${n === 1 ? '' : `^{${n}}`} \\, dx`;
        correctAnswer = `${m === 1 ? '' : `${m}*`}x^${n + 1} + C`;
        correctAnswerLatex = `${m === 1 ? '' : m}x^{${n + 1}} + C`;
        hint = `Reverse Power Rule: divide ${coeff} by (${n} + 1) = ${n + 1} to get ${m}x^${n + 1} + C.`;
      } else {
        problemLatex = `\\int (${coeff}x${n === 1 ? '' : `^{${n}}`} + ${b}) \\, dx`;
        correctAnswer = `${m === 1 ? '' : `${m}*`}x^${n + 1} + ${b}*x + C`;
        correctAnswerLatex = `${m === 1 ? '' : m}x^{${n + 1}} + ${b}x + C`;
        hint = `Integrate term-by-term: ∫ ${coeff}x^${n} dx = ${m}x^${n + 1} and ∫ ${b} dx = ${b}x. Don't forget + C!`;
      }
    }
  } else if (selectedTopic === 'trig') {
    const k = randInt(rng, 2, Math.min(6, maxCoeff));
    const a = randInt(rng, 2, 5);
    const variant = randInt(rng, 1, 4);

    if (variant === 1) {
      type = 'DERIVATIVE';
      problemLatex = `\\frac{d}{dx}\\left[${a}\\sin(${k}x)\\right]`;
      correctAnswer = `${a * k}*cos(${k}*x)`;
      correctAnswerLatex = `${a * k}\\cos(${k}x)`;
      hint = `Chain Rule on sin(${k}x): multiply ${a}cos(${k}x) by the inner derivative ${k}.`;
    } else if (variant === 2) {
      type = 'DERIVATIVE';
      problemLatex = `\\frac{d}{dx}\\left[\\cos(${k}x) + ${a}x\\right]`;
      correctAnswer = `-${k}*sin(${k}*x) + ${a}`;
      correctAnswerLatex = `-${k}\\sin(${k}x) + ${a}`;
      hint = `Recall d/dx[cos(${k}x)] = -${k}sin(${k}x) and d/dx[${a}x] = ${a}.`;
    } else if (variant === 3) {
      type = 'INTEGRAL';
      problemLatex = `\\int ${a * k}\\cos(${k}x) \\, dx`;
      correctAnswer = `${a}*sin(${k}*x) + C`;
      correctAnswerLatex = `${a}\\sin(${k}x) + C`;
      hint = `Since d/dx[sin(${k}x)] = ${k}cos(${k}x), divide ${a * k} by ${k} to get ${a}sin(${k}x) + C.`;
    } else {
      type = 'INTEGRAL';
      problemLatex = `\\int ${a * k}\\sin(${k}x) \\, dx`;
      correctAnswer = `-${a}*cos(${k}*x) + C`;
      correctAnswerLatex = `-${a}\\cos(${k}x) + C`;
      hint = `Recall ∫ sin(kx) dx = -(1/k)cos(kx) + C. Dividing ${a * k} by ${k} gives -${a}cos(${k}x) + C.`;
    }
  } else if (selectedTopic === 'exponential') {
    const k = randInt(rng, 2, 6);
    const a = randInt(rng, 1, 4);
    if (type === 'DERIVATIVE') {
      problemLatex = `\\frac{d}{dx}\\left[${a === 1 ? '' : a}e^{${k}x}\\right]`;
      correctAnswer = `${a * k}*e^(${k}*x)`;
      correctAnswerLatex = `${a * k}e^{${k}x}`;
      hint = `Exponential Chain Rule: d/dx[a*e^(kx)] = a*k*e^(kx). Here ${a} * ${k} = ${a * k}.`;
    } else {
      problemLatex = `\\int ${a * k}e^{${k}x} \\, dx`;
      correctAnswer = `${a === 1 ? '' : `${a}*`}e^(${k}*x) + C`;
      correctAnswerLatex = `${a === 1 ? '' : a}e^{${k}x} + C`;
      hint = `Divide the coefficient ${a * k} by the exponent multiplier ${k} to get ${a === 1 ? '' : a}e^(${k}x) + C.`;
    }
  } else if (selectedTopic === 'logarithmic') {
    const a = randInt(rng, 2, 7);
    const b = randInt(rng, 1, 5);
    if (type === 'DERIVATIVE') {
      problemLatex = `\\frac{d}{dx}\\left[${a}\\ln(x) + ${b}x^2\\right]`;
      correctAnswer = `${a}/x + ${2 * b}*x`;
      correctAnswerLatex = `\\frac{${a}}{x} + ${2 * b}x`;
      hint = `Recall d/dx[ln(x)] = 1/x, so d/dx[${a}ln(x)] = ${a}/x, and d/dx[${b}x^2] = ${2 * b}x.`;
    } else {
      problemLatex = `\\int \\frac{${a}}{x} \\, dx`;
      correctAnswer = `${a}*ln(x) + C`;
      correctAnswerLatex = `${a}\\ln(x) + C`;
      hint = `Factor out ${a}: ∫ (${a}/x) dx = ${a}ln(x) + C.`;
    }
  } else if (selectedTopic === 'product_quotient') {
    const n = randInt(rng, 2, 4);
    const a = randInt(rng, 1, 4);
    const variant = randInt(rng, 1, 4);

    if (variant === 1) {
      // Product rule: x^n * e^x
      type = 'DERIVATIVE';
      problemLatex = `\\frac{d}{dx}\\left[x^{${n}} e^x\\right]`;
      correctAnswer = `${n}*x^${n - 1}*e^x + x^${n}*e^x`;
      correctAnswerLatex = `e^x(x^{${n}} + ${n}x^{${n - 1 === 1 ? '' : n - 1}})`.replace('^{}', '');
      hint = `Product Rule: (f*g)' = f'g + fg' with f(x) = x^${n} and g(x) = e^x.`;
    } else if (variant === 2) {
      // Product rule: a*x * sin(x)
      type = 'DERIVATIVE';
      problemLatex = `\\frac{d}{dx}\\left[${a === 1 ? '' : a}x \\sin(x)\\right]`;
      correctAnswer = `${a}*sin(x) + ${a}*x*cos(x)`;
      correctAnswerLatex = `${a === 1 ? '' : a}\\sin(x) + ${a === 1 ? '' : a}x\\cos(x)`;
      hint = `Product Rule on f(x) = ${a}x and g(x) = sin(x): f'g + fg'.`;
    } else if (variant === 3) {
      // U-substitution integral: n*x^(n-1) * cos(x^n)
      type = 'INTEGRAL';
      problemLatex = `\\int ${n}x^{${n - 1 === 1 ? '' : n - 1}} \\cos(x^{${n}}) \\, dx`.replace('^{}', '');
      correctAnswer = `sin(x^${n}) + C`;
      correctAnswerLatex = `\\sin(x^{${n}}) + C`;
      hint = `Use u-substitution: let u = x^${n}, then du = ${n}x^${n - 1} dx, giving ∫ cos(u) du = sin(u) + C.`;
    } else {
      // U-substitution integral: 2*a*x / (x^2 + k)
      type = 'INTEGRAL';
      const k = randInt(rng, 1, 9);
      problemLatex = `\\int \\frac{${2 * a}x}{x^2 + ${k}} \\, dx`;
      correctAnswer = `${a === 1 ? '' : `${a}*`}ln(x^2 + ${k}) + C`;
      correctAnswerLatex = `${a === 1 ? '' : a}\\ln(x^2 + ${k}) + C`;
      hint = `Let u = x^2 + ${k} so du = 2x dx. Then ∫ (${a}/u) du = ${a === 1 ? '' : a}ln(x^2 + ${k}) + C.`;
    }
  } else {
    // chain_by_parts (Master / Advanced)
    const k = randInt(rng, 2, 5);
    const n = randInt(rng, 2, 4);
    const variant = randInt(rng, 1, 4);

    if (variant === 1) {
      // Composite Chain Rule: sin(k*x^n + 1)
      type = 'DERIVATIVE';
      problemLatex = `\\frac{d}{dx}\\left[\\sin(${k}x^{${n}} + 1)\\right]`;
      correctAnswer = `${k * n}*x^${n - 1}*cos(${k}*x^${n} + 1)`;
      correctAnswerLatex = `${k * n}x^{${n - 1 === 1 ? '' : n - 1}}\\cos(${k}x^{${n}} + 1)`.replace('^{}', '');
      hint = `Chain Rule: multiply cos(${k}x^${n} + 1) by the derivative of the inside (${k * n}x^${n - 1}).`;
    } else if (variant === 2) {
      // Composite Exponential Chain Rule: e^(k*x^n)
      type = 'DERIVATIVE';
      problemLatex = `\\frac{d}{dx}\\left[e^{${k}x^{${n}}}\\right]`;
      correctAnswer = `${k * n}*x^${n - 1}*e^(${k}*x^${n})`;
      correctAnswerLatex = `${k * n}x^{${n - 1 === 1 ? '' : n - 1}}e^{${k}x^{${n}}}`.replace('^{}', '');
      hint = `Chain Rule: d/dx[e^u] = u' * e^u with u = ${k}x^${n} and u' = ${k * n}x^${n - 1}.`;
    } else if (variant === 3) {
      // Integration by Parts: ∫ k*x*e^x dx
      type = 'INTEGRAL';
      problemLatex = `\\int ${k}x e^x \\, dx`;
      correctAnswer = `${k}*x*e^x - ${k}*e^x + C`;
      correctAnswerLatex = `${k}xe^x - ${k}e^x + C`;
      hint = `Integration by Parts (∫ u dv = uv - ∫ v du): let u = ${k}x and dv = e^x dx.`;
    } else {
      // Integration by Parts: ∫ x*cos(x) dx or ∫ k*ln(x) dx
      type = 'INTEGRAL';
      problemLatex = `\\int ${k}\\ln(x) \\, dx`;
      correctAnswer = `${k}*x*ln(x) - ${k}*x + C`;
      correctAnswerLatex = `${k}x\\ln(x) - ${k}x + C`;
      hint = `Integration by Parts: let u = ${k}ln(x) and dv = 1 dx, so du = (${k}/x) dx and v = x.`;
    }
  }

  return {
    level,
    type,
    category: TOPIC_TO_CATEGORY[selectedTopic],
    topicKey: selectedTopic,
    difficulty,
    complexityScore,
    promptText:
      type === 'INTEGRAL'
        ? 'Evaluate the indefinite integral:'
        : 'Find the derivative with respect to x:',
    problemLatex,
    correctAnswer,
    correctAnswerLatex,
    requiresConstantC: type === 'INTEGRAL',
    hint,
    aiReasoning: `🤖 Local AI Model (Skill Rating ${skillRating}): ${focusReason}`,
  };
}
