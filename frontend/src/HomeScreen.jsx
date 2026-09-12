import React, { useEffect, useRef, useState } from "react";
import { Disc3, Link2, Library, Trash2, Sparkles, Loader2, Check } from "lucide-react";
import { COLORS } from "./theme.js";
import { Field, inputStyle } from "./ui.jsx";
import { detectLinkSource } from "./links.js";
import { resolveLink } from "./api.js";

export default function HomeScreen({
  library, libraryLoaded,
  link, setLink, songTitle, setSongTitle, artist, setArtist,
  lyricsText, setLyricsText, difficulty, setDifficulty,
  error, loading, onGenerate, onOpenDeck, onDeleteDeck,
}) {
  const source = detectLinkSource(link);

  // idle | looking | found | miss
  const [lookup, setLookup] = useState({ state: "idle" });
  const lastLookedUp = useRef("");

  // Debounced link lookup. Fills in whatever the user hasn't typed themselves,
  // so it never overwrites something they entered by hand.
  useEffect(() => {
    const url = link.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      setLookup({ state: "idle" });
      return;
    }
    if (url === lastLookedUp.current) return;

    const timer = setTimeout(async () => {
      lastLookedUp.current = url;
      setLookup({ state: "looking" });
      try {
        const r = await resolveLink(url);
        if (!r.found) {
          setLookup({ state: "miss", message: r.message });
          return;
        }
        if (r.songTitle && !songTitle.trim()) setSongTitle(r.songTitle);
        if (r.artist && !artist.trim()) setArtist(r.artist);
        if (r.lyrics && !lyricsText.trim()) setLyricsText(r.lyrics);
        setLookup({
          state: "found",
          hasLyrics: Boolean(r.lyrics),
          truncated: r.truncated,
          lyricsSource: r.lyricsSource,
        });
      } catch {
        setLookup({ state: "miss", message: "Couldn't look that link up." });
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [link, songTitle, artist, lyricsText, setSongTitle, setArtist, setLyricsText]);

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "56px 24px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Disc3 size={28} color={COLORS.gold} />
        <span className="sans-ui" style={{ fontSize: 13, letterSpacing: 1, color: COLORS.creamDim }}>
          a study deck built from a song you actually like
        </span>
      </div>
      <h1 className="serif-display" style={{ fontSize: 44, lineHeight: 1.1, margin: "0 0 12px", fontWeight: 600 }}>
        Learn from Music
      </h1>
      <p className="sans-ui" style={{ color: COLORS.creamDim, fontSize: 16, maxWidth: 560, marginBottom: 40 }}>
        Paste a Spotify, Apple Music or YouTube link and it'll try to find the
        lyrics for you — or paste them in yourself. Either way the text becomes
        flashcards, a quiz, a written test, and a day-by-day study plan.
      </p>

      <div
        style={{
          background: "rgba(242,238,229,0.04)",
          border: `1px solid rgba(232,184,75,0.25)`,
          borderRadius: 4,
          padding: 28,
          marginBottom: 32,
        }}
      >
        <Field label="Spotify / Apple Music / YouTube link (optional, for reference)">
          <div style={{ position: "relative" }}>
            <Link2 size={16} color={COLORS.creamDim} style={{ position: "absolute", left: 12, top: 13 }} />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://open.spotify.com/track/..."
              className="sans-ui"
              style={inputStyle(true)}
            />
          </div>
          {source && (
            <div
              className="sans-ui"
              style={{ fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 6, color: COLORS.gold }}
            >
              {lookup.state === "looking" && (
                <>
                  <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                  Looking up {source}...
                </>
              )}
              {lookup.state === "found" && lookup.hasLyrics && (
                <span style={{ color: COLORS.sage, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={12} />
                  Found lyrics via {lookup.lyricsSource}
                  {lookup.truncated ? " (trimmed to fit)" : ""} — check them before building.
                </span>
              )}
              {lookup.state === "found" && !lookup.hasLyrics && (
                <>Identified the song, but no lyrics found — paste them below.</>
              )}
              {lookup.state === "miss" && (
                <span style={{ color: COLORS.creamDim }}>{lookup.message}</span>
              )}
              {lookup.state === "idle" && <>Detected: {source}</>}
            </div>
          )}
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <Field label="Song title">
            <input
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="e.g. Volar"
              className="sans-ui"
              style={inputStyle()}
            />
          </Field>
          <Field label="Artist">
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Ana Mena"
              className="sans-ui"
              style={inputStyle()}
            />
          </Field>
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="Lyrics or transcript — filled in from the link when found, otherwise paste your own">
            <textarea
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder="Paste a verse or two here..."
              rows={6}
              className="sans-ui"
              style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5 }}
            />
          </Field>
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="Difficulty">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="sans-ui"
              style={inputStyle()}
            >
              <option value="beginner">Beginner — fewer words, simpler quiz</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced — deeper grammar, more items</option>
            </select>
          </Field>
        </div>

        {error && (
          <div className="sans-ui" style={{ color: COLORS.clay, fontSize: 13, marginTop: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={loading}
          className="sans-ui"
          style={{
            marginTop: 22,
            background: COLORS.gold,
            color: COLORS.base,
            border: "none",
            borderRadius: 3,
            padding: "12px 22px",
            fontWeight: 600,
            fontSize: 14,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Sparkles size={16} /> Build my deck
        </button>
      </div>

      {libraryLoaded && library.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Library size={16} color={COLORS.gold} />
            <span className="serif-display" style={{ fontSize: 20 }}>Your library</span>
          </div>
          <div style={{ border: `1px solid rgba(242,238,229,0.12)`, borderRadius: 4, overflow: "hidden" }}>
            {library.map((d, i) => (
              <div
                key={d.id}
                className="track-row"
                onClick={() => onOpenDeck(d.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderTop: i === 0 ? "none" : `1px solid rgba(242,238,229,0.08)`,
                  cursor: "pointer",
                }}
              >
                <div className="sans-ui" style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ color: COLORS.creamDim, fontSize: 12, width: 20 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontWeight: 600 }}>{d.songTitle}</span>
                  <span style={{ color: COLORS.creamDim, fontSize: 13 }}>{d.artist}</span>
                  <span style={{ color: COLORS.sage, fontSize: 12 }}>{d.language}</span>
                </div>
                <button
                  onClick={(e) => onDeleteDeck(d.id, e)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.creamDim, padding: 4 }}
                  aria-label="Delete deck"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
