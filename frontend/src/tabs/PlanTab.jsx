import React from "react";
import { COLORS } from "../theme.js";
import { Empty } from "../ui.jsx";

export default function PlanTab({ plan }) {
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
