import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

const YEARS = ["2023", "2024", "2025"]
const STATUSES = ["", "sent", "received", "skipped"]

const classNames = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-6 font-['Space_Grotesk',sans-serif] text-[oklch(0.15_0.02_280)]",
  header: "max-w-5xl mx-auto mb-6",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-5xl mx-auto mb-6 p-5 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
  featureTitle: "text-sm font-bold uppercase tracking-[0.1em] mb-3",
}

function Ledger() {
  return (
    <section id="ledger" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Recipients</h2>
      {/* table lands here */}
    </section>
  )
}

function QuickAdd() {
  return (
    <section id="quick-add" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Quick Add</h2>
      {/* form lands here */}
    </section>
  )
}

function LabelSheet() {
  return (
    <section id="label-sheet" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Address Labels</h2>
      {/* print view lands here */}
    </section>
  )
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Holiday Card Ledger</h1>
        <p className="text-xs uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mt-1">The recipe-card box for stamps &amp; good intentions</p>
      </header>
      <Ledger />
      <QuickAdd />
      <LabelSheet />
    </main>
  )
}