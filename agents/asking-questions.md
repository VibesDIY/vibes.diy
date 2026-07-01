# Asking questions — plain text, not the question tool

**Never use the `AskUserQuestion` tool (the multiple-choice / chip picker). It does not render on the primary mobile harness, so the question silently fails to reach the user.** Ask in plain text instead.

Questions themselves are welcome — ask early, ask often, ask whenever a decision is genuinely the user's to make. The rule is only about the _channel_: write the question as normal prose in your reply, list the options inline (a short numbered or bulleted list is fine), and let the user answer in their own words.

- ✅ "Two ways to go here: **(1)** keep it as-is, or **(2)** shorten it for even columns. Which do you want?"
- ❌ Calling `AskUserQuestion` with option chips.

This applies to every kind of prompt the tool would otherwise cover: clarifying an ambiguous request, choosing between approaches, confirming before an irreversible action. Plain text works everywhere the user reads; the tool does not.
