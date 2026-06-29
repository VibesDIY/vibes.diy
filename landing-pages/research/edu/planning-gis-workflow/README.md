# planning-gis-workflow

> A GIS technician at a county planning department handles the routine spatial workflows that feed the department's day-to-day decisions: subdivision plat reviews, floodplain determinations, hazard buffer checks, environmental constraints overlays, and ad-hoc map requests from elected officials. The technician needs an operational workflow app because the current setup is a hairball of one-off project files and the geospatial database design is informal, leading to inconsistent results across analysts. Build an operational workflow app where the technician's recurring tasks are templated. For each subdivision review, the technician enters the parcel ID and the app pulls the relevant layers from the county geodatabases — zoning, environmental overlays, transportation network, utility easements — runs the standard spatial overlays needed for the review checklist, computes setback and buffer compliance using proximity analysis, and surfaces any conflicts the technician must flag. For floodplain determinations, the workflow steps the technician through pulling FEMA layers, conducting the spatial interpolation for areas between cross-sections, and generating the structured letter the county sends back to the requesting party. The app maintains versioned geospatial database design documentation so the technician (or a successor) can always trace which version of which layer was used in a given determination. A library of cartographic representation templates produces the maps the department's letters require — consistent legends, north arrows, scale bars, source citations — so every output looks like it came from the same office. The technician also has a simple ad-hoc map mode for elected officials' urgent requests, with a queue of pending requests and turnaround time tracked. The output is a more reliable, more auditable workflow that also surfaces metrics on backlog and recurring layer issues.

Live at [https://vibes.diy/vibe/edu/planning-gis-workflow](https://vibes.diy/vibe/edu/planning-gis-workflow)

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
