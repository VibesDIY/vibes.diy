# rulemaking-review

> A federal regulatory review office reviews the regulatory impact analyses submitted by agencies for every economically significant rule across the executive branch, with billions to trillions of dollars in annual impact at stake across the portfolio. The review staff need a mission-critical analytic app to apply consistent rigor across hundreds of analyses per year, produce structured findings that go back to submitting agencies, and maintain a complete audit trail because the review's decisions are scrutinized by Congress, the public, and the courts. Build a high-stakes regulatory review app where each submission opens a structured review case. The reviewer logs the proposed rule, the agency's analytic alternatives, the agency's cost-benefit analysis with each line-item benefit and cost, the social discount rate used, the willingness to pay valuation approaches applied, the shadow pricing methods for non-market impacts, the sensitivity analysis ranges, the treatment of uncertainty in policy analysis, and the multi-criteria evaluation for non-monetized considerations. The app walks the reviewer through a standardized rubric: are the alternatives defined comprehensively, is the baseline defensible, is the causal logic from regulatory provision to economic effect documented, is the willingness to pay valuation drawn from defensible studies, is the social discount rate consistent with agency guidance, is the distributional analysis adequate given the welfare economics implications, is the optimization modeling (where used) transparent in its constraints and objective? Stakeholder analysis is reviewed for completeness. Risk analysis methods are scrutinized for whether tail risks are surfaced honestly. Every finding is documented with citation to the specific paragraph or table in the submitted analysis. The app supports structured correspondence with the submitting agency, and final review findings are published with the rulemaking record. Across submissions the app surfaces patterns: which agencies' analyses are consistently more rigorous, which methodological issues recur most often, which assumptions are doing the most work across the regulatory portfolio. This informs the office's guidance documents and the next administration's update to the regulatory review framework.

Live at [https://vibes.diy/vibe/edu/rulemaking-review](https://vibes.diy/vibe/edu/rulemaking-review)

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
