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
