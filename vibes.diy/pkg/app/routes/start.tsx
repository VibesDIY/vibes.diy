import React from "react";
import { Link } from "react-router";
import { gridBackground, cx } from "@vibes.diy/base";
import { STARTER_CATEGORIES, starterVibeHref } from "./starter-graph.js";

export function meta() {
  return [
    { title: "Start - Vibes DIY" },
    {
      name: "description",
      content: "Pick a starting point and make it yours — tap to change a live app, no sign-in.",
    },
  ];
}

// The /start on-ramp (#2941/#1896): the category picker. Each tile is a door into
// a curated starter vibe that's already running — the visitor lands in a live app
// and taps curated chips to change it instantly (the spine + the cached-suggestion
// lanes do the rest). Anonymous; no sign-in. v1 ships the Music tile; adding
// categories is a data-only edit in `starter-graph.ts`.
export default function Start() {
  return (
    <div className={cx("min-h-screen w-full", gridBackground)}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Pick a starting point</h1>
          <p className="text-base opacity-70">Land in a live app and make it yours — just tap. No sign-in needed.</p>
        </header>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STARTER_CATEGORIES.map((cat) => (
            <li key={cat.category}>
              <Link
                to={starterVibeHref(cat.entry)}
                className={cx(
                  "flex h-full flex-col gap-2 rounded-2xl border p-5 transition-colors",
                  "border-[var(--color-light-decorative-01,#ddd)] bg-[var(--color-light-background-01,#fff)]",
                  "hover:border-[var(--color-light-decorative-00,#bbb)] hover:bg-[var(--color-light-background-00,#f6f6f6)]"
                )}
              >
                <span className="text-xl font-semibold">{cat.label}</span>
                <span className="text-sm opacity-70">{cat.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
