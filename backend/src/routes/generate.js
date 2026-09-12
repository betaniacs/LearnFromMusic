import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { generateDeck, maxLyricsChars, PROVIDER_NAME } from "../providers/index.js";
import { DIFFICULTIES } from "../deck.js";
import { detectLinkSource } from "../links.js";
import { insertDeck } from "../db.js";

// The cap is provider-specific — see providers/groq.js for why the free tier
// needs a much lower ceiling than the Anthropic path.
const GenerateRequest = z.object({
  songTitle: z.string().trim().max(200).default(""),
  artist: z.string().trim().max(200).default(""),
  link: z.string().trim().max(2000).default(""),
  lyricsText: z.string().trim().min(1).max(maxLyricsChars),
  difficulty: z.enum(DIFFICULTIES),
});

const router = Router();

router.post("/generate-deck", async (req, res, next) => {
  const parsed = GenerateRequest.safeParse(req.body ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res.status(400).json({
      error:
        issue.path[0] === "lyricsText"
          ? `Paste between 1 and ${maxLyricsChars.toLocaleString()} characters of lyrics or transcript text.`
          : `Invalid ${issue.path.join(".") || "request"}: ${issue.message}`,
    });
  }

  const { songTitle, artist, link, lyricsText, difficulty } = parsed.data;

  try {
    const { deck, usage } = await generateDeck({ songTitle, artist, lyricsText, difficulty });

    const record = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      songTitle: songTitle || "Untitled",
      artist: artist || "Unknown artist",
      link,
      linkSource: detectLinkSource(link),
      difficulty,
      ...deck,
    };

    insertDeck(req.ownerId, record);

    console.log(
      `[deck] ${record.songTitle} — ${record.language} — ${PROVIDER_NAME} ` +
        `in:${usage.input_tokens} out:${usage.output_tokens}`,
    );

    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

export default router;
