import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH = process.env.DB_PATH || "./data/decks.db";

// Ensure the directory exists before better-sqlite3 tries to open the file —
// in Docker this is a mounted volume that may start out empty.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// WAL lets readers and a writer work concurrently instead of blocking on a
// single global lock. Without it, two overlapping requests can hit SQLITE_BUSY.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS decks (
    id          TEXT PRIMARY KEY,
    owner_id    TEXT NOT NULL,
    song_title  TEXT NOT NULL,
    artist      TEXT NOT NULL,
    language    TEXT NOT NULL,
    difficulty  TEXT NOT NULL,
    link        TEXT,
    link_source TEXT,
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_decks_owner_created
    ON decks (owner_id, created_at DESC);
`);

const statements = {
  list: db.prepare(`
    SELECT id, song_title, artist, language, created_at
      FROM decks
     WHERE owner_id = ?
     ORDER BY created_at DESC
  `),
  get: db.prepare(`SELECT * FROM decks WHERE id = ? AND owner_id = ?`),
  insert: db.prepare(`
    INSERT INTO decks (id, owner_id, song_title, artist, language, difficulty,
                       link, link_source, payload, created_at)
    VALUES (@id, @ownerId, @songTitle, @artist, @language, @difficulty,
            @link, @linkSource, @payload, @createdAt)
  `),
  remove: db.prepare(`DELETE FROM decks WHERE id = ? AND owner_id = ?`),
};

/** Library index rows — deliberately excludes `payload` so the list stays small. */
export function listDecks(ownerId) {
  return statements.list.all(ownerId).map((row) => ({
    id: row.id,
    songTitle: row.song_title,
    artist: row.artist,
    language: row.language,
    createdAt: row.created_at,
  }));
}

/** Full deck, shaped exactly like what the React components expect. */
export function getDeck(ownerId, id) {
  const row = statements.get.get(id, ownerId);
  if (!row) return null;
  return {
    id: row.id,
    songTitle: row.song_title,
    artist: row.artist,
    language: row.language,
    difficulty: row.difficulty,
    link: row.link,
    linkSource: row.link_source,
    createdAt: row.created_at,
    ...JSON.parse(row.payload),
  };
}

export function insertDeck(ownerId, deck) {
  const { id, songTitle, artist, language, difficulty, link, linkSource, createdAt,
          ...payload } = deck;
  statements.insert.run({
    id,
    ownerId,
    songTitle,
    artist,
    language,
    difficulty,
    link: link || null,
    linkSource: linkSource || null,
    payload: JSON.stringify(payload),
    createdAt,
  });
  return deck;
}

export function deleteDeck(ownerId, id) {
  return statements.remove.run(id, ownerId).changes > 0;
}

export { DB_PATH };
