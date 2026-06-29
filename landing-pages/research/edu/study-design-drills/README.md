# study-design-drills

> A first-year public health student keeps mixing up cohort study design and case-control study design on practice exams — they can recite the textbook definitions but freeze when asked to map a real-world question onto the right design. They want a low-stakes way to drill the distinction by working through dozens of short scenarios. Build a playful study-buddy app that presents one scenario at a time: a researcher wants to know whether shift workers have higher rates of cardiovascular disease, an outbreak team wants to know whether a particular salad caused last week's gastroenteritis cluster, a city wants to know how common asthma is among children right now in a specific neighborhood, a journal article is investigating whether a rare congenital defect is associated with a common environmental exposure. For each scenario, the student picks among cohort study design, case-control study design, and cross-sectional studies, then writes a one-sentence justification. The app reveals whether their pick fits the question — explaining when a case-control study design is the right move because the outcome is rare, when a cohort study design is right because the exposure is rare or the temporal sequence matters, and when cross-sectional studies are appropriate for prevalence questions. After each scenario, the student is asked to name the appropriate measure of association the chosen design produces — odds ratio for case-control, risk ratio or rate ratio for cohort — and to flag at least one source of selection bias the design might introduce. Over time the app should track which design types the student gets wrong most often and serve more of those, building toward fluency in mapping public health questions to study designs. The app should also let the student write their own scenario from something they read in the news and submit it for self-grading.

Live at [https://vibes.diy/vibe/edu/study-design-drills](https://vibes.diy/vibe/edu/study-design-drills)

Single-file React app built with [vibes.diy](https://vibes.diy). Visit the live url to manage access.

## Run it

```sh
npx vibes-diy push     # uploads App.jsx, prints a live HTTPS URL
```

Edit [App.jsx](App.jsx) and push again to iterate.

## Commands

- `npx vibes-diy push` — deploy the current directory
- `npx vibes-diy push --instant-join` — deploy with auto-accept sharing
- `npx vibes-diy generate "prompt"` — generate a new app from a prompt
- `npx vibes-diy help` — full command list
