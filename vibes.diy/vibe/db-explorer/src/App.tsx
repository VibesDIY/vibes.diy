import { Routes, Route, Navigate } from "react-router-dom";
import { Explorer } from "./pages/Explorer";

export function App() {
  return (
    <Routes>
      <Route path="/dbexplore/:dbname" element={<Explorer />} />
      <Route path="*" element={<Navigate to="/dbexplore/my-database" replace />} />
    </Routes>
  );
}
