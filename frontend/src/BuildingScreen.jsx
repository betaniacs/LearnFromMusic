import React from "react";
import { Loader2 } from "lucide-react";
import { COLORS } from "./theme.js";

export default function BuildingScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 16 }}>
      <Loader2 size={32} color={COLORS.gold} style={{ animation: "spin 1s linear infinite" }} />
      <div className="serif-display" style={{ fontSize: 22, color: COLORS.cream }}>Pressing your deck...</div>
      <div className="sans-ui" style={{ fontSize: 13, color: COLORS.creamDim }}>Reading the lyrics, pulling vocabulary, writing exercises.</div>
    </div>
  );
}
