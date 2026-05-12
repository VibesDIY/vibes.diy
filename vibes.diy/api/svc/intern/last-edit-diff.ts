export interface DiffHunk {
  readonly oldStart: number; // 0-indexed
  readonly oldLines: readonly string[];
  readonly newLines: readonly string[];
}

// Myers-style longest common subsequence diff over line arrays.
// Returns hunks where adjacent unchanged lines are NOT included in oldLines/newLines.
export function lineDiff(before: string, after: string): DiffHunk[] {
  const oldArr = before.split("\n");
  const newArr = after.split("\n");
  const n = oldArr.length;
  const m = newArr.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldArr[i] === newArr[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hunks: DiffHunk[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && oldArr[i] === newArr[j]) {
      i++;
      j++;
      continue;
    }
    const oldStart = i;
    const oldLines: string[] = [];
    const newLines: string[] = [];
    while (i < n && j < m && oldArr[i] !== newArr[j]) {
      if (dp[i + 1][j] >= dp[i][j + 1]) {
        oldLines.push(oldArr[i++]);
      } else {
        newLines.push(newArr[j++]);
      }
    }
    while (i < n && j === m) oldLines.push(oldArr[i++]);
    while (j < m && i === n) newLines.push(newArr[j++]);
    hunks.push({ oldStart, oldLines, newLines });
  }
  return hunks;
}

export function coalesceHunks(hunks: readonly DiffHunk[], oldArr: readonly string[], gap: number): DiffHunk[] {
  if (hunks.length <= 1) return hunks.slice();
  const out: DiffHunk[] = [];
  let cur: DiffHunk = hunks[0];
  for (let k = 1; k < hunks.length; k++) {
    const next = hunks[k];
    const curEnd = cur.oldStart + cur.oldLines.length;
    const between = next.oldStart - curEnd;
    if (between <= gap && between >= 0) {
      const bridge = oldArr.slice(curEnd, next.oldStart);
      cur = {
        oldStart: cur.oldStart,
        oldLines: [...cur.oldLines, ...bridge, ...next.oldLines],
        newLines: [...cur.newLines, ...bridge, ...next.newLines],
      };
    } else {
      out.push(cur);
      cur = next;
    }
  }
  out.push(cur);
  return out;
}

export interface RenderResult {
  readonly ok: boolean;
  readonly text: string;
}

export function renderHunkAsSearchReplace(hunk: DiffHunk, oldArr: readonly string[], maxExpand: number): RenderResult {
  for (let ctx = 0; ctx <= maxExpand; ctx++) {
    const start = Math.max(0, hunk.oldStart - ctx);
    const end = Math.min(oldArr.length, hunk.oldStart + hunk.oldLines.length + ctx);
    const before = oldArr.slice(start, hunk.oldStart);
    const after = oldArr.slice(hunk.oldStart + hunk.oldLines.length, end);
    const searchLines = [...before, ...hunk.oldLines, ...after];
    const searchText = searchLines.join("\n");
    const full = oldArr.join("\n");
    const first = full.indexOf(searchText);
    if (first >= 0 && full.indexOf(searchText, first + 1) === -1) {
      const replaceText = [...before, ...hunk.newLines, ...after].join("\n");
      return {
        ok: true,
        text: `<<<<<<< SEARCH\n${searchText}\n=======\n${replaceText}\n>>>>>>> REPLACE`,
      };
    }
  }
  return { ok: false, text: "" };
}

// The pedagogical contract: the rendered SEARCH/REPLACE primes the model's
// next-turn output. It is never re-applied by applyEdits server-side. So
// "ok=false" only means "we couldn't render a clean template" — it does NOT
// mean the diff is unsafe. We degrade to wholesale in that case.
export function generateFileLastEdit(path: string, before: string, after: string): string {
  if (before === after) return "";
  if (before.length === 0) return `[NEW FILE: ${path} — see PREVIOUS]`;
  if (after.length === 0) return `[DELETED: ${path}]`;

  const oldArr = before.split("\n");
  const rawHunks = lineDiff(before, after);
  const hunks = coalesceHunks(rawHunks, oldArr, 3);
  if (hunks.length > 20) return `[${path}: wholesale rewrite, see PREVIOUS]`;

  const blocks: string[] = [];
  for (const h of hunks) {
    const rendered = renderHunkAsSearchReplace(h, oldArr, 20);
    if (!rendered.ok) return `[${path}: wholesale rewrite, see PREVIOUS]`;
    blocks.push(rendered.text);
  }
  return `${path}:\n${blocks.join("\n")}`;
}
