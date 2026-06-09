import React from "react";
import ScheduleView from "./ScheduleView.jsx";

export default function FriendsView({
  friends,
  friendedBy,
  selectedFriend,
  setSelectedFriend,
  friendFavoriteEvents,
  friendShifts,
  canWrite,
  toggleFavorite,
  myFavIds,
  displayDays,
  getDateForDay,
  makeFriendSchedule,
  shiftStartRaw,
  shiftEndRaw,
  fmtTime,
  connectUrl,
  qrSrc,
  renderDeleteX,
  pendingDelete,
  ViewerTag,
  c,
}) {
  return (
    <div>
      <div className="flex flex-col items-center gap-4 p-6 bg-[#BACD32] rounded-2xl border-4 border-[#4A4A4A] mb-6">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <p className={`text-lg font-bold ${c.bodyText}`}>Scan to follow</p>
          <ViewerTag />
          <p className={`text-lg font-bold ${c.bodyText}`}>schedule</p>
        </div>
        <div className="bg-white rounded-2xl border-4 border-[#4A4A4A] p-4">
          <img src={qrSrc} alt="Connect QR code" width="320" height="320" />
        </div>
        <a href={connectUrl} target="_blank" rel="noopener noreferrer" className={c.btnPink}>
          Connect
        </a>
        <p className={`text-xs font-bold ${c.bodyText} break-all text-center max-w-md`}>{connectUrl}</p>
      </div>

      <div className="mb-6 p-6 bg-white rounded-2xl border-4 border-[#4A4A4A]">
        <p className={`text-sm font-bold mb-4 ${c.bodyText} italic`}>
          {friends.length + friendedBy.length > 0 ? "Click a friend to see their schedule" : "Add a friend to see their schedule"}
        </p>
        <h3 className={`text-xl font-black mb-4 ${c.bodyText}`}>Added You ({friendedBy.length})</h3>
        {friendedBy.length === 0 ? (
          <p className={`font-bold ${c.bodyText} mb-6`}>Nobody has scanned your QR yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3 mb-6">
            {friendedBy.map((f) => (
              <div
                key={`by-${f._id}`}
                className={`flex items-center gap-2 p-2 rounded-full border-2 border-[#4A4A4A] transition-all ${selectedFriend === f.userId ? "bg-[#CD6C0C]" : "bg-[#71AD44]"}`}
              >
                <button
                  onClick={() => setSelectedFriend(selectedFriend === f.userId ? null : f.userId)}
                  className="flex items-center"
                >
                  <ViewerTag userHandle={f.userId} />
                </button>
                {canWrite && renderDeleteX(f._id)}
              </div>
            ))}
          </div>
        )}

        <h3 className={`text-xl font-black mb-4 ${c.bodyText}`}>Following ({friends.length})</h3>
        {friends.length === 0 ? (
          <p className={`font-bold ${c.bodyText}`}>No friends yet — share your QR code above to connect.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {friends.map((f) => (
              <div
                key={f._id}
                className={`flex items-center gap-2 p-2 rounded-full border-2 border-[#4A4A4A] transition-all ${selectedFriend === f.friendSlug ? "bg-[#CD6C0C]" : "bg-[#BACD32]"}`}
              >
                <button
                  onClick={() => setSelectedFriend(selectedFriend === f.friendSlug ? null : f.friendSlug)}
                  className="flex items-center"
                >
                  <ViewerTag userHandle={f.friendSlug} />
                </button>
                {canWrite && renderDeleteX(f._id)}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFriend && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-2xl font-black ${c.bodyText}`}>Picks by</h3>
              <ViewerTag userHandle={selectedFriend} />
            </div>
            <button onClick={() => setSelectedFriend(null)} className={c.btnCyan}>
              Close
            </button>
          </div>
          <ScheduleView
            days={displayDays}
            getDateForDay={getDateForDay}
            buildSchedule={makeFriendSchedule}
            fmtTime={fmtTime}
            notes={null}
            c={c}
            shiftStartRaw={shiftStartRaw}
            shiftEndRaw={shiftEndRaw}
            emptyMessage="This friend hasn't picked any events yet."
            canWrite={false}
            onToggleFavorite={canWrite ? toggleFavorite : null}
            myFavIds={myFavIds}
          />
        </div>
      )}
    </div>
  );
}
