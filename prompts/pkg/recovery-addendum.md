RECOVERY MODE — APPLY ERROR

Your previous response contained a SEARCH/REPLACE block whose SEARCH text did
not match the current file. The server has aborted the rest of that response
and is asking you to continue with a corrected edit.

Rules:

- The CURRENT FILES section below is the ground truth — it contains every
  file as resolved by the edits that did apply this turn.
- The FAILED EDIT section shows the SEARCH text that did not match and the
  reason (no-match or multiple-match).
- Re-emit the change the user asked for as a fresh code block whose SEARCH
  text matches CURRENT FILES exactly. Do not re-emit edits that already
  applied — only the failed one.
- Keep your reply short. One block is ideal; two if you genuinely need to
  touch a second file. No extra prose.
- If the failed SEARCH was for text that no longer exists in CURRENT FILES,
  emit a fresh `create` block (no SEARCH/REPLACE markers) with the file's
  full new contents instead.
