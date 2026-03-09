const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;
const WEIRD_SYMBOLS_REGEX = /[\u2600-\u26FF\u2700-\u27BF]/gu;

const COOKIE_LEGAL_PATTERNS = [
  /cookie/i,
  /privacy policy/i,
  /terms of service/i,
  /all rights reserved/i,
  /gdpr/i,
];

const PROMO_PATTERNS = [
  /subscribe/i,
  /sign up/i,
  /buy now/i,
  /limited time/i,
  /sponsored/i,
  /advertis(e|ing|ement)/i,
  /click here/i,
];

const NAV_PATTERNS = [
  /^\s*(home|about|contact|pricing|blog|menu)(\s*[|/>-]\s*\w+){1,}/i,
  /^\s*\w+(\s*[|/>-]\s*\w+){2,}\s*$/,
];

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  return (
    COOKIE_LEGAL_PATTERNS.some((pattern) => pattern.test(trimmed)) ||
    PROMO_PATTERNS.some((pattern) => pattern.test(trimmed)) ||
    NAV_PATTERNS.some((pattern) => pattern.test(trimmed))
  );
}

function cleanLine(line: string): string {
  return line
    .replace(EMOJI_REGEX, "")
    .replace(WEIRD_SYMBOLS_REGEX, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function applyDeterministicNoBs(input: string): string {
  const lines = input.split(/\r?\n/);
  const kept: string[] = [];

  for (const rawLine of lines) {
    const cleaned = cleanLine(rawLine);
    if (!cleaned) {
      continue;
    }

    if (isNoiseLine(cleaned)) {
      continue;
    }

    kept.push(cleaned);
  }

  return kept.join("\n\n").trim();
}
