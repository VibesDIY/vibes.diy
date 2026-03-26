import React from "react";
import { createRoot } from "react-dom/client";

const h = React.createElement;

function getCookie(name) {
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return "";
}

function App({ keys }) {
  const current = getCookie("Vibes-Backend") || "(default)";

  function select(key) {
    if (key) {
      document.cookie = "Vibes-Backend=" + key + "; Path=/; SameSite=Lax; Max-Age=86400";
    } else {
      document.cookie = "Vibes-Backend=; Path=/; SameSite=Lax; Max-Age=0";
    }
    window.location.href = "/";
  }

  return h("div", { style: { fontFamily: "system-ui", maxWidth: "400px", margin: "80px auto", padding: "20px" } },
    h("h2", null, "stable-entry"),
    h("p", null, "Current backend: ", h("strong", null, current)),
    h("div", null,
      keys.length > 0
        ? h("div", null,
            h("p", null, "Select a backend:"),
            h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },
              keys.map(function(key) {
                return h("button", {
                  key: key,
                  onClick: function() { select(key); },
                  style: {
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontWeight: current === key ? "bold" : "normal",
                    border: current === key ? "2px solid #333" : "1px solid #ccc",
                    borderRadius: "4px",
                    background: current === key ? "#f0f0f0" : "#fff"
                  }
                }, key);
              })
            )
          )
        : h("p", { style: { color: "#888" } }, "No alternate backends configured."),
      current !== "(default)"
        ? h("button", {
            onClick: function() { select(""); },
            style: {
              padding: "8px 16px",
              cursor: "pointer",
              border: "1px solid #ccc",
              borderRadius: "4px",
              background: "#fff",
              marginTop: "8px"
            }
          }, "Reset to default")
        : null
    )
  );
}

fetch("/.stable-entry/config.json")
  .then(function(r) { return r.json(); })
  .then(function(config) {
    createRoot(document.getElementById("root")).render(h(App, { keys: config.keys }));
  });
