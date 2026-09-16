# Learn from Music

Paste the lyrics of a song you like and get back a language-study deck:
flashcards, a multiple-choice quiz, a fill-in-the-blank and translation test,
and a day-by-day spaced-repetition plan.

Built with Vite + React, a small Express API, SQLite, and a pluggable model
provider:  Groq's free tier by default, or the Claude API for higher quality.

## Architecture

```
browser ──► nginx (:8080) ──┬──► static React bundle
                            └──► /api/* ──► Express (:3001) ──► Claude API
                                               │
                                               └──► SQLite (docker volume)
```


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


## Running with Docker

```bash
docker compose up --build
```
Then open http://localhost:8080. Saved decks persist in the `deck-data` volume
across rebuilds and `docker compose down`; `docker compose down -v` deletes them.

## API

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
artist, and the lyrics themselves.

| Service | Metadata source | Notes |
| --- | --- | --- |
| YouTube | oEmbed API | Titles are cleaned of `(Official Video)`-style noise |
| Spotify | OpenGraph tags | Artist parsed from `og:description` |
| Apple Music | OpenGraph tags | Renders client-side, so often unavailable |

Lyrics then come from [LRCLIB](https://lrclib.net), a free community-maintained
database with no authentication. Because it is community-submitted it contains
occasional joke entries, so results shorter than 200 characters or with fewer
than four lines are discarded and the longest usable match wins.


Only Spotify, Apple Music and YouTube hostnames are ever fetched. The allowlist
is enforced before any request is made, since the server is following a
user-supplied URL.
