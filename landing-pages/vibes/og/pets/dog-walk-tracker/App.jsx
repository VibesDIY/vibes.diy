import React from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "",
  header: "",
  dogRoster: "",
  walkTimer: "",
  history: "",
};

function DogRoster() {
  return (
    <section id="dog-roster" className={classNames.dogRoster}>
      <h2>Dogs</h2>
      {/* dog list + add dog form */}
    </section>
  );
}

function WalkTimer() {
  return (
    <section id="walk-timer" className={classNames.walkTimer}>
      <h2>Active Walk</h2>
      {/* timer + stop form */}
    </section>
  );
}

function History() {
  return (
    <section id="history" className={classNames.history}>
      <h2>Today's Summary</h2>
      {/* daily summary + streaks */}
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1>Dog Walk Tracker</h1>
      </header>
      <DogRoster />
      <WalkTimer />
      <History />
    </main>
  );
}