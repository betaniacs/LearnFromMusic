import React from "react";
import { COLORS } from "./theme.js";

export function Field({ label, children }) {
  return (
    <div>
      <label className="sans-ui" style={{ display: "block", fontSize: 12, color: COLORS.creamDim, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function inputStyle(hasIcon) {
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

export function PrimaryButton({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="sans-ui"
      style={{
        background: COLORS.gold, color: COLORS.base, border: "none", borderRadius: 3,
        padding: "10px 20px", fontWeight: 600, fontSize: 14,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function IconButton({ onClick, children, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
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

export function Empty({ text }) {
  return <div className="sans-ui" style={{ color: COLORS.creamDim, fontSize: 14, padding: "24px 0" }}>{text}</div>;
}
