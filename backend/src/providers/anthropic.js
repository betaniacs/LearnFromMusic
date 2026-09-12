import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DeckSchema, buildPrompt, clampToConfig, DeckGenerationError } from "../deck.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

export const name = "anthropic";
export const MODEL_ID = process.env.MODEL_ID || "claude-opus-5";

export const maxLyricsChars = Number(process.env.MAX_LYRICS_CHARS || 20_000);

export async function generateDeck({ songTitle, artist, lyricsText, difficulty }) {
  let response;
  try {
    response = await client.messages.parse({
      model: MODEL_ID,
      max_tokens: 16000,
      // Adaptive thinking meaningfully improves word selection, the plausibility
      // of quiz distractors, and translation accuracy on idiomatic lyrics.
      thinking: { type: "adaptive" },
      output_config: { format: zodOutputFormat(DeckSchema) },
      messages: [
        { role: "user", content: buildPrompt({ songTitle, artist, lyricsText, difficulty }) },
      ],
    });
  } catch (err) {
    throw translateError(err);
  }

  // A safety decline returns HTTP 200 — always check before reading content.
  if (response.stop_reason === "refusal") {
    throw new DeckGenerationError(
      "The model declined to build a deck from this text.",
      { status: 422 },
    );
  }

  if (response.stop_reason === "max_tokens") {
    throw new DeckGenerationError(
      "The deck was cut off before it finished. Try shorter lyrics.",
      { status: 502 },
    );
  }

  if (!response.parsed_output) {
    throw new DeckGenerationError("The model's response did not match the deck schema.");
  }

  return {
    deck: clampToConfig(response.parsed_output, difficulty),
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

function translateError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error("[anthropic] authentication failed — check ANTHROPIC_API_KEY");
    return new DeckGenerationError("The deck service is misconfigured.", {
      status: 500,
      cause: err,
    });
  }
  if (err instanceof Anthropic.RateLimitError) {
    console.error("[anthropic] rate limited upstream");
    return new DeckGenerationError("The model is busy right now. Try again in a moment.", {
      status: 429,
      cause: err,
    });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    console.error("[anthropic] connection error:", err.message);
    return new DeckGenerationError("Couldn't reach the model. Check your connection.", {
      status: 504,
      cause: err,
    });
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`[anthropic] API error ${err.status}:`, err.message);
    return new DeckGenerationError("The model request failed. Try again.", {
      status: 502,
      cause: err,
    });
  }
  return err;
}
