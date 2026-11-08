import { compile, simplify } from 'mathjs';
import { VerificationResult } from '../types';

/**
 * Sanitizes raw user math input or canonical expressions into valid mathjs syntax.
 * Examples:
 *  - "x^2 + C" -> "x^2 + C"
 *  - "\sqrt{x^2 + 4}" -> "sqrt(x^2 + 4)"
 *  - "2x\ln(x)" -> "2*x*log(x)"
 *  - "\sec^2(x)" -> "(sec(x))^2"
 *  - "e^{2x}" -> "e^(2*x)"
 */
export function sanitizeMathExpression(raw: string): string {
  if (!raw) return '';

  let expr = raw.trim();

  // Remove LaTeX spacing commands
  expr = expr.replace(/\\,|\\;|\\!|\\quad/g, '');
  expr = expr.replace(/\\left/g, '').replace(/\\right/g, '');
  expr = expr.replace(/\\cdot/g, '*');

  // Convert \frac{a}{b} to ((a)/(b))
  const fracRegex = /\\frac\{([^{}]+)\}\{([^{}]+)\}/g;
  while (fracRegex.test(expr)) {
    expr = expr.replace(fracRegex, '(($1)/($2))');
  }

  // Convert \sqrt{a} to sqrt(a) and √(a) to sqrt(a)
  expr = expr.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
  expr = expr.replace(/\\sqrt\(([^()]+)\)/g, 'sqrt($1)');
  expr = expr.replace(/√\(([^()]+)\)/g, 'sqrt($1)');
  expr = expr.replace(/√([a-zA-Z0-9]+)/g, 'sqrt($1)');

  // Replace \pi and π with pi
  expr = expr.replace(/\\pi/g, 'pi').replace(/π/g, 'pi');

  // Remove leading backslashes on standard trig/log functions
  expr = expr.replace(/\\(sin|cos|tan|sec|csc|cot|ln|log|sqrt)/g, '$1');

  // Convert trig powers like sin^2(x) or sec^2(x) -> (sin(x))^2
  expr = expr.replace(
    /\b(sin|cos|tan|sec|csc|cot)\^([0-9]+)\(([^()]+)\)/g,
    '(($1($3))^$2)'
  );

  // Convert remaining curly braces { ... } into parentheses ( ... )
  expr = expr.replace(/\{/g, '(').replace(/\}/g, ')');

  // Normalize standalone 'c' to uppercase 'C' when used as constant of integration
  // (avoiding 'cos', 'csc', 'cot', 'sec')
  expr = expr.replace(/(?<![a-zA-Z])c(?![a-zA-Z])/g, 'C');

  // Convert natural log ln(...) to mathjs log(...)
  expr = expr.replace(/\bln\s*\(/g, 'log(');

  // Disambiguate adjacent variables like "xe" -> "x*e"
  expr = expr.replace(/\bxe\b/g, 'x*e');

  return expr.trim();
}

/**
 * Checks whether an expression contains the integration constant 'C'.
 */
export function hasConstantC(sanitizedExpr: string): boolean {
  return /(?<![a-zA-Z])C(?![a-zA-Z])/.test(sanitizedExpr);
}

/**
 * Converts a raw user input string into a clean LaTeX preview string.
 */
export function userInputToLatex(raw: string): string {
  if (!raw.trim()) return '\\text{Enter your answer...}';
  let latex = raw.trim();
  latex = latex.replace(/\*/g, ' \\cdot ');
  latex = latex.replace(/\bsqrt\(([^()]+)\)/g, '\\sqrt{$1}');
  latex = latex.replace(/\bpi\b/g, '\\pi');
  latex = latex.replace(/(?<!\\)\b(sin|cos|tan|sec|csc|cot|ln)\b/g, '\\$1');
  latex = latex.replace(/\^(\([^{}()]+?\))/g, '^{$1}');
  return latex;
}

const TEST_X_VALUES = [0.41, 0.83, 1.27, 1.79, 2.31];
const TEST_C_VALUE = 4.25;

/**
 * Verifies algebraic equivalence between user input and expected canonical answer.
 */
export function verifyCalculusAnswer(
  userRawInput: string,
  expectedCanonicalAnswer: string
): VerificationResult {
  const normalizedUser = sanitizeMathExpression(userRawInput);
  const normalizedExpected = sanitizeMathExpression(expectedCanonicalAnswer);

  if (!normalizedUser) {
    return {
      isCorrect: false,
      normalizedUserAnswer: '',
      errorMessage: 'Please enter a mathematical expression.',
    };
  }

  const expectedNeedsC = hasConstantC(normalizedExpected);
  const userHasC = hasConstantC(normalizedUser);

  // If the problem is an indefinite integral requiring + C, check if the user forgot + C
  if (expectedNeedsC && !userHasC) {
    // Check if adding + C makes their answer right so we can give specific feedback
    const checkWithC = compareExpressions(`${normalizedUser} + C`, normalizedExpected);
    if (checkWithC.equivalent) {
      return {
        isCorrect: false,
        missingConstantC: true,
        normalizedUserAnswer: normalizedUser,
        errorMessage: "Almost there! Don't forget the constant of integration (+ C).",
      };
    }
  }

  const comparison = compareExpressions(normalizedUser, normalizedExpected);
  if (comparison.parseError) {
    return {
      isCorrect: false,
      normalizedUserAnswer: normalizedUser,
      errorMessage: 'Invalid syntax. Check your parentheses and operators.',
    };
  }

  return {
    isCorrect: comparison.equivalent,
    normalizedUserAnswer: normalizedUser,
    errorMessage: comparison.equivalent
      ? undefined
      : 'Not quite equivalent. Double-check your signs and coefficients.',
  };
}

function compareExpressions(
  exprA: string,
  exprB: string
): { equivalent: boolean; parseError: boolean } {
  // 1. Symbolic check via mathjs simplify
  try {
    const diffNode = simplify(`(${exprA}) - (${exprB})`);
    if (diffNode.toString() === '0') {
      return { equivalent: true, parseError: false };
    }
  } catch {
    // Proceed to numerical evaluation or syntax check
  }

  // 2. Multi-point numerical equivalence check
  try {
    const compiledA = compile(exprA);
    const compiledB = compile(exprB);

    let validSamples = 0;

    for (const xVal of TEST_X_VALUES) {
      const scope = { x: xVal, C: TEST_C_VALUE };
      const valA = Number(compiledA.evaluate(scope));
      const valB = Number(compiledB.evaluate(scope));

      if (!Number.isFinite(valA) || !Number.isFinite(valB)) {
        continue;
      }

      validSamples++;
      const delta = Math.abs(valA - valB);
      const tolerance = 1e-6 * Math.max(1, Math.abs(valB));
      if (delta > tolerance) {
        return { equivalent: false, parseError: false };
      }
    }

    if (validSamples >= 3) {
      return { equivalent: true, parseError: false };
    }
    return { equivalent: false, parseError: false };
  } catch {
    return { equivalent: false, parseError: true };
  }
}
