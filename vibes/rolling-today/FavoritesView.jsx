import React from "react";
import RideCard from "./RideCard.jsx";
import { c } from "./styles.js";
import { prettyDate } from "./calendar-utils.js";

// The all-days Favorites screen: every day you've saved a ride, oldest first,
// empty days skipped, each day under its own header. Cards are condensed (no long
// descriptions or images) since this is a scan-your-plan view, not a browse view.
export default function FavoritesView({ favDates, favByDay, userId, favsByRide, canFavorite, toggleFavorite, notes, saveNote }) {
  if (favDates.length === 0) {
    return <div className={c.empty}>No favorites yet — tap the star on any ride to save it here.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      {favDates.map((date) => {
        const rides = favByDay[date];
        return (
          <section key={date}>
            <div className={c.dayHead}>
              <span>{prettyDate(date)}</span>
              <span className={c.dayHeadCount}>
                {rides.length} ride{rides.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className={c.list}>
              {rides.map((event) => (
                <RideCard
                  key={event.id}
                  event={event}
                  favs={favsByRide[String(event.id)] || []}
                  userId={userId}
                  canFavorite={canFavorite}
                  toggleFavorite={toggleFavorite}
                  note={notes[String(event.id)]}
                  saveNote={saveNote}
                  condensed
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
