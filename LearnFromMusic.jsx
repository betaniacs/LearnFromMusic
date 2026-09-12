import React, { useState, useEffect, useCallback } from "react";
import {
  Disc3,
  Link2,
  Layers,
  ListChecks,
  PenLine,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Check,
  X,
  Library,
  Plus,
  Loader2,
  Trash2,
  Sparkles,
} from "lucide-react";

// ---------- Palette (liner-notes / album-sleeve aesthetic) ----------
const COLORS = {
  base: "#1F1B2E",
  baseLight: "#2A2440",
  gold: "#E8B84B",
  sage: "#6FA888",
  clay: "#D3685F",
  cream: "#F2EEE5",
  creamDim: "#C9C3B5",
};

const DIFFICULTY_CONFIG = {
  beginner: { vocab: 6, quiz: 4, blanks: 4, translations: 3, days: 4 },
  intermediate: { vocab: 8, quiz: 5, blanks: 5, translations: 4, days: 5 },
  advanced: { vocab: 10, quiz: 6, blanks: 6, translations: 5, days: 6 },
};

function detectLinkSource(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("spotify.com")) return "Spotify";
  if (u.includes("music.apple.com")) return "Apple Music";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  return "Link";
}

async function callClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) throw new Error("Request to the model failed.");
  const data = await response.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

function buildPrompt({ songTitle, artist, lyricsText, difficulty }) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  return `You are building a personal language-study deck from song lyrics the user themselves pasted in for their own private study. Respond with ONLY raw JSON (no markdown fences, no preamble, no commentary) matching exactly this shape. Keep every field short and concise so the whole response fits comfortably in 1000 tokens.

Song title: ${songTitle || "Unknown"}
Artist: ${artist || "Unknown"}
Difficulty: ${difficulty}
Lyrics/text pasted by the user:
"""
${lyricsText}
"""

Return JSON with this exact shape:
{
  "language": "name of the language the lyrics are in",
  "vocabulary": [ { "word": "", "translation": "", "pos": "short part of speech", "example": "short original sentence using the word" } ] // exactly ${cfg.vocab} items, pick the most useful/recurring words,
  "fillInBlank": [ { "sentence": "sentence with ___ where the word is removed", "answer": "the missing word", "hint": "one short hint" } ] // exactly ${cfg.blanks} items,
  "quiz": [ { "question": "", "options": ["a","b","c","d"], "correctIndex": 0, "explanation": "one short sentence" } ] // exactly ${cfg.quiz} items, multiple choice on vocab/grammar meaning,
  "translation": [ { "prompt": "short phrase or line to translate", "direction": "e.g. Spanish to English", "answer": "" } ] // exactly ${cfg.translations} items,
  "studyPlan": [ { "day": 1, "focus": "short theme for the day", "tasks": ["short task", "short task"] } ] // exactly ${cfg.days} items, a realistic spaced-repetition plan using this vocab across consecutive days
}`;
}

export default function LearnFromMusic() {
  const [screen, setScreen] = useState("home"); // home | building | deck
  const [library, setLibrary] = useState([]); // [{id, songTitle, artist, language, createdAt}]
  const [activeDeck, setActiveDeck] = useState(null);
  const [tab, setTab] = useState("flashcards");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);

  // form state
  const [link, setLink] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [lyricsText, setLyricsText] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");

  const loadLibrary = useCallback(async () => {
    try {
      const idx = await window.storage.get("deck-index", false);
      const list = idx ? JSON.parse(idx.value) : [];
      setLibrary(list);
    } catch (e) {
      setLibrary([]);
    } finally {
      setLibraryLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  async function saveDeckToLibrary(deck) {
    try {
      await window.storage.set(`deck:${deck.id}`, JSON.stringify(deck), false);
      const idx = await window.storage.get("deck-index", false).catch(() => null);
      const list = idx ? JSON.parse(idx.value) : [];
      const trimmed = list.filter((d) => d.id !== deck.id);
      const entry = {
        id: deck.id,
        songTitle: deck.songTitle,
        artist: deck.artist,
        language: deck.language,
        createdAt: deck.createdAt,
      };
      const updated = [entry, ...trimmed];
      await window.storage.set("deck-index", JSON.stringify(updated), false);
      setLibrary(updated);
    } catch (e) {
      // non-fatal: deck still usable this session even if save fails
    }
  }

  async function openDeck(id) {
    try {
      const res = await window.storage.get(`deck:${id}`, false);
      if (res) {
        setActiveDeck(JSON.parse(res.value));
        setTab("flashcards");
        setScreen("deck");
      }
    } catch (e) {
      setError("Couldn't load that deck.");
    }
  }

  async function deleteDeck(id, e) {
    e.stopPropagation();
    try {
      await window.storage.delete(`deck:${id}`, false).catch(() => {});
      const updated = library.filter((d) => d.id !== id);
      await window.storage.set("deck-index", JSON.stringify(updated), false);
      setLibrary(updated);
    } catch (err) {
      // ignore
    }
  }

  async function handleGenerate() {
    setError("");
    if (!lyricsText.trim()) {
      setError("Paste the lyrics or transcript text — links alone can't be read directly.");
      return;
    }
    setLoading(true);
    setScreen("building");
    try {
      const prompt = buildPrompt({ songTitle, artist, lyricsText, difficulty });
      const result = await callClaude(prompt);
      const deck = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        songTitle: songTitle || "Untitled",
        artist: artist || "Unknown artist",
        link,
        linkSource: detectLinkSource(link),
        difficulty,
        ...result,
      };
      setActiveDeck(deck);
      setTab("flashcards");
      setScreen("deck");
      saveDeckToLibrary(deck);
    } catch (e) {
      setError("Something went wrong generating the deck. Try again.");
      setScreen("home");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setLink("");
    setSongTitle("");
    setArtist("");
    setLyricsText("");
    setDifficulty("intermediate");
    setError("");
    setScreen("home");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(ellipse at top, ${COLORS.baseLight}, ${COLORS.base} 60%)`,
        color: COLORS.cream,
        fontFamily: "'Georgia', serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Inter:wght@400;500;600&display=swap');
        .serif-display { font-family: 'Fraunces', Georgia, serif; }
        .sans-ui { font-family: 'Inter', -apple-system, sans-serif; }
        .flip-card { transform-style: preserve-3d; transition: transform 0.5s cubic-bezier(0.4,0.2,0.2,1); }
        .flip-card.flipped { transform: rotateY(180deg); }
        .flip-face { backface-visibility: hidden; }
        .flip-back { transform: rotateY(180deg); }
        .track-row:hover { background: rgba(232,184,75,0.06); }
        ::selection { background: ${COLORS.gold}; color: ${COLORS.base}; }
        input:focus, textarea:focus, select:focus { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }
      `}</style>

      {screen === "home" && (
        <HomeScreen
          library={library}
          libraryLoaded={libraryLoaded}
          link={link} setLink={setLink}
          songTitle={songTitle} setSongTitle={setSongTitle}
          artist={artist} setArtist={setArtist}
          lyricsText={lyricsText} setLyricsText={setLyricsText}
          difficulty={difficulty} setDifficulty={setDifficulty}
          error={error}
          onGenerate={handleGenerate}
          onOpenDeck={openDeck}
          onDeleteDeck={deleteDeck}
        />
      )}

      {screen === "building" && <BuildingScreen />}

      {screen === "deck" && activeDeck && (
        <DeckScreen deck={activeDeck} tab={tab} setTab={setTab} onHome={resetForm} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
function HomeScreen({
  library, libraryLoaded,
  link, setLink, songTitle, setSongTitle, artist, setArtist,
  lyricsText, setLyricsText, difficulty, setDifficulty,
  error, onGenerate, onOpenDeck, onDeleteDeck,
}) {
  const source = detectLinkSource(link);
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
        Paste a link so the deck remembers the source, then paste the lyrics or
        transcript itself — links can't be read directly, but the text turns
        into flashcards, a quiz, a written test, and a day-by-day study plan.
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
            <div className="sans-ui" style={{ fontSize: 12, color: COLORS.gold, marginTop: 6 }}>
              Detected: {source} — saved as the deck's source, not fetched automatically.
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
          <Field label="Paste lyrics or transcript (from Spotify lyrics, YouTube transcript, or your own notes)">
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
            cursor: "pointer",
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

function Field({ label, children }) {
  return (
    <div>
      <label className="sans-ui" style={{ display: "block", fontSize: 12, color: COLORS.creamDim, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function inputStyle(hasIcon) {
  return {
    width: "100%",
    background: "rgba(0,0,0,0.2)",
    border: `1px solid rgba(242,238,229,0.15)`,
    borderRadius: 3,
    padding: hasIcon ? "10px 12px 10px 36px" : "10px 12px",
    color: COLORS.cream,
    fontSize: 14,
    boxSizing: "border-box",
  };
}

// ---------------------------------------------------------------------
function BuildingScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 16 }}>
      <Loader2 size={32} color={COLORS.gold} className="sans-ui" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="serif-display" style={{ fontSize: 22, color: COLORS.cream }}>Pressing your deck...</div>
      <div className="sans-ui" style={{ fontSize: 13, color: COLORS.creamDim }}>Reading the lyrics, pulling vocabulary, writing exercises.</div>
    </div>
  );
}

// ---------------------------------------------------------------------
function DeckScreen({ deck, tab, setTab, onHome }) {
  const tabs = [
    { id: "flashcards", label: "Flashcards", icon: Layers },
    { id: "quiz", label: "Quiz", icon: ListChecks },
    { id: "test", label: "Test", icon: PenLine },
    { id: "plan", label: "Study plan", icon: CalendarDays },
  ];
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 24px 80px" }}>
      <button
        onClick={onHome}
        className="sans-ui"
        style={{ background: "none", border: "none", color: COLORS.creamDim, fontSize: 13, cursor: "pointer", marginBottom: 20, padding: 0 }}
      >
        ← Library
      </button>

      <div style={{ marginBottom: 24 }}>
        <div className="sans-ui" style={{ fontSize: 12, color: COLORS.gold, letterSpacing: 0.5, marginBottom: 6 }}>
          {deck.language} {deck.linkSource ? `· via ${deck.linkSource}` : ""}
        </div>
        <h1 className="serif-display" style={{ fontSize: 34, margin: 0, fontWeight: 600 }}>{deck.songTitle}</h1>
        <div className="sans-ui" style={{ color: COLORS.creamDim, fontSize: 14, marginTop: 4 }}>{deck.artist}</div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: `1px solid rgba(242,238,229,0.12)` }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="sans-ui"
              style={{
                background: "none",
                border: "none",
                borderBottom: active ? `2px solid ${COLORS.gold}` : "2px solid transparent",
                color: active ? COLORS.cream : COLORS.creamDim,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "flashcards" && <FlashcardsTab items={deck.vocabulary || []} />}
      {tab === "quiz" && <QuizTab items={deck.quiz || []} />}
      {tab === "test" && <TestTab blanks={deck.fillInBlank || []} translations={deck.translation || []} />}
      {tab === "plan" && <PlanTab plan={deck.studyPlan || []} />}
    </div>
  );
}

// ---------------------------------------------------------------------
function FlashcardsTab({ items }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (items.length === 0) return <Empty text="No vocabulary generated for this deck." />;
  const card = items[i];

  function go(delta) {
    setFlipped(false);
    setI((prev) => (prev + delta + items.length) % items.length);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div className="sans-ui" style={{ color: COLORS.creamDim, fontSize: 12 }}>
        {i + 1} / {items.length} · {card.pos}
      </div>
      <div
        onClick={() => setFlipped((f) => !f)}
        style={{ perspective: 1000, width: "100%", maxWidth: 420, height: 220, cursor: "pointer" }}
      >
        <div className={`flip-card${flipped ? " flipped" : ""}`} style={{ position: "relative", width: "100%", height: "100%" }}>
          <div
            className="flip-face"
            style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", borderRadius: 6,
              background: COLORS.baseLight, border: `1px solid rgba(232,184,75,0.3)`, padding: 24, textAlign: "center",
            }}
          >
            <div className="serif-display" style={{ fontSize: 30, color: COLORS.cream }}>{card.word}</div>
            <div className="sans-ui" style={{ fontSize: 12, color: COLORS.creamDim, marginTop: 12 }}>tap to flip</div>
          </div>
          <div
            className="flip-face flip-back"
            style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", borderRadius: 6,
              background: COLORS.base, border: `1px solid ${COLORS.gold}`, padding: 24, textAlign: "center",
            }}
          >
            <div className="serif-display" style={{ fontSize: 24, color: COLORS.gold }}>{card.translation}</div>
            {card.example && (
              <div className="sans-ui" style={{ fontSize: 13, color: COLORS.creamDim, marginTop: 12, lineHeight: 1.4 }}>
                "{card.example}"
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <IconButton onClick={() => go(-1)}><ChevronLeft size={18} /></IconButton>
        <IconButton onClick={() => setFlipped((f) => !f)}><RotateCw size={16} /></IconButton>
        <IconButton onClick={() => go(1)}><ChevronRight size={18} /></IconButton>
      </div>
    </div>
  );
}

function IconButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "rgba(242,238,229,0.06)", border: `1px solid rgba(242,238,229,0.15)`,
        borderRadius: 20, width: 40, height: 40, display: "flex", alignItems: "center",
        justifyContent: "center", cursor: "pointer", color: COLORS.cream,
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
function QuizTab({ items }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  if (items.length === 0) return <Empty text="No quiz generated for this deck." />;

  const score = items.reduce((acc, q, idx) => acc + (answers[idx] === q.correctIndex ? 1 : 0), 0);

  return (
    <div>
      {items.map((q, idx) => (
        <div key={idx} style={{ marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid rgba(242,238,229,0.08)` }}>
          <div className="sans-ui" style={{ fontSize: 15, marginBottom: 10 }}>
            <span style={{ color: COLORS.gold, marginRight: 8 }}>{idx + 1}.</span>{q.question}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {q.options.map((opt, oi) => {
              const chosen = answers[idx] === oi;
              const isCorrect = submitted && oi === q.correctIndex;
              const isWrongChosen = submitted && chosen && oi !== q.correctIndex;
              return (
                <button
                  key={oi}
                  disabled={submitted}
                  onClick={() => setAnswers((a) => ({ ...a, [idx]: oi }))}
                  className="sans-ui"
                  style={{
                    textAlign: "left",
                    padding: "10px 14px",
                    borderRadius: 3,
                    border: `1px solid ${isCorrect ? COLORS.sage : isWrongChosen ? COLORS.clay : chosen ? COLORS.gold : "rgba(242,238,229,0.15)"}`,
                    background: chosen && !submitted ? "rgba(232,184,75,0.08)" : "transparent",
                    color: COLORS.cream,
                    cursor: submitted ? "default" : "pointer",
                    fontSize: 14,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  {opt}
                  {isCorrect && <Check size={15} color={COLORS.sage} />}
                  {isWrongChosen && <X size={15} color={COLORS.clay} />}
                </button>
              );
            })}
          </div>
          {submitted && q.explanation && (
            <div className="sans-ui" style={{ fontSize: 12, color: COLORS.creamDim, marginTop: 8 }}>{q.explanation}</div>
          )}
        </div>
      ))}
      {!submitted ? (
        <PrimaryButton onClick={() => setSubmitted(true)}>Check answers</PrimaryButton>
      ) : (
        <div className="serif-display" style={{ fontSize: 20, color: COLORS.gold }}>
          {score} / {items.length}
        </div>
      )}
    </div>
  );
}

function PrimaryButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="sans-ui"
      style={{
        background: COLORS.gold, color: COLORS.base, border: "none", borderRadius: 3,
        padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
function TestTab({ blanks, translations }) {
  const [values, setValues] = useState({});
  const [graded, setGraded] = useState(false);
  const all = [
    ...blanks.map((b, i) => ({ key: `b${i}`, kind: "blank", prompt: b.sentence, answer: b.answer, hint: b.hint })),
    ...translations.map((t, i) => ({ key: `t${i}`, kind: "translation", prompt: t.prompt, direction: t.direction, answer: t.answer })),
  ];
  if (all.length === 0) return <Empty text="No written test generated for this deck." />;

  function normalize(s) {
    return (s || "").trim().toLowerCase();
  }

  const correctCount = all.filter((item) => normalize(values[item.key]) === normalize(item.answer)).length;

  return (
    <div>
      {all.map((item) => {
        const isCorrect = graded && normalize(values[item.key]) === normalize(item.answer);
        const isWrong = graded && values[item.key] && !isCorrect;
        return (
          <div key={item.key} style={{ marginBottom: 18 }}>
            <div className="sans-ui" style={{ fontSize: 13, color: COLORS.creamDim, marginBottom: 4 }}>
              {item.kind === "blank" ? "Fill in the blank" : `Translate (${item.direction})`}
              {item.hint ? ` · hint: ${item.hint}` : ""}
            </div>
            <div className="sans-ui" style={{ fontSize: 15, marginBottom: 8 }}>{item.prompt}</div>
            <input
              disabled={graded}
              value={values[item.key] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [item.key]: e.target.value }))}
              className="sans-ui"
              style={{
                ...inputStyle(),
                borderColor: isCorrect ? COLORS.sage : isWrong ? COLORS.clay : "rgba(242,238,229,0.15)",
              }}
            />
            {graded && (
              <div className="sans-ui" style={{ fontSize: 12, marginTop: 4, color: isCorrect ? COLORS.sage : COLORS.clay }}>
                {isCorrect ? "Correct" : `Answer: ${item.answer}`}
              </div>
            )}
          </div>
        );
      })}
      {!graded ? (
        <PrimaryButton onClick={() => setGraded(true)}>Submit test</PrimaryButton>
      ) : (
        <div className="serif-display" style={{ fontSize: 20, color: COLORS.gold }}>
          {correctCount} / {all.length}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
function PlanTab({ plan }) {
  if (plan.length === 0) return <Empty text="No study plan generated for this deck." />;
  return (
    <div style={{ border: `1px solid rgba(242,238,229,0.12)`, borderRadius: 4, overflow: "hidden" }}>
      {plan.map((d, i) => (
        <div
          key={d.day}
          style={{ padding: "16px 18px", borderTop: i === 0 ? "none" : `1px solid rgba(242,238,229,0.08)` }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
            <span className="serif-display" style={{ color: COLORS.gold, fontSize: 18 }}>Day {d.day}</span>
            <span className="sans-ui" style={{ fontSize: 14, color: COLORS.cream, fontWeight: 600 }}>{d.focus}</span>
          </div>
          <ul className="sans-ui" style={{ margin: 0, paddingLeft: 20, color: COLORS.creamDim, fontSize: 13, lineHeight: 1.6 }}>
            {d.tasks.map((task, ti) => <li key={ti}>{task}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }) {
  return <div className="sans-ui" style={{ color: COLORS.creamDim, fontSize: 14, padding: "24px 0" }}>{text}</div>;
}
