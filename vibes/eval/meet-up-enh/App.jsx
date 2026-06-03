function ConfirmedSlot({ database, isOwner }) {
  const { useLiveQuery } = useFireproof("availabilityVault");
  const { docs: confirmed } = useLiveQuery("type", { key: "confirmed", descending: true, limit: 1 });
  const final = confirmed[0];

  return (
    <section id="confirmed" className="px-5 py-5">
      <h2 className="text-[oklch(1.00_0.000_0)] font-['Archivo_Black'] text-sm uppercase tracking-wider mb-3">Final Directive</h2>
      {final ? (
        <div className="border-2 border-[oklch(1.00_0.000_0)] p-4">
          <p className="text-[oklch(0.65_0.02_257)] font-['Roboto_Mono'] text-[10px] uppercase tracking-widest mb-2">
            // confirmed
          </p>
          <p className="text-[oklch(1.00_0.000_0)] font-['Archivo_Black'] text-xl">{final.time}</p>
          <p className="text-[oklch(0.55_0.02_257)] font-['Roboto_Mono'] text-[10px] mt-2">
            locked {new Date(final.confirmedAt).toLocaleString()}
          </p>
          {isOwner && (
            <button
              onClick={() => database.del(final._id)}
              className="mt-3 text-[oklch(0.65_0.02_257)] font-['Roboto_Mono'] text-[10px] uppercase tracking-widest underline"
            >
              // revoke
            </button>
          )}
        </div>
      ) : (
        <p className="text-[oklch(0.55_0.02_257)] font-['Roboto_Mono'] text-xs">pending organizer decision</p>
      )}
    </section>
  );
}
