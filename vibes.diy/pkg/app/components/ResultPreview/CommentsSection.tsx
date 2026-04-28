import React, { useCallback, useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { COMMENTS_DB_NAME } from "@vibes.diy/api-types";

// authorUserId / authorDisplay / createdAt are stamped client-side at post
// time. The server writes the doc verbatim under the new ACL model, so the
// client owns identity fields.
interface CommentDoc {
  _id: string;
  body?: string;
  authorUserId?: string;
  authorDisplay?: string;
  createdAt?: string;
}

interface CommentsSectionProps {
  userSlug: string;
  appSlug: string;
  /** Owner or editor — controls whether the viewer can delete other people's comments. */
  canModerate: boolean;
  /** When true, the ACL is editors-only and the viewer lacks write access. */
  composerDisabled?: boolean;
}

function deriveAuthorDisplay(user: ReturnType<typeof useUser>["user"]): string {
  if (!user) return "anonymous";
  if (user.username) return user.username;
  if (user.fullName) return user.fullName;
  const composed = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  if (composed) return composed;
  return user.primaryEmailAddress?.emailAddress ?? "anonymous";
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export function CommentsSection({ userSlug, appSlug, canModerate, composerDisabled }: CommentsSectionProps) {
  const { vibeDiyApi } = useVibesDiy();
  const { isSignedIn, userId: viewerUserId } = useAuth();
  const { user } = useUser();
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const reload = useCallback(async () => {
    const res = await vibeDiyApi.queryDocs({ userSlug, appSlug, dbName: COMMENTS_DB_NAME });
    if (res.isOk()) {
      const docs = res.Ok().docs as unknown as CommentDoc[];
      docs.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
      setComments(docs);
    }
  }, [vibeDiyApi, userSlug, appSlug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // Subscribe + listen for live updates. Unregister on unmount so each
  // open/close cycle of the parent modal doesn't accumulate live listeners
  // (otherwise every doc change fires reload() N times per session).
  useEffect(() => {
    void vibeDiyApi.subscribeDocs({ userSlug, appSlug, dbName: COMMENTS_DB_NAME });
    const unsubscribe = vibeDiyApi.onDocChanged((evtUserSlug, evtAppSlug, evtDbName) => {
      if (evtUserSlug === userSlug && evtAppSlug === appSlug && evtDbName === COMMENTS_DB_NAME) {
        void reload();
      }
    });
    return unsubscribe;
  }, [vibeDiyApi, userSlug, appSlug, reload]);

  async function handlePost() {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    setError(undefined);
    const res = await vibeDiyApi.putDoc({
      userSlug,
      appSlug,
      dbName: COMMENTS_DB_NAME,
      doc: {
        body: text,
        authorUserId: viewerUserId,
        authorDisplay: deriveAuthorDisplay(user),
        createdAt: new Date().toISOString(),
      },
    });
    setPosting(false);
    if (res.isOk()) {
      setBody("");
      void reload();
    } else {
      setError(res.Err().message ?? "Could not post comment.");
    }
  }

  async function handleDelete(c: CommentDoc) {
    const res = await vibeDiyApi.deleteDoc({ userSlug, appSlug, dbName: COMMENTS_DB_NAME, docId: c._id });
    if (res.isOk()) {
      void reload();
    } else {
      setError(res.Err().message ?? "Could not delete comment.");
    }
  }

  const canPost = isSignedIn && !composerDisabled;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Comments</h3>
      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">No comments yet.</p>
        ) : (
          comments.map((c) => {
            const canDelete = canModerate || (viewerUserId && viewerUserId === c.authorUserId);
            return (
              <div
                key={c._id}
                className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{c.authorDisplay ?? "anonymous"}</span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{formatTime(c.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300">{c.body}</p>
                {canDelete ? (
                  <div className="mt-1 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(c)}
                      className="text-[11px] text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {!isSignedIn ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Sign in to comment.</p>
      ) : composerDisabled ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Only collaborators can comment on this vibe.</p>
      ) : (
        <div className="space-y-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment…"
            rows={2}
            disabled={!canPost || posting}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2">
            {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : <span />}
            <button
              type="button"
              onClick={() => void handlePost()}
              disabled={!canPost || posting || body.trim().length === 0}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
