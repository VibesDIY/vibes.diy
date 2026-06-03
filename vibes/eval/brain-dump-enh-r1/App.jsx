  const { database: privateDb, useLiveQuery: usePrivate } = useFireproof("brainDumps")
  const { database: sharedDb, useLiveQuery: useShared } = useFireproof("sharedLists")
  const { docs: privateLists } = usePrivate("type", { key: "list", descending: true })
  const { docs: sharedLists } = useShared("type", { key: "list", descending: true })

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Brain Sort</h1>
          <p className="text-xs text-white/50">{isOwner ? "Dump thoughts. Get lists." : "Team lists, read-only."}</p>
        </div>
        <ViewerTag />
      </header>

      <div className="grid md:grid-cols-2 gap-4 p-4">
        <BrainDumpPane c={c} database={privateDb} isOwner={isOwner} />
        <ListsPane c={c} privateDb={privateDb} sharedDb={sharedDb} privateLists={privateLists} sharedLists={sharedLists} isOwner={isOwner} />
      </div>
    </main>
  )
}