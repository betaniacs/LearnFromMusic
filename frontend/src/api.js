/**
 * Replaces the artifact's window.storage calls. Every deck now lives in the
 * backend's SQLite database, scoped to an httpOnly cookie the server sets.
 */

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      // Send the session cookie. Same-origin in dev (via the Vite proxy) and
      // in production (via nginx), so no CORS handling is needed.
      credentials: "same-origin",
      ...options,
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Is the backend running?", 0);
  }

  if (res.status === 204) return null;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(body?.error || "Something went wrong. Try again.", res.status);
  }

  return body;
}

/** Library index: [{ id, songTitle, artist, language, createdAt }] */
export function fetchLibrary() {
  return request("/decks");
}

export function fetchDeck(id) {
  return request(`/decks/${encodeURIComponent(id)}`);
}

export function removeDeck(id) {
  return request(`/decks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Generates a deck and persists it server-side; resolves to the full deck. */
export function generateDeck({ songTitle, artist, link, lyricsText, difficulty }) {
  return request("/generate-deck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songTitle, artist, link, lyricsText, difficulty }),
  });
}

/**
 * Resolves a Spotify / Apple Music / YouTube link to song metadata and, when
 * LRCLIB has them, the lyrics. Never throws for a miss — a link that can't be
 * identified simply comes back with found: false.
 */
export function resolveLink(url) {
  return request(`/resolve-link?url=${encodeURIComponent(url)}`);
}
