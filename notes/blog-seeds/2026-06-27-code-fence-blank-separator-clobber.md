# The blank line that let access.js overwrite App.jsx — a default that hid a parser bug

Source: #2656

A one-shot generation shipped its access-control function *inside* `App.jsx`,
wiped the React component, and never wrote `access.js`. The model was innocent:
it emitted the conventional aider shape — filename on its own line, a blank line,
then the fence. The streaming fence parser only binds a "path line" to a fence
when the label is on the line *immediately* before the ```` ``` ````; the blank
line in between took the `else` branch, flushed the pending filename as prose, and
left `currentPath` to fall back to `DEFAULT_PATH = "App.jsx"`. Both fences got
`path: "App.jsx"`, the second clobbered the first.

The seedworthy part is *why it survived so long*: for a single-file app the bug is
invisible, because `App.jsx` is the default — the wrong answer and the right answer
coincide. It only bites multi-file generations (anything with `access.js`). The
existing test even fed the exact `filename / blank / fence` shape but asserted
`path === "App.jsx"`, so the default fallback *masked the bug inside the test that
should have caught it*.

Two angles worth a full post: (1) **a sensible default is a great way to hide a
bug** — when the fallback equals the common-case correct value, the failing path
looks like it works, and your test passes for the wrong reason; the fix is to test
with a *non-default* value (`access.js`) so the binding is genuinely exercised. And
(2) **streaming parsers need to hold candidates across separators** — buffer blank
lines while a path candidate is pending, drop them when a fence consumes the path,
flush them in order only if real prose or EOF intervenes.
