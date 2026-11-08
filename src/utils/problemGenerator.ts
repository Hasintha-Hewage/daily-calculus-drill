import { CalculusProblem, ProblemCategory, ProblemType } from '../types';

interface ProblemTemplate {
  type: ProblemType;
  category: ProblemCategory;
  problemLatex: string;
  correctAnswer: string;
  correctAnswerLatex: string;
  requiresConstantC: boolean;
  hint: string;
}

/**
 * Tier 1 (Levels 1 - 5): Power rule derivatives and basic polynomial integrals
 */
const TIER_1_PROBLEMS: ProblemTemplate[] = [
  {
    type: 'DERIVATIVE',
    category: 'Power Rule & Polynomials',
    problemLatex: '\\frac{d}{dx}\\left[x^3\\right]',
    correctAnswer: '3*x^2',
    correctAnswerLatex: '3x^2',
    requiresConstantC: false,
    hint: 'Apply the power rule: d/dx[x^n] = n*x^(n-1).',
  },
  {
    type: 'INTEGRAL',
    category: 'Power Rule & Polynomials',
    problemLatex: '\\int 2x \\, dx',
    correctAnswer: 'x^2 + C',
    correctAnswerLatex: 'x^2 + C',
    requiresConstantC: true,
    hint: 'Reverse power rule: ∫ x^n dx = x^(n+1)/(n+1) + C.',
  },
  {
    type: 'DERIVATIVE',
    category: 'Power Rule & Polynomials',
    problemLatex: '\\frac{d}{dx}\\left[4x^2 - 5x + 7\\right]',
    correctAnswer: '8*x - 5',
    correctAnswerLatex: '8x - 5',
    requiresConstantC: false,
    hint: 'Differentiate term-by-term. The derivative of a constant is 0.',
  },
  {
    type: 'INTEGRAL',
    category: 'Power Rule & Polynomials',
    problemLatex: '\\int (3x^2 + 4x) \\, dx',
    correctAnswer: 'x^3 + 2*x^2 + C',
    correctAnswerLatex: 'x^3 + 2x^2 + C',
    requiresConstantC: true,
    hint: 'Integrate each polynomial term separately and add + C.',
  },
  {
    type: 'DERIVATIVE',
    category: 'Power Rule & Polynomials',
    problemLatex: '\\frac{d}{dx}\\left[x^4 - 6x^2\\right]',
    correctAnswer: '4*x^3 - 12*x',
    correctAnswerLatex: '4x^3 - 12x',
    requiresConstantC: false,
    hint: 'Use the power rule on both x^4 and -6x^2.',
  },
];

/**
 * Tier 2 (Levels 6 - 10): Trigonometric, exponential, and logarithmic functions
 */
const TIER_2_PROBLEMS: ProblemTemplate[] = [
  {
    type: 'DERIVATIVE',
    category: 'Trig, Exponential & Log',
    problemLatex: '\\frac{d}{dx}\\left[\\sin(x) + \\cos(x)\\right]',
    correctAnswer: 'cos(x) - sin(x)',
    correctAnswerLatex: '\\cos(x) - \\sin(x)',
    requiresConstantC: false,
    hint: 'Recall d/dx[sin(x)] = cos(x) and d/dx[cos(x)] = -sin(x).',
  },
  {
    type: 'INTEGRAL',
    category: 'Trig, Exponential & Log',
    problemLatex: '\\int e^{2x} \\, dx',
    correctAnswer: '(1/2)*e^(2*x) + C',
    correctAnswerLatex: '\\frac{1}{2}e^{2x} + C',
    requiresConstantC: true,
    hint: 'Divide by the inner linear derivative: ∫ e^(kx) dx = (1/k)e^(kx) + C.',
  },
  {
    type: 'DERIVATIVE',
    category: 'Trig, Exponential & Log',
    problemLatex: '\\frac{d}{dx}\\left[3\\ln(x) + e^x\\right]',
    correctAnswer: '3/x + e^x',
    correctAnswerLatex: '\\frac{3}{x} + e^x',
    requiresConstantC: false,
    hint: 'Recall d/dx[ln(x)] = 1/x and d/dx[e^x] = e^x.',
  },
  {
    type: 'INTEGRAL',
    category: 'Trig, Exponential & Log',
    problemLatex: '\\int \\sin(x) \\, dx',
    correctAnswer: '-cos(x) + C',
    correctAnswerLatex: '-\\cos(x) + C',
    requiresConstantC: true,
    hint: 'Since d/dx[-cos(x)] = sin(x), the antiderivative is -cos(x) + C.',
  },
  {
    type: 'DERIVATIVE',
    category: 'Trig, Exponential & Log',
    problemLatex: '\\frac{d}{dx}\\left[\\tan(x)\\right]',
    correctAnswer: '(sec(x))^2',
    correctAnswerLatex: '\\sec^2(x)',
    requiresConstantC: false,
    hint: 'The derivative of tan(x) is sec(x)^2 (or 1/cos(x)^2).',
  },
];

/**
 * Tier 3 (Levels 11 - 20): Product rule, quotient rule, simple u-substitution
 */
const TIER_3_PROBLEMS: ProblemTemplate[] = [
  {
    type: 'DERIVATIVE',
    category: 'Product, Quotient & U-Sub',
    problemLatex: '\\frac{d}{dx}\\left[x \\cdot e^x\\right]',
    correctAnswer: 'e^x + x*e^x',
    correctAnswerLatex: 'e^x(x + 1)',
    requiresConstantC: false,
    hint: 'Product Rule: (f*g)\' = f\'*g + f*g\'.',
  },
  {
    type: 'INTEGRAL',
    category: 'Product, Quotient & U-Sub',
    problemLatex: '\\int 2x \\cos(x^2) \\, dx',
    correctAnswer: 'sin(x^2) + C',
    correctAnswerLatex: '\\sin(x^2) + C',
    requiresConstantC: true,
    hint: 'Use u-substitution with u = x^2, so du = 2x dx.',
  },
  {
    type: 'DERIVATIVE',
    category: 'Product, Quotient & U-Sub',
    problemLatex: '\\frac{d}{dx}\\left[x \\sin(x)\\right]',
    correctAnswer: 'sin(x) + x*cos(x)',
    correctAnswerLatex: '\\sin(x) + x\\cos(x)',
    requiresConstantC: false,
    hint: 'Product Rule on f(x) = x and g(x) = sin(x).',
  },
  {
    type: 'DERIVATIVE',
    category: 'Product, Quotient & U-Sub',
    problemLatex: '\\frac{d}{dx}\\left[\\frac{e^x}{x}\\right]',
    correctAnswer: '(x*e^x - e^x)/(x^2)',
    correctAnswerLatex: '\\frac{e^x(x - 1)}{x^2}',
    requiresConstantC: false,
    hint: 'Quotient Rule: (f/g)\' = (f\'g - fg\') / g^2.',
  },
  {
    type: 'INTEGRAL',
    category: 'Product, Quotient & U-Sub',
    problemLatex: '\\int \\frac{2x}{x^2 + 1} \\, dx',
    correctAnswer: 'ln(x^2 + 1) + C',
    correctAnswerLatex: '\\ln(x^2 + 1) + C',
    requiresConstantC: true,
    hint: 'Let u = x^2 + 1, then du = 2x dx, giving ∫ (1/u) du = ln(u) + C.',
  },
  {
    type: 'INTEGRAL',
    category: 'Product, Quotient & U-Sub',
    problemLatex: '\\int 3x^2 e^{x^3} \\, dx',
    correctAnswer: 'e^(x^3) + C',
    correctAnswerLatex: 'e^{x^3} + C',
    requiresConstantC: true,
    hint: 'Let u = x^3 so du = 3x^2 dx.',
  },
  {
    type: 'DERIVATIVE',
    category: 'Product, Quotient & U-Sub',
    problemLatex: '\\frac{d}{dx}\\left[x^2 \\ln(x)\\right]',
    correctAnswer: '2*x*ln(x) + x',
    correctAnswerLatex: '2x\\ln(x) + x',
    requiresConstantC: false,
    hint: 'Product Rule: (x^2)\'*ln(x) + x^2*(1/x).',
  },
  {
    type: 'INTEGRAL',
    category: 'Product, Quotient & U-Sub',
    problemLatex: '\\int \\cos(x) e^{\\sin(x)} \\, dx',
    correctAnswer: 'e^(sin(x)) + C',
    correctAnswerLatex: 'e^{\\sin(x)} + C',
    requiresConstantC: true,
    hint: 'Substitute u = sin(x), du = cos(x) dx.',
  },
  {
    type: 'DERIVATIVE',
    category: 'Product, Quotient & U-Sub',
    problemLatex: '\\frac{d}{dx}\\left[\\frac{x}{x + 1}\\right]',
    correctAnswer: '1/((x + 1)^2)',
    correctAnswerLatex: '\\frac{1}{(x + 1)^2}',
    requiresConstantC: false,
    hint: 'Quotient Rule: ((1)(x+1) - x(1)) / (x+1)^2.',
  },
  {
    type: 'INTEGRAL',
    category: 'Product, Quotient & U-Sub',
    problemLatex: '\\int 2\\sin(x)\\cos(x) \\, dx',
    correctAnswer: '(sin(x))^2 + C',
    correctAnswerLatex: '\\sin^2(x) + C',
    requiresConstantC: true,
    hint: 'Let u = sin(x), du = cos(x) dx, so ∫ 2u du = u^2 + C.',
  },
];

/**
 * Tier 4 (Levels 20+): Integration by parts, chain rule composite functions
 */
const TIER_4_PROBLEMS: ProblemTemplate[] = [
  {
    type: 'INTEGRAL',
    category: 'Chain Rule & Integration by Parts',
    problemLatex: '\\int x e^x \\, dx',
    correctAnswer: 'x*e^x - e^x + C',
    correctAnswerLatex: 'xe^x - e^x + C',
    requiresConstantC: true,
    hint: 'Integration by Parts: ∫ u dv = uv - ∫ v du with u = x, dv = e^x dx.',
  },
  {
    type: 'DERIVATIVE',
    category: 'Chain Rule & Integration by Parts',
    problemLatex: '\\frac{d}{dx}\\left[\\sin(x^2 + 1)\\right]',
    correctAnswer: '2*x*cos(x^2 + 1)',
    correctAnswerLatex: '2x\\cos(x^2 + 1)',
    requiresConstantC: false,
    hint: 'Chain Rule: d/dx[f(g(x))] = f\'(g(x)) * g\'(x).',
  },
  {
    type: 'INTEGRAL',
    category: 'Chain Rule & Integration by Parts',
    problemLatex: '\\int x \\cos(x) \\, dx',
    correctAnswer: 'x*sin(x) + cos(x) + C',
    correctAnswerLatex: 'x\\sin(x) + \\cos(x) + C',
    requiresConstantC: true,
    hint: 'Integration by Parts: let u = x and dv = cos(x) dx.',
  },
  {
    type: 'DERIVATIVE',
    category: 'Chain Rule & Integration by Parts',
    problemLatex: '\\frac{d}{dx}\\left[\\ln(\\sin(x))\\right]',
    correctAnswer: 'cos(x)/sin(x)',
    correctAnswerLatex: '\\cot(x)',
    requiresConstantC: false,
    hint: 'Chain Rule: (1/sin(x)) * d/dx[sin(x)] = cos(x)/sin(x) or cot(x).',
  },
  {
    type: 'INTEGRAL',
    category: 'Chain Rule & Integration by Parts',
    problemLatex: '\\int \\ln(x) \\, dx',
    correctAnswer: 'x*ln(x) - x + C',
    correctAnswerLatex: 'x\\ln(x) - x + C',
    requiresConstantC: true,
    hint: 'Integration by Parts with u = ln(x) and dv = 1 dx.',
  },
  {
    type: 'DERIVATIVE',
    category: 'Chain Rule & Integration by Parts',
    problemLatex: '\\frac{d}{dx}\\left[\\sqrt{x^2 + 4}\\right]',
    correctAnswer: 'x/sqrt(x^2 + 4)',
    correctAnswerLatex: '\\frac{x}{\\sqrt{x^2 + 4}}',
    requiresConstantC: false,
    hint: 'Rewrite as (x^2 + 4)^(1/2) and apply the Chain Rule.',
  },
];

/**
 * Simple deterministic string hash so a given (level, date) always selects the same problem.
 */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Generates or selects a calculus problem appropriate for the user's current level.
 */
export function generateDailyProblem(level: number, dateStr?: string): CalculusProblem {
  const safeLevel = Math.max(1, Math.floor(level));
  let template: ProblemTemplate;

  if (safeLevel <= 5) {
    const idx = (safeLevel - 1) % TIER_1_PROBLEMS.length;
    template = TIER_1_PROBLEMS[idx];
  } else if (safeLevel <= 10) {
    const idx = (safeLevel - 6) % TIER_2_PROBLEMS.length;
    template = TIER_2_PROBLEMS[idx];
  } else if (safeLevel <= 20) {
    const idx = (safeLevel - 11) % TIER_3_PROBLEMS.length;
    template = TIER_3_PROBLEMS[idx];
  } else {
    // Level 20+: cycle through Tier 4 or procedurally generate higher-order chain rule / parts problems
    const seed = dateStr ? hashString(`${safeLevel}-${dateStr}`) : safeLevel;
    if (safeLevel > 26 && seed % 2 === 1) {
      const k = ((safeLevel - 20) % 5) + 2; // 2..6
      const n = ((safeLevel - 20) % 3) + 2; // 2..4
      template = {
        type: 'DERIVATIVE',
        category: 'Chain Rule & Integration by Parts',
        problemLatex: `\\frac{d}{dx}\\left[e^{${k}x^{${n}}}\\right]`,
        correctAnswer: `${k * n}*x^${n - 1}*e^(${k}*x^${n})`,
        correctAnswerLatex: `${k * n}x^{${n - 1}}e^{${k}x^{${n}}}`,
        requiresConstantC: false,
        hint: `Chain Rule: multiply e^(${k}x^${n}) by the derivative of the exponent (${k * n}x^${n - 1}).`,
      };
    } else {
      const idx = (safeLevel - 21) % TIER_4_PROBLEMS.length;
      template = TIER_4_PROBLEMS[idx];
    }
  }

  return {
    level: safeLevel,
    type: template.type,
    category: template.category,
    promptText:
      template.type === 'INTEGRAL'
        ? 'Evaluate the indefinite integral:'
        : 'Find the derivative with respect to x:',
    problemLatex: template.problemLatex,
    correctAnswer: template.correctAnswer,
    correctAnswerLatex: template.correctAnswerLatex,
    requiresConstantC: template.requiresConstantC,
    hint: template.hint,
  };
}
