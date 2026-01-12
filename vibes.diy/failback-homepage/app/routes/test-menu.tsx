import React from "react";
import { HiddenMenuWrapper } from "../components/vibes/HiddenMenuWrapper/HiddenMenuWrapper.js";
import { VibesPanel } from "../components/vibes/VibesPanel.js";

export default function TestMenu() {
  return (
    <HiddenMenuWrapper menuContent={<VibesPanel />}>
      <div style={{ padding: "24px", minHeight: "100vh" }}>
        <h1 style={{ marginBottom: "1rem" }}>Test del Menú de Vibes</h1>
        <p style={{ marginBottom: "2rem", color: "#666", fontSize: "1.1rem" }}>
          Este es un espacio de prueba para el componente HiddenMenuWrapper con
          VibesPanel. Haz clic en el botón flotante para abrir el menú.
        </p>

        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>Características del menú:</h2>
          <ul style={{ paddingLeft: "1.5rem", lineHeight: "1.8" }}>
            <li>HiddenMenuWrapper proporciona un menú deslizable desde arriba</li>
            <li>VibesPanel contiene los botones de Login, Remix e Invite</li>
            <li>Animación de rebote en el primer render</li>
            <li>Se puede cerrar con la tecla Escape</li>
            <li>Incluye trampa de foco para accesibilidad</li>
          </ul>
        </div>

        <div
          style={{
            padding: "2rem",
            background: "#f5f5f5",
            borderRadius: "8px",
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ marginBottom: "1rem" }}>Contenido de ejemplo</h3>
          <p style={{ marginBottom: "1rem" }}>
            Este contenido se mantiene visible mientras el menú está abierto o cerrado.
            El HiddenMenuWrapper gestiona la transición suave entre estados.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button
              style={{
                padding: "0.5rem 1rem",
                background: "#007acc",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Botón de ejemplo 1
            </button>
            <button
              style={{
                padding: "0.5rem 1rem",
                background: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Botón de ejemplo 2
            </button>
            <button
              style={{
                padding: "0.5rem 1rem",
                background: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Botón de ejemplo 3
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Instrucciones de uso:</h3>
          <ol style={{ paddingLeft: "1.5rem", lineHeight: "1.8" }}>
            <li>Busca el botón flotante de Vibes en la parte superior derecha</li>
            <li>Haz clic para abrir el menú deslizable</li>
            <li>Explora las opciones del panel: Logout, Remix, Invite y Home</li>
            <li>Presiona Escape o haz clic en el botón de nuevo para cerrar</li>
          </ol>
        </div>
      </div>
    </HiddenMenuWrapper>
  );
}
