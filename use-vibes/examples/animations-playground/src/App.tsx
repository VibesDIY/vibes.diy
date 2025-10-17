import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Menu, WelcomeToVibes } from './Pages';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/menu" replace />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/welcome-to-vibes" element={<WelcomeToVibes />} />
      </Routes>
    </Router>
  );
}

export default App;
