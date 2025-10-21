import React, { useState } from "react";
import { callAI } from "call-ai";

export default function SimpleChatTest() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setResponse("Loading...");

    try {
      console.log("🔵 [TEST-VIBE] Starting callAI with input:", input);

      const result = await callAI({
        messages: [{ role: "user", content: input }],
        model: "anthropic/claude-3-5-sonnet:beta",
      });

      console.log("🔵 [TEST-VIBE] callAI completed successfully");
      setResponse(result);
    } catch (error) {
      console.error("🔴 [TEST-VIBE] callAI error:", error);
      setResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Simple Chat Test</h1>
      <p>Test vibe for verifying auth token flow and API endpoint selection</p>

      <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          style={{
            width: "100%",
            height: "100px",
            padding: "10px",
            fontSize: "16px",
            border: "2px solid #ccc",
            borderRadius: "4px",
          }}
        />

        <button
          type="submit"
          id="chat-submit"
          disabled={loading || !input.trim()}
          style={{
            marginTop: "10px",
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: loading ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>

      {response && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#f5f5f5",
            borderRadius: "4px",
            whiteSpace: "pre-wrap",
          }}
        >
          <strong>Response:</strong>
          <div>{response}</div>
        </div>
      )}
    </div>
  );
}
