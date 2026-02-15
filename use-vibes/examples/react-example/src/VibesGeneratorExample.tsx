import { useState } from "react";
import { useVibes } from "use-vibes";
import "./App.css";
import "./VibesGeneratorExample.css";

function VibesGeneratorExample() {
  const [inputPrompt, setInputPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [showCode, setShowCode] = useState(false);

  // Use the useVibes hook with the active prompt
  const { App, code, loading, error, progress, regenerate } = useVibes(
    activePrompt,
    { skip: !activePrompt } // Skip generation if no active prompt
  );

  const examplePrompts = [
    "a colorful button with hover effects",
    "a simple contact form with name and email",
    "a countdown timer",
    "a weather card component",
    "a pricing table with three tiers",
    "a testimonial card with avatar",
    "a progress bar component",
    "a modal dialog with close button",
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputPrompt(e.target.value);
  };

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim()) return;

    // Set the active prompt to trigger generation
    setActivePrompt(inputPrompt.trim());
    setShowCode(false);
  };

  const handleExamplePrompt = (prompt: string) => {
    setInputPrompt(prompt);
    setActivePrompt(prompt);
    setShowCode(false);
  };

  const handleRegenerate = () => {
    regenerate();
    setShowCode(false);
  };

  return (
    <div className="container">
      <h1>Vibes Generator</h1>
      <p style={{ marginBottom: "2rem", color: "#666", fontSize: "1.1rem" }}>
        Generate React components from text prompts using AI. Describe what you want and watch it come to life!
      </p>

      {/* Input Section */}
      <div
        style={{
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          padding: "1.5rem",
          marginBottom: "2rem",
          border: "1px solid #e9ecef",
        }}
      >
        <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label htmlFor="prompt-input" style={{ fontWeight: "500", color: "#333" }}>
            Describe the component you want to generate:
          </label>
          <textarea
            id="prompt-input"
            value={inputPrompt}
            onChange={handleInputChange}
            placeholder="e.g., a blue button with rounded corners that says 'Click me!'"
            rows={3}
            style={{
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "1rem",
              resize: "vertical",
              fontFamily: "inherit",
            }}
            disabled={loading}
          />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="submit"
              disabled={!inputPrompt.trim() || loading}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: loading ? "#ccc" : "#007acc",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "1rem",
                fontWeight: "500",
              }}
            >
              {loading ? "Generating..." : "Generate Component"}
            </button>
            {App && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={loading}
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "transparent",
                  color: "#007acc",
                  border: "1px solid #007acc",
                  borderRadius: "4px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "1rem",
                }}
              >
                Regenerate
              </button>
            )}
          </div>
        </form>

        {/* Example Prompts */}
        <div style={{ marginTop: "1.5rem" }}>
          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#666" }}>Try these examples:</p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            {examplePrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleExamplePrompt(prompt)}
                disabled={loading}
                style={{
                  padding: "0.25rem 0.5rem",
                  backgroundColor: "white",
                  color: "#007acc",
                  border: "1px solid #007acc",
                  borderRadius: "16px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "0.8rem",
                  whiteSpace: "nowrap",
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {loading && (
        <div
          style={{
            backgroundColor: "#e3f2fd",
            borderRadius: "8px",
            padding: "1.5rem",
            marginBottom: "2rem",
            border: "1px solid #bbdefb",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div
              style={{
                width: "20px",
                height: "20px",
                border: "2px solid #007acc",
                borderTop: "2px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <span style={{ color: "#1976d2", fontWeight: "500" }}>
              Generating your component... ({Math.round(Math.max(0, Math.min(100, progress)))}%)
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: "8px",
              backgroundColor: "#e0e0e0",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(Math.max(0, Math.min(100, progress)))}%`,
                height: "100%",
                backgroundColor: "#007acc",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Error Section */}
      {error && (
        <div
          style={{
            backgroundColor: "#ffebee",
            borderRadius: "8px",
            padding: "1.5rem",
            marginBottom: "2rem",
            border: "1px solid #ffcdd2",
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#c62828" }}>Generation Failed</h3>
          <p style={{ margin: "0", color: "#d32f2f" }}>{error.message}</p>
        </div>
      )}

      {/* Generated Component Section */}
      {App && !loading && (
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "1.5rem",
            marginBottom: "2rem",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h3 style={{ margin: "0", color: "#333" }}>Generated Component</h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => setShowCode(!showCode)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: showCode ? "#007acc" : "transparent",
                  color: showCode ? "white" : "#007acc",
                  border: "1px solid #007acc",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                {showCode ? "Hide Code" : "View Code"}
              </button>
            </div>
          </div>

          {/* Component Preview */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              padding: "2rem",
              backgroundColor: "#fafafa",
              minHeight: "150px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <App />
          </div>

          {/* Code Display */}
          {showCode && code && (
            <div style={{ marginTop: "1rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#333" }}>Generated Code:</h4>
              <pre
                style={{
                  backgroundColor: "#f5f5f5",
                  border: "1px solid #e0e0e0",
                  borderRadius: "4px",
                  padding: "1rem",
                  overflow: "auto",
                  fontSize: "0.85rem",
                  lineHeight: "1.4",
                  color: "#333",
                  fontFamily: 'Monaco, "Lucida Console", monospace',
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {code}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #e9ecef",
        }}
      >
        <h3 style={{ margin: "0 0 0.5rem 0", color: "#333" }}>How it Works</h3>
        <ul style={{ margin: "0", color: "#666", lineHeight: "1.6", paddingLeft: "1.5rem" }}>
          <li>Enter a description of the React component you want to create</li>
          <li>Click "Generate Component" to create it with AI</li>
          <li>View the live component preview above</li>
          <li>Click "View Code" to see the generated JSX source code</li>
          <li>Use "Regenerate" to create a new variation of the same prompt</li>
          <li>Components are cached - identical prompts will load instantly</li>
        </ul>
      </div>
    </div>
  );
}

export default VibesGeneratorExample;
