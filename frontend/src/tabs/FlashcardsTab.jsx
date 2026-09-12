import React, { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { COLORS } from "../theme.js";
import { IconButton, Empty } from "../ui.jsx";

export default function FlashcardsTab({ items }) {
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
        <IconButton onClick={() => go(-1)} ariaLabel="Previous card"><ChevronLeft size={18} /></IconButton>
        <IconButton onClick={() => setFlipped((f) => !f)} ariaLabel="Flip card"><RotateCw size={16} /></IconButton>
        <IconButton onClick={() => go(1)} ariaLabel="Next card"><ChevronRight size={18} /></IconButton>
      </div>
    </div>
  );
}
