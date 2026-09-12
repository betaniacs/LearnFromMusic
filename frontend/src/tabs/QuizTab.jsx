import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { COLORS } from "../theme.js";
import { PrimaryButton, Empty } from "../ui.jsx";

export default function QuizTab({ items }) {
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
