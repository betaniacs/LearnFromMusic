// ---------- Palette (liner-notes / album-sleeve aesthetic) ----------
export const COLORS = {
  base: "#1F1B2E",
  baseLight: "#2A2440",
  gold: "#E8B84B",
  sage: "#6FA888",
  clay: "#D3685F",
  cream: "#F2EEE5",
  creamDim: "#C9C3B5",
};

// The artifact's <style> block, unchanged except that the Google Fonts @import
// now lives in index.html and the spinner keyframes moved up from
// BuildingScreen so there's a single global style element.
export const GLOBAL_CSS = `
  .serif-display { font-family: 'Fraunces', Georgia, serif; }
  .sans-ui { font-family: 'Inter', -apple-system, sans-serif; }
  .flip-card { transform-style: preserve-3d; transition: transform 0.5s cubic-bezier(0.4,0.2,0.2,1); }
  .flip-card.flipped { transform: rotateY(180deg); }
  .flip-face { backface-visibility: hidden; }
  .flip-back { transform: rotateY(180deg); }
  .track-row:hover { background: rgba(232,184,75,0.06); }
  ::selection { background: ${COLORS.gold}; color: ${COLORS.base}; }
  input:focus, textarea:focus, select:focus { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export const APP_BACKGROUND = `radial-gradient(ellipse at top, ${COLORS.baseLight}, ${COLORS.base} 60%)`;
