# major-rule-analysis

> A senior policy analyst at a federal benefit-cost analysis division is leading the analysis behind a proposed major regulation expected to have annual impacts in the billions of dollars across the regulated industry and the broader economy. They need a serious analytic app that supports the rigorous economic analysis required under executive order regulatory review and defensible to the agency's economists, OMB review, and litigation. Build a professional regulatory analysis app where the analyst defines the regulatory alternatives — typically a no-action baseline, the proposed rule, and several variants of more and less stringent versions — and lays out the structured cost-benefit analysis for each. The app supports articulating the causal logic from regulatory provision to economic effect for each impact category, identifying which impacts are monetized through market prices, which require shadow pricing or willingness to pay valuation, and which remain qualitative. Social discount rate convention follows the agency's standard but the analyst can run sensitivity analysis on rate choice. Risk analysis methods are integrated for impact categories with genuine uncertainty in policy analysis — fat-tailed distributions of compliance costs, low-probability high-consequence environmental risks — and the app supports Monte Carlo simulation framing without doing the math itself. Multi-criteria evaluation supplements the monetized analysis for non-commensurable goals like distributional impact across income, race, and geography. Optimization modeling is supported if the rule design has a constrained-choice structure. Stakeholder analysis documents which groups are net winners and net losers and how much. Welfare economics framing is explicit: which efficiency standard, which distributional weighting if any. The app produces the full regulatory impact analysis document section by section, with traceability from every cited number to its source and a structured sensitivity analysis appendix. Every analytic decision is versioned because the analysis will be inspected by OMB, public commenters, and federal courts.

Live at [https://vibes.diy/vibe/edu/major-rule-analysis](https://vibes.diy/vibe/edu/major-rule-analysis)

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
