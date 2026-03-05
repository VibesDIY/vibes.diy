import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Explorer } from "./pages/Explorer.js";

export function App() {
  return (
    <Routes>
      <Route path="/dbexplore/:dbname/:docId?" element={<Explorer />} />
      <Route path="*" element={<Navigate to="/dbexplore/my-database" replace />} />
    </Routes>
  );
}
