import React, { useState } from "react";
import { Icon, ICONS } from "./Icon.jsx";
import { c } from "./styles.js";

export default function FriendsPanel({ signedIn, userId, connectUrl, linkedFriend, friends, friendedBy, addFriend, removeFriend }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(connectUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    } catch (e) {}
  };
  const followingSet = new Set(friends.map((f) => f.friendSlug));
  return (
    <section className={c.panel}>
      <h2 className={c.panelH}>Your Crew</h2>
      <div className={c.panelSub}>Follow friends to see their picks on every ride — and only theirs.</div>

      {!signedIn ? (
        <div className={c.signinCallout}>
          <Icon d={ICONS.user} size={16} />
          <span>
            {linkedFriend ? `Sign in to follow ${linkedFriend}` : "Sign in via the Vibes DIY logo to follow friends and share your own link."}
          </span>
        </div>
      ) : (
        <>
          <div className={c.panelSub}>Share your link — when a friend opens it, they follow you back.</div>
          <div className={c.linkRow}>
            <input className={c.linkInput} readOnly value={connectUrl} onFocus={(e) => e.target.select()} />
            <button className={`${c.actionBtn} ${c.actionLink}`} onClick={copy}>
              <Icon d={ICONS.copy} size={16} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {linkedFriend && linkedFriend !== userId && !followingSet.has(linkedFriend) && (
            <div className={c.skip} style={{ marginBottom: 24 }}>
              <Icon d={ICONS.spark} />
              <span>
                Following <strong>{linkedFriend}</strong> from your invite link.
              </span>
            </div>
          )}

          <h3 className={c.favLabel} style={{ marginBottom: 8 }}>Following ({friends.length})</h3>
          {friends.length === 0 && <div className={c.panelSub}>Nobody yet — share your link above.</div>}
          {friends.map((f) => (
            <div key={f._id} className={c.friendRow}>
              <div className={c.avatarFallback}>{(f.friendSlug || "?").slice(0, 2)}</div>
              <span className="flex-1 font-bold">{f.friendSlug}</span>
              <button className={c.navBtn} onClick={() => removeFriend(f.friendSlug)} aria-label={`Unfollow ${f.friendSlug}`}>
                <Icon d={ICONS.x} size={16} />
              </button>
            </div>
          ))}

          {friendedBy.length > 0 && (
            <>
              <h3 className={c.favLabel} style={{ margin: "20px 0 8px" }}>Followers ({friendedBy.length})</h3>
              {friendedBy.map((f) => (
                <div key={f._id} className={c.friendRow}>
                  <div className={c.avatarFallback}>{(f.userId || "?").slice(0, 2)}</div>
                  <span className="flex-1 font-bold">{f.userId}</span>
                  {!followingSet.has(f.userId) && (
                    <button className={c.navBtn} onClick={() => addFriend(f.userId)}>
                      Follow back
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
