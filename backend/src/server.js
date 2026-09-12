import "./env.js";
import {
  PORT,
  COOKIE_SECRET,
  COOKIE_SECURE,
  TRUST_PROXY,
  GENERATE_LIMIT,
  GENERATE_WINDOW_MIN,
} from "./config.js";

import express from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";

import generateRoutes from "./routes/generate.js";
import deckRoutes from "./routes/decks.js";
import resolveRoutes from "./routes/resolve.js";
import { MODEL_ID, PROVIDER_NAME, maxLyricsChars } from "./providers/index.js";
import { DB_PATH } from "./db.js";

const app = express();

app.set("trust proxy", TRUST_PROXY);
app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser(COOKIE_SECRET));

const UID_COOKIE = "lfm_uid";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Anonymous per-visitor identity. No accounts and no login screen — just a
 * signed, httpOnly cookie so one visitor's library isn't visible to another.
 * Signing prevents a client from claiming someone else's owner id.
 */
app.use((req, res, next) => {
  let ownerId = req.signedCookies?.[UID_COOKIE];
  if (!ownerId) {
    ownerId = randomUUID();
    res.cookie(UID_COOKIE, ownerId, {
      httpOnly: true,
      signed: true,
      sameSite: "lax",
      secure: COOKIE_SECURE,
      maxAge: ONE_YEAR_MS,
    });
  }
  req.ownerId = ownerId;
  next();
});

// Deck generation is the only route that consumes model quota, so it gets its
// own limit on top of whatever the provider enforces upstream.
const generateLimiter = rateLimit({
  windowMs: GENERATE_WINDOW_MIN * 60 * 1000,
  limit: GENERATE_LIMIT,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: `Rate limit reached — ${GENERATE_LIMIT} decks per ${GENERATE_WINDOW_MIN} minutes. Try again shortly.`,
  },
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    provider: PROVIDER_NAME,
    model: MODEL_ID,
    maxLyricsChars,
    db: DB_PATH,
  });
});

// Link resolution hits third-party services but costs no model quota, so it
// gets a looser limit of its own rather than sharing the generation budget.
const resolveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many link lookups. Try again shortly." },
});

app.use("/api", generateLimiter, generateRoutes);
app.use("/api", resolveLimiter, resolveRoutes);
app.use("/api", deckRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Unknown endpoint." });
});

/**
 * Providers translate their own SDK errors into DeckGenerationError, each with
 * a user-safe message and an HTTP status, so this handler stays free of
 * vendor-specific error classes. Nothing here leaks key state or upstream text.
 */
app.use((err, req, res, _next) => {
  if (err?.name === "DeckGenerationError" && err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error("[server] unhandled error:", err);
  res.status(500).json({ error: "Something went wrong generating the deck. Try again." });
});

app.listen(PORT, () => {
  console.log(`Learn from Music API listening on :${PORT}`);
  console.log(`  provider: ${PROVIDER_NAME}`);
  console.log(`  model: ${MODEL_ID}`);
  console.log(`  lyrics cap: ${maxLyricsChars.toLocaleString()} chars`);
  console.log(`  database: ${DB_PATH}`);
});
