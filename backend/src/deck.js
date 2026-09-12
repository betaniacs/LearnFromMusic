import { z } from "zod";

// How many of each item type to ask for, per difficulty.
export const DIFFICULTY_CONFIG = {
  beginner: { vocab: 6, quiz: 4, blanks: 4, translations: 3, days: 4 },
  intermediate: { vocab: 8, quiz: 5, blanks: 5, translations: 4, days: 5 },
  advanced: { vocab: 10, quiz: 6, blanks: 6, translations: 5, days: 6 },
};

export const DIFFICULTIES = Object.keys(DIFFICULTY_CONFIG);

// One schema definition, consumed two ways: Anthropic takes the Zod object
// directly via zodOutputFormat, Groq takes the JSON Schema below.
export const DeckSchema = z.object({
  language: z.string().describe("The language the lyrics are written in"),
  vocabulary: z.array(
    z.object({
      word: z.string(),
      translation: z.string(),
      pos: z.string().describe("Short part of speech, e.g. 'noun', 'verb'"),
      example: z.string().describe("A short original sentence using the word"),
    }),
  ),
  fillInBlank: z.array(
    z.object({
      sentence: z.string().describe("Sentence with ___ where the word was removed"),
      answer: z.string().describe("The single missing word"),
      hint: z.string(),
    }),
  ),
  quiz: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()).describe("Exactly four answer options"),
      correctIndex: z.number().int().describe("0-based index of the correct option"),
      explanation: z.string(),
    }),
  ),
  translation: z.array(
    z.object({
      prompt: z.string().describe("A short phrase or line to translate"),
      direction: z.string().describe("e.g. 'Spanish to English'"),
      answer: z.string(),
    }),
  ),
  studyPlan: z.array(
    z.object({
      day: z.number().int(),
      focus: z.string(),
      tasks: z.array(z.string()),
    }),
  ),
});

/**
 * JSON Schema for OpenAI-style strict structured outputs. zod v4 generates
 * this natively — it already emits `additionalProperties: false` and lists
 * every property in `required`, which is exactly what strict mode demands.
 * The `$schema` key is stripped because strict mode rejects unknown keywords.
 */
export const DECK_JSON_SCHEMA = (() => {
  const schema = z.toJSONSchema(DeckSchema, { target: "draft-7" });
  delete schema.$schema;
  return schema;
})();

export function buildPrompt({ songTitle, artist, lyricsText, difficulty }) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  return `You are building a personal language-study deck from song lyrics the user themselves pasted in for their own private study.

Song title: ${songTitle || "Unknown"}
Artist: ${artist || "Unknown"}
Difficulty: ${difficulty}
Lyrics/text pasted by the user:
"""
${lyricsText}
"""

Build the deck as follows:

- language: the language the lyrics are in.
- vocabulary: exactly ${cfg.vocab} entries. Pick the most useful and most
  frequently recurring words, favouring ones that carry the song's meaning over
  function words. Give the word, its translation, a short part of speech, and a
  short original example sentence using it.
- fillInBlank: exactly ${cfg.blanks} entries. Take a line from the lyrics (or
  write one closely modelled on them) and replace exactly one word with ___.
  Give the missing word and one short hint.
- quiz: exactly ${cfg.quiz} multiple-choice questions on vocabulary or grammar
  meaning, with exactly four options each. Set correctIndex to the 0-based index
  of the correct option, and vary which position is correct across questions.
  Make the three wrong options genuinely plausible — no obvious throwaways — and
  add a one-sentence explanation.
- translation: exactly ${cfg.translations} short phrases or lines to translate,
  each with the direction and the expected answer.
- studyPlan: exactly ${cfg.days} consecutive days of realistic spaced
  repetition over this vocabulary, revisiting earlier words on later days rather
  than introducing all of them at once. Each day gets a short focus theme and
  two or three short, concrete tasks.

Write the example sentences, hints, explanations and tasks as single short
sentences — they are rendered in compact flashcards and list rows, so anything
longer than roughly 90 characters will be clipped in the UI. If the pasted text
is too short or too repetitive to yield the full counts above, produce as many
high-quality items as the text genuinely supports rather than padding.`;
}

/** Drop any extra items the model produced beyond the difficulty's counts. */
export function clampToConfig(deck, difficulty) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  return {
    ...deck,
    vocabulary: deck.vocabulary.slice(0, cfg.vocab),
    fillInBlank: deck.fillInBlank.slice(0, cfg.blanks),
    quiz: deck.quiz.slice(0, cfg.quiz),
    translation: deck.translation.slice(0, cfg.translations),
    studyPlan: deck.studyPlan.slice(0, cfg.days),
  };
}

/**
 * Providers translate their own SDK errors into this, so the rest of the app
 * never needs to know which vendor's SDK raised what.
 */
export class DeckGenerationError extends Error {
  constructor(message, { status = 502, cause } = {}) {
    super(message);
    this.name = "DeckGenerationError";
    this.status = status;
    this.cause = cause;
  }
}
