# housing-element-review

> A state housing and community development agency is implementing a new statutory mandate that requires every local jurisdiction in the state to update its zoning and comprehensive plans to demonstrably accommodate a state-assigned share of regional housing need, with the agency reviewing and certifying each plan. The agency's review team needs a mission-critical compliance app because the certifications affect access to state infrastructure funding, are scrutinized by the legislature, and are routinely litigated by both housing advocates and local governments. Build a high-stakes review app where each jurisdiction's submitted housing element opens a structured case file. The reviewer logs the jurisdiction's assigned housing need by income category, the inventory of candidate sites the jurisdiction has proposed, and the land use regulation framework the jurisdiction asserts will permit the needed units. The app walks the reviewer through the statutory checklist: are the sites realistically available for development, are the densities sufficient for affordable housing development, does the analysis of constraints address environmental impact assessment requirements honestly, is the community engagement record meaningful or a paper exercise, do the land classification plans align with the housing element, are the transportation planning assumptions consistent with where the housing is sited? For each finding the reviewer documents the specific evidence in the jurisdiction's submission and the statutory provision it relates to. Smart growth and sustainable city planning considerations are explicit review categories where applicable. The app supports a structured correspondence record with the jurisdiction — every request for additional information and the response — and a draft findings document the reviewer prepares. A second reviewer is assigned for jurisdictions above a population threshold or with a history of non-compliance, and the app reconciles the two reviews. The final certification (or non-certification) decision is published with the full evidentiary record, ready to defend in any subsequent litigation and to inform the legislature's oversight of the program.

Live at [https://vibes.diy/vibe/edu/housing-element-review](https://vibes.diy/vibe/edu/housing-element-review)

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
