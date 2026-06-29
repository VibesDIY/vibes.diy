import React from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "",
  header: "",
  banner: "",
  meds: "",
  vets: "",
};

function Banner() {
  return (
    <section id="banner" className={classNames.banner}>
      {/* due-today reminders */}
    </section>
  );
}

function Meds({ activePet }) {
  return (
    <section id="meds" className={classNames.meds}>
      <h2>Medications</h2>
      {/* med list + add form */}
    </section>
  );
}

function Vets({ activePet }) {
  return (
    <section id="vets" className={classNames.vets}>
      <h2>Vet &amp; Vaccinations</h2>
      {/* vet visit + vaccine log */}
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1>Pet Med Tracker</h1>
      </header>
      <Banner />
      <Meds />
      <Vets />
    </main>
  );
}