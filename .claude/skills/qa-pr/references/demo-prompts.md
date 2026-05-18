# Demo prompt library for /qa-pr

Pick **one fresh prompt set per run**. Reusing prompts narrows coverage to the happy path the product has been tuned against (kmikeym, SOP v0.01m).

The agent picks a row by index `floor(run_minute % N)` so consecutive runs cycle through. Add new rows as you discover prompts that stress new surfaces; never remove a row — it's still a valid choice for older PRs.

| Stage | Prompt | Stress-tests |
|---|---|---|
| Build | *"a protein picker to help me mix up my boring eating habits"* | generic-utility-app generation |
| Edit  | *"let's change the look, can we make this have a more Windows 95 look?"* | chrome fidelity (Vibes nails Win95 incl. taskbar/Start button — good reskin canary) |
| Remix | *"make this a vegan protein picking app with lots of options already filled out for the library"* | AI interpretation of an ambiguous seed-data ask |

## Adding new prompts

A good prompt is:

- **Real-feeling.** Something a human would actually type to a tool they just found. No "test app 1." No "Lorem ipsum."
- **Tied to a stress target.** The third column is not decoration — it answers *why this prompt and not another*. If you can't fill it in, the prompt isn't pulling its weight.
- **Stable in difficulty.** Don't add prompts so demanding that the App Model can't reasonably succeed — the QA pass is for surfacing Vibes-level issues, not eval-style model capability tests.
