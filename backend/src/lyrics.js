/**
 * Resolves a Spotify / Apple Music / YouTube link into { songTitle, artist }
 * and then tries to find matching lyrics.
 *
 * None of these services expose lyrics through their APIs: Spotify's in-app
 * lyrics come from Musixmatch via a private endpoint that needs a user token,
 * Apple's need a MusicKit subscriber entitlement, and YouTube's caption
 * download requires OAuth as the video owner. So the link is used only to
 * identify the song; the lyrics themselves come from LRCLIB, a free,
 * community-maintained database with no authentication.
 *
 * Everything here is best-effort. Any failure returns nulls and the user falls
 * back to pasting the text by hand, exactly as before.
 */

const USER_AGENT = "LearnFromMusic/1.0 (language-study deck builder)";
const TIMEOUT_MS = 8000;

// Server-side fetch of a user-supplied URL is an SSRF risk, so only these
// hosts are ever requested. Anything else is rejected before a socket opens.
const ALLOWED_HOSTS = new Set([
  "open.spotify.com",
  "spotify.com",
  "music.apple.com",
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "m.youtube.com",
  "music.youtube.com",
]);

const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX = 200;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
}

async function get(url, { json = false } = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) return null;
  return json ? res.json() : res.text();
}

function metaTag(html, property) {
  // Handles both attribute orders and single/double quotes.
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

/** Strips the promotional noise YouTube titles collect. */
export function cleanTrackTitle(raw) {
  if (!raw) return "";
  let t = raw;

  // Drop trailing "| Album Name" style suffixes.
  t = t.replace(/\s*\|.*$/, "");

  // Remove bracketed segments that are clearly not part of the song name.
  const noise =
    /\s*[([]\s*[^)\]]*\b(official|officiel|oficial|video|vídeo|audio|lyric[s]?|letra|paroles|visuali[sz]er|remaster(ed)?|hd|hq|4k|8k|mv|m\/v|full|clip|performance|version)\b[^)\]]*[)\]]/gi;
  let prev;
  do {
    prev = t;
    t = t.replace(noise, "");
  } while (t !== prev);

  return t.replace(/\s{2,}/g, " ").trim().replace(/[-–—\s]+$/, "").trim();
}

/** Splits "Artist - Title" when present, else falls back to the channel name. */
export function splitArtistTitle(rawTitle, fallbackArtist) {
  const cleaned = cleanTrackTitle(rawTitle);
  const m = cleaned.match(/^(.*?)\s+[-–—]\s+(.*)$/);
  if (m && m[1].trim() && m[2].trim()) {
    return { artist: m[1].trim(), songTitle: m[2].trim() };
  }
  return {
    artist: (fallbackArtist || "").replace(/\s*-\s*Topic$/i, "").trim(),
    songTitle: cleaned,
  };
}

async function youtubeMeta(url) {
  const data = await get(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    { json: true },
  );
  if (!data?.title) return null;
  return splitArtistTitle(data.title, data.author_name);
}

async function spotifyMeta(url) {
  const html = await get(url);
  if (!html) return null;
  const title = metaTag(html, "og:title");
  // Spotify formats this as "Artist · Track · Song · Year".
  const desc = metaTag(html, "og:description") || "";
  const artist = desc.split("·")[0]?.trim() || "";
  if (!title) return null;
  return { artist, songTitle: cleanTrackTitle(title) };
}

async function appleMeta(url) {
  // Apple Music renders client-side, so og tags are often absent. Best effort.
  const html = await get(url);
  if (!html) return null;
  const title = metaTag(html, "og:title");
  if (!title) return null;
  // Typically "Song by Artist on Apple Music" or "Song - Single by Artist".
  const m = title.match(/^(.*?)\s+by\s+(.*?)(?:\s+on Apple Music)?$/i);
  if (m) return { artist: m[2].trim(), songTitle: cleanTrackTitle(m[1]) };
  return { artist: "", songTitle: cleanTrackTitle(title) };
}

/**
 * LRCLIB is community-submitted, so it contains joke and placeholder entries —
 * the canonical example being "*Rickrolling*" as the entire body of a very
 * famous song. Anything this short is unusable as study material regardless of
 * whether it is a prank or a genuinely sparse entry, so treat it as a miss.
 */
const MIN_LYRICS_CHARS = 200;

function usable(text) {
  if (!text || text.length < MIN_LYRICS_CHARS) return false;
  // Needs real line structure; a single run-on blob is usually a bad entry.
  return text.split("\n").filter((l) => l.trim()).length >= 4;
}

async function lookupLyrics(artist, songTitle) {
  if (!songTitle) return null;

  // Exact match first.
  if (artist) {
    const params = new URLSearchParams({ artist_name: artist, track_name: songTitle });
    const exact = await get(`https://lrclib.net/api/get?${params}`, { json: true }).catch(
      () => null,
    );
    if (usable(exact?.plainLyrics)) return exact.plainLyrics;
  }

  // Fall back to a fuzzy search, which catches punctuation and feat.
  // differences — and gives us alternates when the exact hit was a junk entry.
  const q = new URLSearchParams({ q: [artist, songTitle].filter(Boolean).join(" ") });
  const results = await get(`https://lrclib.net/api/search?${q}`, { json: true }).catch(
    () => null,
  );
  if (Array.isArray(results)) {
    // Prefer the longest usable candidate rather than merely the first.
    const best = results
      .filter((r) => usable(r.plainLyrics))
      .sort((a, b) => b.plainLyrics.length - a.plainLyrics.length)[0];
    if (best) return best.plainLyrics;
  }
  return null;
}

export async function resolveLink(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "invalid-url" };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { ok: false, reason: "unsupported-host" };
  }

  const key = parsed.toString();
  const cached = cacheGet(key);
  if (cached) return cached;

  const host = parsed.hostname.toLowerCase();
  let meta = null;
  try {
    if (host.includes("youtu")) meta = await youtubeMeta(key);
    else if (host.includes("spotify")) meta = await spotifyMeta(key);
    else if (host.includes("apple")) meta = await appleMeta(key);
  } catch (err) {
    console.error("[resolve] metadata lookup failed:", err.message);
  }

  if (!meta?.songTitle) {
    const result = { ok: false, reason: "no-metadata" };
    cacheSet(key, result);
    return result;
  }

  let lyrics = null;
  try {
    lyrics = await lookupLyrics(meta.artist, meta.songTitle);
  } catch (err) {
    console.error("[resolve] lyrics lookup failed:", err.message);
  }

  const result = {
    ok: true,
    songTitle: meta.songTitle,
    artist: meta.artist || "",
    lyrics: lyrics || null,
    lyricsSource: lyrics ? "LRCLIB" : null,
  };
  cacheSet(key, result);
  return result;
}
