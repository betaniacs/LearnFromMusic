import { Router } from "express";
import { resolveLink } from "../lyrics.js";
import { maxLyricsChars } from "../providers/index.js";

const router = Router();

const REASONS = {
  "invalid-url": "That doesn't look like a valid link.",
  "unsupported-host": "Only Spotify, Apple Music and YouTube links are supported.",
  "no-metadata": "Couldn't identify the song from that link.",
};

router.get("/resolve-link", async (req, res, next) => {
  const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
  if (!url) return res.status(400).json({ error: "Missing url parameter." });

  try {
    const result = await resolveLink(url);

    if (!result.ok) {
      // Not an error condition for the UI — the user just types it in manually.
      return res.json({
        found: false,
        message: REASONS[result.reason] || "Couldn't look that link up.",
      });
    }

    // Trim to the active provider's cap so a long song can still be submitted
    // without the user having to hand-edit it down.
    let lyrics = result.lyrics;
    let truncated = false;
    if (lyrics && lyrics.length > maxLyricsChars) {
      lyrics = lyrics.slice(0, maxLyricsChars);
      truncated = true;
    }

    res.json({
      found: true,
      songTitle: result.songTitle,
      artist: result.artist,
      lyrics,
      lyricsSource: result.lyricsSource,
      truncated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
