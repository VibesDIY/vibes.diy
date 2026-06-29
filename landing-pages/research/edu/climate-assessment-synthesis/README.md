# climate-assessment-synthesis

> A national climate office coordinates the federal government's quadrennial National Climate Assessment and related cross-agency reports that inform congressional action, federal rulemaking, and state and local planning affecting hundreds of millions of people. The office's coordinators need a mission-critical synthesis app that manages the massive multi-author drafting process, integrates climate science and policy analysis from dozens of contributing agencies, and produces the official assessment with the auditability and version control such a politically scrutinized document requires. Build a high-stakes coordination app where each chapter of the assessment has a lead agency, contributing authors, an outline, a draft text, and a structured evidence base. Contributors attach published studies to specific claims with full citation metadata, and the app tracks which claims are well-supported, which are emerging, and which are contested. The chapters span the full vocabulary of the field: greenhouse gas emissions trajectories, climate risk assessment across sectors, regional climate vulnerability assessment, climate adaptation strategies, mitigation strategies including carbon pricing mechanisms and sectoral policies, climate policy frameworks across federal-state-tribal-local governance, sustainability assessment of infrastructure and economic systems, climate justice and environmental racism in historical and current impacts, energy transition policy, and life cycle analysis for major federal decisions. The app supports the rigorous review process: every draft chapter goes through internal review, expert peer review, and public comment, with every comment logged and the author response documented. Sensitive scientific disagreements are surfaced for resolution by chapter conveners rather than being smoothed away. The system maintains versioned snapshots at every review stage because the assessment is foundational to federal policy and subject to FOIA, congressional inquiry, and litigation. The final published assessment carries an audit trail back to every contributor, every cited study, and every comment that shaped the text — meeting the standards of scientific integrity the office is statutorily required to maintain.

Live at [https://vibes.diy/vibe/edu/climate-assessment-synthesis](https://vibes.diy/vibe/edu/climate-assessment-synthesis)

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
