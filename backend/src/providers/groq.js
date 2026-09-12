import Groq from "groq-sdk";
import {
  DECK_JSON_SCHEMA,
  DeckSchema,
  buildPrompt,
  clampToConfig,
  DeckGenerationError,
} from "../deck.js";

const client = new Groq(); // reads GROQ_API_KEY

export const name = "groq";
export const MODEL_ID = process.env.MODEL_ID || "openai/gpt-oss-120b";

/**
 * The free tier allows 8,000 tokens per MINUTE, which is the real constraint —
 * not the per-day budget. A single generation must fit inside it, so the input
 * is capped far lower than the Anthropic path's 20,000 characters.
 * Roughly: 6,000 chars ≈ 1,700 tokens in, plus up to 4,096 out ≈ 5,800 total.
 */
export const maxLyricsChars = Number(process.env.MAX_LYRICS_CHARS || 6_000);

const MAX_COMPLETION_TOKENS = Number(process.env.MAX_COMPLETION_TOKENS || 4_096);

// 'low' | 'medium' | 'high'. Reasoning tokens count against the same per-minute
// budget, so 'medium' is the default rather than 'high'.
const REASONING_EFFORT = process.env.REASONING_EFFORT || "medium";

export async function generateDeck({ songTitle, artist, lyricsText, difficulty }) {
  let completion;
  try {
    completion = await client.chat.completions.create({
      model: MODEL_ID,
      messages: [
        { role: "user", content: buildPrompt({ songTitle, artist, lyricsText, difficulty }) },
      ],
      // Lower than the console default of 1: translations and correct answers
      // should be accurate rather than creative.
      temperature: 0.6,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      reasoning_effort: REASONING_EFFORT,
      // strict: true makes schema adherence a guarantee rather than a request,
      // so no fence-stripping or defensive JSON.parse is needed.
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "study_deck",
          strict: true,
          schema: DECK_JSON_SCHEMA,
        },
      },
    });
  } catch (err) {
    throw translateError(err);
  }

  const choice = completion.choices?.[0];

  if (choice?.finish_reason === "length") {
    throw new DeckGenerationError(
      "The deck was cut off before it finished. Try shorter lyrics.",
      { status: 502 },
    );
  }

  const content = choice?.message?.content;
  if (!content) {
    throw new DeckGenerationError("The model returned an empty response.");
  }

  // strict mode guarantees the shape, but we re-validate with Zod anyway: it is
  // the same schema object, it costs microseconds, and it means a provider
  // regression surfaces here instead of as a blank screen in the UI.
  const parsed = DeckSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    throw new DeckGenerationError("The model's response did not match the deck schema.");
  }

  return {
    deck: clampToConfig(parsed.data, difficulty),
    usage: {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

function translateError(err) {
  if (err instanceof Groq.AuthenticationError) {
    console.error("[groq] authentication failed — check GROQ_API_KEY");
    return new DeckGenerationError("The deck service is misconfigured.", {
      status: 500,
      cause: err,
    });
  }
  if (err instanceof Groq.RateLimitError) {
    console.error("[groq] rate limited:", err.message);
    return new DeckGenerationError(
      "Free-tier rate limit reached (8,000 tokens/minute). Wait a minute and try again.",
      { status: 429, cause: err },
    );
  }
  if (err instanceof Groq.BadRequestError) {
    console.error("[groq] bad request:", err.message);
    return new DeckGenerationError("The model rejected the request.", {
      status: 502,
      cause: err,
    });
  }
  if (err instanceof Groq.APIConnectionError) {
    console.error("[groq] connection error:", err.message);
    return new DeckGenerationError("Couldn't reach the model. Check your connection.", {
      status: 504,
      cause: err,
    });
  }
  if (err instanceof Groq.APIError) {
    console.error(`[groq] API error ${err.status}:`, err.message);
    return new DeckGenerationError("The model request failed. Try again.", {
      status: 502,
      cause: err,
    });
  }
  return err;
}
