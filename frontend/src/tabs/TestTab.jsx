import React, { useState } from "react";
import { COLORS } from "../theme.js";
import { PrimaryButton, Empty, inputStyle } from "../ui.jsx";

export default function TestTab({ blanks, translations }) {
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
