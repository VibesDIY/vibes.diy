import React from "react";
import { Icon, ICONS } from "./Icon.jsx";
import { pretty12, AUDIENCE_LABEL, AREA_LABEL } from "./calendar-utils.js";
import { c } from "./styles.js";
import NoteField from "./NoteField.jsx";

export default function RideCard({ event, favs = [], userId, canFavorite, toggleFavorite, note, saveNote }) {
  const mapUrl = event.address ? `https://maps.google.com/?q=${encodeURIComponent(event.address)}` : null;
  const imgUrl = event.image ? (event.image.startsWith("http") ? event.image : `https://www.shift2bikes.org${event.image}`) : null;
  const audLabel = AUDIENCE_LABEL[event.audience] || event.audience || "";
  const areaLabel = AREA_LABEL[event.area] || event.area || "";
  const myFav = favs.find((f) => (f.userId || "anonymous") === userId);

  return (
    <article className={c.card}>
      <div className={c.timeRow}>
        <span className={c.time}>{pretty12(event.time)}</span>
        {event.endtime && <span className={c.endTime}>→ {pretty12(event.endtime)}</span>}
        {event.timedetails && <span className={c.endTime}>· {event.timedetails}</span>}
      </div>
      <h2 className={c.title}>{event.title}</h2>

      <div className={c.badgeRow}>
        {audLabel && <span className={`${c.badge} ${c.badgeAud}`}>{audLabel}</span>}
        {areaLabel && <span className={`${c.badge} ${c.badgeArea}`}>{areaLabel}</span>}
        {event.loopride && <span className={`${c.badge} ${c.badgeLoop}`}>Loop Ride</span>}
        {event.ridelength && event.ridelength !== "--" && <span className={c.badge}>{event.ridelength} mi</span>}
      </div>

      {event.newsflash && (
        <div className={c.newsflash}>
          <Icon d={ICONS.spark} />
          <span>{event.newsflash}</span>
        </div>
      )}

      {imgUrl && <img className={c.img} src={imgUrl} alt="" loading="lazy" />}

      {event.venue && (
        <div className={c.venue}>
          <span className="mt-0.5 text-[#E83D6F]"><Icon d={ICONS.pin} /></span>
          <div>
            <div className={c.venueText}>{event.venue}</div>
            {mapUrl && (
              <a className={c.addr} href={mapUrl} target="_blank" rel="noreferrer">
                {event.address}
              </a>
            )}
            {event.locend && <div className="text-[0.8rem] text-[#1A1A1A]/65 mt-1">Ends: {event.locend}</div>}
          </div>
        </div>
      )}

      {event.organizer && (
        <div className={c.organizer}>
          <Icon d={ICONS.user} size={16} />
          <span>{event.organizer}</span>
        </div>
      )}

      {event.details && <p className={c.details}>{event.details}</p>}

      {favs.length > 0 && (
        <div className={c.favStrip}>
          <span className={c.favLabel}>{favs.length === 1 ? "1 friend rolling" : `${favs.length} friends rolling`}</span>
          <div className={c.avatarPile}>
            {favs.slice(0, 6).map((f) =>
              f.avatarUrl ? (
                <img key={f._id} src={f.avatarUrl} title={f.displayName} alt={f.displayName || "rider"} className={c.avatar} />
              ) : (
                <div key={f._id} className={c.avatarFallback} title={f.displayName}>
                  {(f.displayName || f.userId || "?").slice(0, 2)}
                </div>
              )
            )}
            {favs.length > 6 && <span className={c.avatarMore}>+{favs.length - 6}</span>}
          </div>
        </div>
      )}

      {canFavorite && (
        <div className="mb-3">
          <NoteField saved={note} onSave={(t) => saveNote(String(event.id), t)} className={c.noteArea} />
        </div>
      )}

      <div className={c.actions}>
        {canFavorite && (
          <button onClick={() => toggleFavorite(event)} aria-pressed={!!myFav} className={`${c.actionBtn} ${myFav ? c.actionFavOn : c.actionFavOff}`}>
            <Icon d={ICONS.heart} size={16} />
            {myFav ? "Favorited" : "Favorite"}
          </button>
        )}
        {event.exportable && (
          <a className={`${c.actionBtn} ${c.actionCal}`} href={event.exportable}>
            <Icon d={ICONS.cal} size={16} />
            Add to Calendar
          </a>
        )}
        {event.shareable && (
          <a className={`${c.actionBtn} ${c.actionLink}`} href={event.shareable} target="_blank" rel="noreferrer">
            <Icon d={ICONS.link} size={16} />
            Details
          </a>
        )}
        {event.weburl && (
          <a className={`${c.actionBtn} ${c.actionWeb}`} href={event.weburl} target="_blank" rel="noreferrer">
            <Icon d={ICONS.link} size={16} />
            {event.webname || "Site"}
          </a>
        )}
      </div>
    </article>
  );
}
