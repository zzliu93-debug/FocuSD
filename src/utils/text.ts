const TODO_TITLE_CHARACTERS_PER_LINE = 32;
const TODO_MAX_ESTIMATED_TITLE_LINES = 5;
const WIDE_CHARACTER_WIDTH = 1.6;

/**
 * Codepoint ranges that render roughly full-width in the island font.
 * Scripts outside these ranges (Cyrillic, Greek, accented Latin, …) are
 * narrow even though they sit above U+00FF.
 */
const WIDE_CHARACTER_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2e80, 0x303e], // CJK radicals, Kangxi, CJK symbols and punctuation
  [0x3041, 0x33ff], // Hiragana, Katakana, Bopomofo, Hangul Compatibility Jamo
  [0x3400, 0x4dbf], // CJK Unified Ideographs Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xa960, 0xa97f], // Hangul Jamo Extended-A
  [0xac00, 0xd7a3], // Hangul Syllables
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0xfe30, 0xfe6f], // CJK Compatibility Forms
  [0xff00, 0xff60], // Fullwidth Forms
  [0xffe0, 0xffe6], // Fullwidth signs
  [0x1f300, 0x1f9ff], // Emoji
  [0x20000, 0x3fffd], // CJK Unified Ideographs Extension B and beyond
];

function isWideCharacter(codePoint: number) {
  return WIDE_CHARACTER_RANGES.some(
    ([start, end]) => codePoint >= start && codePoint <= end,
  );
}

export function getTodoTitleVisualLength(title: string) {
  let total = 0;

  for (const character of title) {
    const codePoint = character.codePointAt(0) ?? 0;
    total += isWideCharacter(codePoint) ? WIDE_CHARACTER_WIDTH : 1;
  }

  return total;
}

export function getTodoTitleLineCount(title: string) {
  const lines = Math.ceil(
    getTodoTitleVisualLength(title) / TODO_TITLE_CHARACTERS_PER_LINE,
  );

  return Math.min(Math.max(lines, 1), TODO_MAX_ESTIMATED_TITLE_LINES);
}

const COLLAPSED_WIDE_UNITS = 1;
const COLLAPSED_NARROW_UNITS = 0.55;
const COLLAPSED_WHITESPACE_UNITS = 0.35;

/**
 * Estimate how many "text units" the collapsed island label occupies, so the
 * island width can grow with the label. Wide (CJK/Hangul/fullwidth) glyphs
 * count as a full unit; narrow scripts (Latin, Cyrillic, Greek, ...) as less,
 * regardless of codepoint value.
 */
export function getCollapsedTextUnits(text: string) {
  let total = 0;

  for (const character of text.trim()) {
    if (/\s/.test(character)) {
      total += COLLAPSED_WHITESPACE_UNITS;
      continue;
    }

    const codePoint = character.codePointAt(0) ?? 0;
    total += isWideCharacter(codePoint)
      ? COLLAPSED_WIDE_UNITS
      : COLLAPSED_NARROW_UNITS;
  }

  return total;
}
