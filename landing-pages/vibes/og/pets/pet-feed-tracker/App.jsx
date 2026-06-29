import React from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "",
  header: "",
  roster: "",
  feedLog: "",
  warnings: "",
};

function Warnings() {
  return (
    <section id="warnings" className={classNames.warnings}>
      <h2>Warnings</h2>
      {/* overdue alerts */}
    </section>
  );
}

function Roster() {
  return (
    <section id="roster" className={classNames.roster}>
      <h2>Pets</h2>
      {/* pet cards with feed button */}
    </section>
  );
}

function FeedLog() {
  return (
    <section id="feed-log" className={classNames.feedLog}>
      <h2>Today's Feedings</h2>
      {/* timeline */}
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1>Pet Feed Tracker</h1>
      </header>
      <Warnings />
      <Roster />
      <FeedLog />
    </main>
  );
}