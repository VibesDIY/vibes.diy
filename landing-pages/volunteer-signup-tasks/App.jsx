import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function AccessRequests({ requests, database, ViewerTag }) {
  const pending = requests.filter(r => r.status === "pending")
  const decided = requests.filter(r => r.status !== "pending")

  async function approve(req) {
    await database.put({ ...req, status: "approved", decidedAt: Date.now() })
    await database.put({ type: "roleGrant", userHandle: req.userHandle, role: "volunteers" })
  }
  async function reject(req) {
    await database.put({ ...req, status: "rejected", decidedAt: Date.now() })
  }

  return (
    <section id="access-requests" className="mb-[var(--spacing)]">
      <h2 className="text-xl font-semibold mb-3 text-[var(--text-primary)]">Access Requests</h2>
      {pending.length === 0 && <p className="text-[var(--text-secondary)] text-sm mb-3">No pending requests.</p>}
      <ul className="flex flex-col gap-2 mb-4">
        {pending.map(r => (
          <li key={r._id} className="border border-[var(--border)] rounded-[var(--radius)] p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ViewerTag userHandle={r.userHandle} />
              <span className="text-sm text-[var(--text-secondary)]">requested as "{r.displayName}"</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => approve(r)} className="flex-1 min-h-[44px] bg-[var(--text-primary)] text-[var(--background)] rounded-[var(--radius)] px-3 py-2 font-semibold">
                Approve
              </button>
              <button onClick={() => reject(r)} className="flex-1 min-h-[44px] border border-[var(--border)] rounded-[var(--radius)] px-3 py-2">
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
      {decided.length > 0 && (
        <details>
          <summary className="text-sm text-[var(--text-secondary)] cursor-pointer">Past decisions ({decided.length})</summary>
          <ul className="flex flex-col gap-1 mt-2">
            {decided.map(r => (
              <li key={r._id} className="text-sm flex items-center gap-2 py-1">
                <ViewerTag userHandle={r.userHandle} />
                <span className="text-[var(--text-secondary)] capitalize">{r.status}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function TaskBoard({ viewer, isOwner, isVolunteer, tasks, signups, database, ViewerTag }) {
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [estimate, setEstimate] = React.useState("")
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  async function suggest() {
    if (!title.trim()) return
    setIsSuggesting(true)
    try {
      const res = await callAI(`A volunteer task is titled "${title.trim()}". Suggest a brief description (1-2 sentences) and an estimated time commitment (e.g. "2 hours", "30 minutes").`, {
        schema: { properties: { description: { type: "string" }, estimate: { type: "string" } } }
      })
      const data = JSON.parse(res)
      setDescription(data.description || "")
      setEstimate(data.estimate || "")
    } finally {
      setIsSuggesting(false)
    }
  }

  async function createTask(e) {
    e.preventDefault()
    if (!title.trim()) return
    await database.put({
      type: "task",
      title: title.trim(),
      description: description.trim(),
      estimate: estimate.trim(),
      createdAt: Date.now(),
    })
    setTitle(""); setDescription(""); setEstimate("")
  }

  async function toggleSignup(task, mySignup) {
    if (mySignup) {
      await database.del(mySignup._id)
    } else {
      await database.put({
        type: "signup",
        taskId: task._id,
        userHandle: viewer.userHandle,
        createdAt: Date.now(),
      })
    }
  }

  return (
    <section id="task-board" className="mb-[var(--spacing)]">
      <h2 className="text-xl font-semibold mb-3 text-[var(--text-primary)]">Tasks</h2>

      {isOwner && (
        <form onSubmit={createTask} className="border border-[var(--border)] rounded-[var(--radius)] p-3 mb-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 border border-[var(--border)] rounded-[var(--radius)] px-3 py-3 min-h-[44px] bg-[var(--background)]"
            />
            <button type="button" onClick={suggest} disabled={isSuggesting || !title.trim()} className="min-h-[44px] px-3 border border-[var(--border)] rounded-[var(--radius)] disabled:opacity-50 flex items-center gap-1">
              {isSuggesting ? (
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>
              ) : "✨ AI"}
            </button>
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description"
            rows={2}
            className="border border-[var(--border)] rounded-[var(--radius)] px-3 py-2 bg-[var(--background)]"
          />
          <input
            value={estimate}
            onChange={e => setEstimate(e.target.value)}
            placeholder="Time estimate"
            className="border border-[var(--border)] rounded-[var(--radius)] px-3 py-3 min-h-[44px] bg-[var(--background)]"
          />
          <button type="submit" className="bg-[var(--text-primary)] text-[var(--background)] rounded-[var(--radius)] px-4 py-3 min-h-[44px] font-semibold">
            Create Task
          </button>
        </form>
      )}

      {tasks.length === 0 && <p className="text-[var(--text-secondary)] text-sm">No tasks yet.</p>}
      <ul className="flex flex-col gap-3">
        {tasks.map(task => {
          const taskSignups = signups.filter(s => s.taskId === task._id)
          const mySignup = viewer ? taskSignups.find(s => s.userHandle === viewer.userHandle) : null
          return (
            <li key={task._id} className="border border-[var(--border)] rounded-[var(--radius)] p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-semibold">{task.title}</h3>
                  {task.estimate && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{task.estimate}</p>}
                </div>
                {isOwner && (
                  <button onClick={() => database.del(task._id)} className="text-xs text-[var(--text-secondary)] underline">delete</button>
                )}
              </div>
              {task.description && <p className="text-sm text-[var(--text-secondary)]">{task.description}</p>}
              {taskSignups.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-[var(--text-secondary)]">Helping:</span>
                  {taskSignups.map(s => <ViewerTag key={s._id} userHandle={s.userHandle} />)}
                </div>
              )}
              {isVolunteer && (
                <button
                  onClick={() => toggleSignup(task, mySignup)}
                  className={`min-h-[44px] rounded-[var(--radius)] px-3 py-2 font-semibold ${mySignup ? "border border-[var(--border)]" : "bg-[var(--text-primary)] text-[var(--background)]"}`}
                >
                  {mySignup ? "Cancel my signup" : "I'll help"}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function RequestAccessForm({ viewer, database, myRequest }) {
  const [name, setName] = React.useState("")

  async function submit(e) {
    e.preventDefault()
    if (!viewer || !name.trim()) return
    await database.put({
      type: "accessRequest",
      userHandle: viewer.userHandle,
      displayName: name.trim(),
      status: "pending",
      createdAt: Date.now(),
    })
    setName("")
  }

  return (
    <section id="request-access" className="mb-[var(--spacing)]">
      <h2 className="text-xl font-semibold mb-3 text-[var(--text-primary)]">Request to Volunteer</h2>
      {!viewer && <p className="text-[var(--text-secondary)] text-sm">Sign in above to request access.</p>}
      {viewer && myRequest && (
        <div className="border border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)]">
          <p className="text-sm text-[var(--text-secondary)] mb-1">Status</p>
          <p className="font-semibold capitalize">{myRequest.status}</p>
          {myRequest.status === "pending" && <p className="text-sm text-[var(--text-secondary)] mt-2">Waiting on organizer approval.</p>}
          {myRequest.status === "rejected" && <p className="text-sm text-[var(--text-secondary)] mt-2">Your request wasn't approved.</p>}
        </div>
      )}
      {viewer && !myRequest && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="border border-[var(--border)] rounded-[var(--radius)] px-3 py-3 min-h-[44px] bg-[var(--background)]"
          />
          <button type="submit" className="bg-[var(--text-primary)] text-[var(--background)] rounded-[var(--radius)] px-4 py-3 min-h-[44px] font-semibold">
            Submit Request
          </button>
        </form>
      )}
    </section>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { database, useLiveQuery, access } = useFireproof("volunteerBoard")

  const { docs: requests } = useLiveQuery("type", { key: "accessRequest" })
  const { docs: tasks } = useLiveQuery("type", { key: "task", descending: true })
  const { docs: signups } = useLiveQuery("type", { key: "signup" })

  const myRequest = viewer ? requests.find(r => r.userHandle === viewer.userHandle) : null
  const isVolunteer = access.hasRole("volunteers")

  const c = {
    page: 'min-h-screen bg-[var(--background)] font-[var(--font-family)] text-[var(--text-primary)]',
    header: 'sticky top-0 bg-[var(--background)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between gap-3 z-10',
    title: 'text-lg font-bold tracking-tight',
    main: 'max-w-2xl mx-auto px-4 py-[var(--spacing)]',
    badge: 'text-xs uppercase tracking-wide text-[var(--text-secondary)] border border-[var(--border)] rounded-[var(--radius-sm)] px-2 py-1',
  }

  if (isViewerPending) return <div className={c.page} />

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.title}>Volunteer Board</div>
          {isOwner && <span className={c.badge}>Organizer</span>}
        </div>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        {isOwner && <AccessRequests requests={requests} database={database} ViewerTag={ViewerTag} />}
        <TaskBoard
          viewer={viewer}
          isOwner={isOwner}
          isVolunteer={isVolunteer}
          tasks={tasks}
          signups={signups}
          database={database}
          ViewerTag={ViewerTag}
        />
        {!isOwner && <RequestAccessForm viewer={viewer} database={database} myRequest={myRequest} />}
      </main>
    </div>
  )
}