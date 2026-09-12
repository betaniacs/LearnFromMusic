import React from "react";
import { Layers, ListChecks, PenLine, CalendarDays } from "lucide-react";
import { COLORS } from "./theme.js";
import FlashcardsTab from "./tabs/FlashcardsTab.jsx";
import QuizTab from "./tabs/QuizTab.jsx";
import TestTab from "./tabs/TestTab.jsx";
import PlanTab from "./tabs/PlanTab.jsx";

const TABS = [
  { id: "flashcards", label: "Flashcards", icon: Layers },
  { id: "quiz", label: "Quiz", icon: ListChecks },
  { id: "test", label: "Test", icon: PenLine },
  { id: "plan", label: "Study plan", icon: CalendarDays },
];

export default function DeckScreen({ deck, tab, setTab, onHome }) {
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
        {TABS.map((t) => {
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
