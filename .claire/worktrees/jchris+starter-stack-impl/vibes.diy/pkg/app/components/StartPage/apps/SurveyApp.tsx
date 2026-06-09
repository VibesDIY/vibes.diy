import React, { useState } from "react";

interface Question {
  text: string;
  choices: string[];
}

const QUESTIONS: Question[] = [
  {
    text: "What's your superpower?",
    choices: ["Building", "Designing", "Connecting", "Dreaming"],
  },
  {
    text: "Morning or night?",
    choices: ["Early bird", "Night owl", "Both", "Neither"],
  },
  {
    text: "Pick a tool",
    choices: ["Notebook", "Whiteboard", "Spreadsheet", "Sticky notes"],
  },
];

const RESULT_LABELS = [
  ["builder", "designer", "connector", "dreamer"],
  ["morning", "night", "all-hours", "timeless"],
  ["notebooks", "whiteboards", "spreadsheets", "sticky notes"],
];

export default function SurveyApp() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [pressed, setPressed] = useState<number | null>(null);
  const done = answers.length === QUESTIONS.length;

  const handleChoice = (choiceIdx: number) => {
    const next = [...answers, choiceIdx];
    setAnswers(next);
    setPressed(null);
    if (next.length < QUESTIONS.length) {
      setStep(next.length);
    }
  };

  const handleRestart = () => {
    setAnswers([]);
    setStep(0);
    setPressed(null);
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--vibes-cream, #FFFEF0)",
    color: "var(--vibes-near-black, #1a1a1a)",
    fontFamily: "inherit",
    padding: "20px 16px 16px",
    boxSizing: "border-box",
  };

  if (done) {
    const superpower = RESULT_LABELS[0][answers[0]];
    const time = RESULT_LABELS[1][answers[1]];
    const tool = RESULT_LABELS[2][answers[2]];

    const resultStyle: React.CSSProperties = {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      gap: "20px",
      textAlign: "center",
    };

    const summaryStyle: React.CSSProperties = {
      fontSize: "18px",
      fontWeight: 600,
      lineHeight: 1.5,
      color: "var(--vibes-near-black, #1a1a1a)",
      maxWidth: "260px",
    };

    const restartStyle: React.CSSProperties = {
      padding: "12px 28px",
      border: "2px solid var(--vibes-near-black, #1a1a1a)",
      borderRadius: "999px",
      background: "var(--vibes-near-black, #1a1a1a)",
      color: "var(--vibes-cream, #FFFEF0)",
      fontSize: "15px",
      fontWeight: 500,
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "opacity 0.15s ease",
    };

    return (
      <div style={containerStyle}>
        <div style={resultStyle}>
          <div style={{ fontSize: "48px" }}>✨</div>
          <p style={summaryStyle}>
            {"You're a "}
            <strong>{superpower}</strong>
            {" "}
            <strong>{time}</strong>
            {" person who loves "}
            <strong>{tool}</strong>
            {"!"}
          </p>
          <button
            style={restartStyle}
            onClick={handleRestart}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.7";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
            }}
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  const question = QUESTIONS[step];
  const progress = `${step + 1}/${QUESTIONS.length}`;

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    flexShrink: 0,
  };

  const progressStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--vibes-near-black, #1a1a1a)",
    opacity: 0.5,
    letterSpacing: "0.04em",
  };

  const dotsStyle: React.CSSProperties = {
    display: "flex",
    gap: "6px",
  };

  const questionStyle: React.CSSProperties = {
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: 1.3,
    marginBottom: "20px",
    color: "var(--vibes-near-black, #1a1a1a)",
    flexShrink: 0,
  };

  const choicesStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    flex: 1,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={progressStyle}>{progress}</span>
        <div style={dotsStyle}>
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background:
                  i < answers.length
                    ? "var(--vibes-near-black, #1a1a1a)"
                    : i === step
                      ? "var(--vibes-variant-blue, #3b82f6)"
                      : "rgba(26,26,26,0.2)",
                transition: "background 0.2s ease",
              }}
            />
          ))}
        </div>
      </div>

      <div style={questionStyle}>{question.text}</div>

      <div style={choicesStyle}>
        {question.choices.map((choice, idx) => {
          const isPressed = pressed === idx;
          const choiceStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            padding: "13px 18px",
            border: "2px solid var(--vibes-near-black, #1a1a1a)",
            borderRadius: "999px",
            cursor: "pointer",
            userSelect: "none",
            fontSize: "15px",
            fontWeight: 500,
            color: "var(--vibes-near-black, #1a1a1a)",
            background: "transparent",
            fontFamily: "inherit",
            textAlign: "left",
            width: "100%",
            boxSizing: "border-box",
            transition: "background 0.12s ease, color 0.12s ease, transform 0.1s ease, opacity 0.1s ease",
            transform: isPressed ? "scale(0.97)" : "scale(1)",
            opacity: isPressed ? 0.75 : 1,
          };

          return (
            <button
              key={idx}
              style={choiceStyle}
              onClick={() => handleChoice(idx)}
              onPointerDown={() => setPressed(idx)}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--vibes-variant-blue, #3b82f6)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--vibes-cream, #FFFEF0)";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--vibes-variant-blue, #3b82f6)";
              }}
              onMouseLeave={(e) => {
                if (pressed !== idx) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "var(--vibes-near-black, #1a1a1a)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--vibes-near-black, #1a1a1a)";
                }
              }}
            >
              {choice}
            </button>
          );
        })}
      </div>
    </div>
  );
}
