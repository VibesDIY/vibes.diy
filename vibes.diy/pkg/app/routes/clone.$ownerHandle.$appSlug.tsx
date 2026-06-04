import { redirect } from "react-router";

// The good.vibes.diy landing pages link the Clone button to
// `/clone/<owner>/<slug>`. The app implements "clone" as the remix flow with
// `?skipChat=true` (see routes/remix.$ownerHandle.$appSlug.tsx), so this route
// is a thin server-side redirect that forwards into that flow. Keeping it as a
// real route means every good-vibes landing page works without the catch-all
// 404, and clone stays a single source of truth in the remix component.
//
// The param type is an inline structural type (matching the viewer route's
// loader) rather than react-router's `LoaderFunctionArgs`, whose stricter
// build-time typecheck also demands `url`/`pattern` fields.
export function loader(loaderCtx: { params: Record<string, string | undefined> }) {
  const { ownerHandle, appSlug, fsId } = loaderCtx.params;
  const base = `/remix/${ownerHandle}/${appSlug}`;
  const path = fsId ? `${base}/${fsId}` : base;
  return redirect(`${path}?skipChat=true`);
}
