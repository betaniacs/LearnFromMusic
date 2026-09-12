/**
 * Picks the model provider from the PROVIDER environment variable.
 *
 * Both modules expose the same three things — generateDeck(), MODEL_ID and
 * maxLyricsChars — and both translate their own SDK's errors into
 * DeckGenerationError. Nothing downstream of here knows which vendor is in use.
 *
 * The import is dynamic so that only the selected provider's client is
 * constructed: importing both would require both API keys to be present.
 */
const PROVIDER = (process.env.PROVIDER || "groq").toLowerCase();

const PROVIDERS = {
  groq: () => import("./groq.js"),
  anthropic: () => import("./anthropic.js"),
};

if (!PROVIDERS[PROVIDER]) {
  console.error(
    `\nUnknown PROVIDER "${PROVIDER}". Supported values: ${Object.keys(PROVIDERS).join(", ")}\n`,
  );
  process.exit(1);
}

const provider = await PROVIDERS[PROVIDER]();

export const { generateDeck, MODEL_ID, maxLyricsChars, name: PROVIDER_NAME } = provider;
