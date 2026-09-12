import React, { useState, useEffect, useCallback } from "react";
import { COLORS, GLOBAL_CSS, APP_BACKGROUND } from "./theme.js";
import HomeScreen from "./HomeScreen.jsx";
import BuildingScreen from "./BuildingScreen.jsx";
import DeckScreen from "./DeckScreen.jsx";
import { fetchLibrary, fetchDeck, removeDeck, generateDeck, ApiError } from "./api.js";

export default function App() {
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
      setLibrary(await fetchLibrary());
    } catch {
      setLibrary([]);
    } finally {
      setLibraryLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  async function openDeck(id) {
    try {
      setActiveDeck(await fetchDeck(id));
      setTab("flashcards");
      setScreen("deck");
    } catch {
      setError("Couldn't load that deck.");
    }
  }

  async function deleteDeck(id, e) {
    e.stopPropagation();
    // Optimistic removal, restored from the server if the request fails.
    const previous = library;
    setLibrary((list) => list.filter((d) => d.id !== id));
    try {
      await removeDeck(id);
    } catch {
      setLibrary(previous);
      setError("Couldn't delete that deck.");
    }
  }

  async function handleGenerate() {
    setError("");
    if (!lyricsText.trim()) {
      setError("No lyrics yet — paste them in, or try a link the lookup can identify.");
      return;
    }
    setLoading(true);
    setScreen("building");
    try {
      // The backend generates, validates and persists the deck, then returns it.
      const deck = await generateDeck({ songTitle, artist, link, lyricsText, difficulty });
      setActiveDeck(deck);
      setTab("flashcards");
      setScreen("deck");
      loadLibrary();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Something went wrong generating the deck. Try again.",
      );
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
        background: APP_BACKGROUND,
        color: COLORS.cream,
        fontFamily: "'Georgia', serif",
      }}
    >
      <style>{GLOBAL_CSS}</style>

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
          loading={loading}
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
