/**
 * Validates the environment before anything that depends on it is constructed,
 * so a missing key fails at boot with a readable message instead of on the
 * first user request.
 */
export const PROVIDER = (process.env.PROVIDER || "groq").toLowerCase();

// Each provider needs its own key; only the selected one is required.
const REQUIRED_KEY = {
  groq: "GROQ_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
}[PROVIDER];

const missing = [];

if (REQUIRED_KEY && !process.env[REQUIRED_KEY]) missing.push(REQUIRED_KEY);
if (!process.env.COOKIE_SECRET) missing.push("COOKIE_SECRET");

if (missing.length > 0) {
  console.error(
    `\nPROVIDER is "${PROVIDER}" — missing required environment variable(s): ${missing.join(", ")}\n\n` +
      `Fill them in in .env at the repo root.\n\n` +
      (missing.includes("GROQ_API_KEY")
        ? `Get a free Groq key at https://console.groq.com/keys\n\n`
        : "") +
      (missing.includes("COOKIE_SECRET")
        ? `Generate a cookie secret with:\n` +
          `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n`
        : ""),
  );
  process.exit(1);
}

export const PORT = Number(process.env.PORT || 3001);
export const COOKIE_SECRET = process.env.COOKIE_SECRET;

// Only send the Secure flag when actually served over HTTPS. Compose serves the
// app over plain HTTP on localhost, where Secure cookies are silently dropped.
export const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

// How many hops of X-Forwarded-For to trust. 0 for local dev (direct
// connections), 1 behind the single nginx container in docker-compose.
export const TRUST_PROXY = Number(process.env.TRUST_PROXY || 0);

export const GENERATE_LIMIT = Number(process.env.GENERATE_LIMIT || 10);
export const GENERATE_WINDOW_MIN = Number(process.env.GENERATE_WINDOW_MIN || 15);
