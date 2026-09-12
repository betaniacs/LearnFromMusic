# Learn from Music

Paste the lyrics of a song you like and get back a language-study deck:
flashcards, a multiple-choice quiz, a fill-in-the-blank and translation test,
and a day-by-day spaced-repetition plan.

Built with Vite + React, a small Express API, SQLite, and a pluggable model
provider — Groq's free tier by default, or the Claude API for higher quality.

## Architecture

```
browser ──► nginx (:8080) ──┬──► static React bundle
                            └──► /api/* ──► Express (:3001) ──► Claude API
                                               │
                                               └──► SQLite (docker volume)
```

The API key lives only in the backend process. The browser never sees it and
never talks to a model provider directly.

## Providers

Set `PROVIDER` in `.env`. Both paths produce the same schema-validated deck, so
switching requires no other change.

| | `groq` (default) | `anthropic` |
| --- | --- | --- |
| Model | `openai/gpt-oss-120b` | `claude-opus-5` |
| Cost | Free tier | Paid credits |
| Schema enforcement | `response_format` strict JSON Schema | `output_config.format` + Zod |
| Reasoning control | `reasoning_effort` | adaptive thinking |
| Lyrics cap | 6,000 chars | 20,000 chars |
| Best for | Getting it running at no cost | Translation nuance, less common languages |

Groq's free tier allows **8,000 tokens per minute**, which is the binding
constraint — roughly one deck per minute. The lower lyrics cap on that path
exists so a single generation fits inside that budget. Daily ceiling is 200,000
tokens (~30-40 decks).

Quality caveat worth knowing: translation accuracy and idiomatic nuance are
exactly where the open-weights model trails Opus 5, and the gap is widest for
less widely-spoken languages. For mainstream pop lyrics you likely won't notice.

## Running locally

Requires Node 20+ and a free Groq API key (https://console.groq.com/keys).

```bash
# 1. Configure
cp .env.example .env          # then paste your free GROQ_API_KEY
                              # (COOKIE_SECRET may already be generated)

# 2. Install
cd backend  && npm install
cd ../frontend && npm install

# 3. Run — two terminals
cd backend  && npm run dev    # API on :3001
cd frontend && npm run dev    # UI  on :5173
```

Open http://localhost:5173. Vite proxies `/api` to the backend, so the browser
sees a single origin and no CORS setup is needed.

## Running with Docker

```bash
docker compose up --build
```

Then open http://localhost:8080. Saved decks persist in the `deck-data` volume
across rebuilds and `docker compose down`; `docker compose down -v` deletes them.

The backend is not published to the host — it listens only on the compose
network, and the browser reaches it through nginx at `/api`. Built image sizes
are 461 MB (backend, needs the Node runtime) and 76 MB (frontend, nginx only).

## API

All routes are scoped to an anonymous visitor identified by a signed,
httpOnly cookie the server sets on first request. There are no accounts.

| Method   | Route                | Purpose                                   |
| -------- | -------------------- | ----------------------------------------- |
| `GET`    | `/api/health`        | Liveness, active provider, model, caps    |
| `GET`    | `/api/resolve-link`  | Resolve a link to artist/title + lyrics   |
| `POST`   | `/api/generate-deck` | Build a deck from lyrics, persist, return |
| `GET`    | `/api/decks`         | Library index for this visitor            |
| `GET`    | `/api/decks/:id`     | One full deck                             |
| `DELETE` | `/api/decks/:id`     | Delete a deck                             |

`POST /api/generate-deck` takes `{ songTitle, artist, link, lyricsText,
difficulty }` where `difficulty` is `beginner | intermediate | advanced`.
`lyricsText` is required and capped at 20,000 characters.

## Link lookup

Pasting a Spotify, Apple Music or YouTube link auto-fills the song title,
artist, and — when they can be found — the lyrics themselves.

None of those services expose lyrics through an API. Spotify's in-app lyrics
come from Musixmatch behind a private endpoint requiring a user token, Apple's
need a MusicKit subscriber entitlement, and YouTube's `captions.download`
requires OAuth as the video owner. So the link is used only to *identify* the
song, via each service's public link-preview metadata:

| Service | Metadata source | Notes |
| --- | --- | --- |
| YouTube | oEmbed API | Titles are cleaned of `(Official Video)`-style noise |
| Spotify | OpenGraph tags | Artist parsed from `og:description` |
| Apple Music | OpenGraph tags | Renders client-side, so often unavailable |

Lyrics then come from [LRCLIB](https://lrclib.net), a free community-maintained
database with no authentication. Because it is community-submitted it contains
occasional joke entries, so results shorter than 200 characters or with fewer
than four lines are discarded and the longest usable match wins.

Every step is best-effort: any failure leaves the field empty and you paste the
text yourself, exactly as before. Raw lyrics are still never written to the
database — only the generated study material is.

Only Spotify, Apple Music and YouTube hostnames are ever fetched. The allowlist
is enforced before any request is made, since the server is following a
user-supplied URL.

## Configuration

| Variable              | Default           | Notes                                          |
| --------------------- | ----------------- | ---------------------------------------------- |
| `PROVIDER`            | `groq`            | `groq` or `anthropic`                          |
| `GROQ_API_KEY`        | —                 | Required when `PROVIDER=groq`. Backend only — never `VITE_`-prefixed |
| `ANTHROPIC_API_KEY`   | —                 | Required when `PROVIDER=anthropic`             |
| `COOKIE_SECRET`       | —                 | Required. Signs the visitor cookie             |
| `MODEL_ID`            | provider default  | Overrides the active provider's model          |
| `MAX_LYRICS_CHARS`    | 6,000 / 20,000    | Per-provider default                           |
| `REASONING_EFFORT`    | `medium`          | Groq only                                      |
| `PORT`                | `3001`            |                                                |
| `DB_PATH`             | `./data/decks.db` |                                                |
| `COOKIE_SECURE`       | `false`           | Set `true` only when serving over HTTPS        |
| `TRUST_PROXY`         | `0`               | `1` behind nginx (set by compose)              |
| `GENERATE_LIMIT`      | `10`              | Generations per IP per window                  |
| `GENERATE_WINDOW_MIN` | `15`              | Window length in minutes                       |

## Implementation notes

**One schema, two providers.** `backend/src/deck.js` declares the deck shape
once as a Zod object. Anthropic consumes it directly via `zodOutputFormat`;
Groq consumes `z.toJSONSchema()` output with `strict: true`. Either way the
response is schema-validated server-side, so there is no fence-stripping or
`JSON.parse` guesswork.

**Provider isolation.** Each module in `backend/src/providers/` exposes the
same `generateDeck()`, `MODEL_ID` and `maxLyricsChars`, and translates its own
SDK's errors into a shared `DeckGenerationError`. Nothing downstream — routes,
database, UI — knows which vendor is active. `providers/index.js` imports only
the selected one, so only its key is required.

**Cost controls.** `lyricsText` is capped per provider, generation is
rate-limited per IP, and token usage for every deck is logged to stdout.

**Difficulty counts.** How many vocabulary words, quiz questions and study days
each difficulty produces is set in `backend/src/claude.js` (`DIFFICULTY_CONFIG`).
The counts are requested in the prompt and clamped server-side.
