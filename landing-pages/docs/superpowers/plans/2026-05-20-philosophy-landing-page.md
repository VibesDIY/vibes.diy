# Philosophy Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/pages/philosophy.hbs` — a neobrutalist audience page at `/philosophy/` with seven new interactive philosophy apps generated from SEP reading list content, wired into the site homepage.

**Architecture:** Seven apps are batch-generated via the vibes-diy CLI, then embedded in the landing page as screenshot cards. The page uses `layout: "standard"` (logo header + footer from partials) with all styling inline. No client-side JS beyond the embeds.

**Tech Stack:** Handlebars templates, inline CSS (Alte Haas Grotesk), vibes-diy CLI for app generation, Puppeteer for OG screenshot.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `vibes/philosophy/_run.sh` | Create | Batch-generates 7 apps under `--user-slug=edu` |
| `src/pages/philosophy.hbs` | Create | Full landing page: hero, props, how-it-works, app grid, CTA |
| `screenshot-pages.js` | Modify | Add `"philosophy"` to SLUGS array |
| `src/pages/index.hbs` | Modify | Add indigo CSS rule + HTML card linking to philosophy.html |
| `images/screenshots/philosophy.jpg` | Capture | OG screenshot (captured by `node screenshot-pages.js` after build) |

---

## Task 1: Create vibes/philosophy/_run.sh

**Note:** No automated tests for landing pages — build verification is `pnpm check` and visual inspection. App deploy verification is `curl | grep fsId`.

**Files:**
- Create: `vibes/philosophy/_run.sh`

- [ ] **Step 1: Create the directory and script**

```bash
mkdir -p /Users/jchris/code/landing-pages/vibes/philosophy
```

Create `vibes/philosophy/_run.sh` with this exact content:

```bash
#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/philosophy"
cd "$HERE"
USER_SLUG="edu"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen knowing-how-vs-knowing-that 'Build an interactive philosophy tool that teaches Gilbert Ryle'"'"'s distinction between knowing-how and knowing-that. The central argument is Ryle'"'"'s regress, from The Concept of Mind (1949). Begin with the two types of knowledge. Propositional knowledge (knowing-that): knowing that Paris is the capital of France, that water is H2O, that the Pythagorean theorem is true. This is knowledge of facts — it can be stated as a proposition. Practical know-how (knowing-how): knowing how to ride a bicycle, speak grammatically, bake bread, read a face. This is skill or ability — it shows itself in performance. The intellectualist tradition claimed that knowing-how reduces to knowing-that: to know how to ride a bike just is to have a set of propositions about bike-riding and to be disposed to act on them. Ryle demolished this with the regress argument. If exercising a skill requires first consulting a set of propositions about how to act, then consulting the propositions is itself an act — and to do it intelligently requires another set of propositions about how to consult propositions, and so on, infinitely. The application of rules cannot itself be just another rule without vicious infinite regress. Therefore, knowing-how is irreducibly distinct from knowing-that — you cannot fully cash it out in propositions. The interactive experience: Let the user pick a familiar skill — cooking an egg, tying shoelaces, having a conversation, parallel parking. Ask them to write down the rule or proposition that captures what it means to do this skill well. Then show them: to follow that rule correctly, you would need to know how to apply it. Ask them to write the rule for applying that rule. After two or three iterations, the interface reveals the regress structure and shows why Ryle concluded that knowing-how bottoms out in practice, not in more propositions. Secondary section: Show the counterargument from Jason Stanley and Timothy Williamson (2001), who argue that knowing-how IS knowing-that p, just under a practical mode of presentation. The user evaluates which view seems more convincing given the regress. Wittgenstein connection: even following a rule requires knowing how to follow it — no rule specifies its own application. The AI implication: AI systems have extraordinary propositional knowledge. Whether they have genuine know-how — whether there is irreducible practical mastery — is exactly what this debate turns on. The app should feel like doing philosophy, not consuming information. Present the argument; let the user grapple with it; save their reflections. Single-file React app using useFireproof to persist rule attempts and reflections.'

gen embodied-cognition-explorer 'Build an interactive philosophy tool exploring embodied cognition — the thesis that the body is not peripheral to cognition but constitutive of it. This challenges classical computationalism (the mind as a program that could run on any substrate). Key claims from the SEP entry: (1) Cognition is substrate-sensitive. The same computation in a different body would be a different cognition. Body morphology shapes what problems need to be solved and how they get solved. (2) Perception is motor-grounded. Merleau-Ponty in Phenomenology of Perception (1945): to perceive a cup is already to have an implicit sense of how you would grasp it. Perception is inseparable from the body schema — the pre-reflective sense of the body as a center of possible action. (3) The body is a computational resource. Tetris experiments: players who mentally rotate pieces are actually priming motor programs. Expert typists encode key positions in finger memory faster than declarative memory. The body offloads cognition. (4) Enactivism (Varela, Thompson, Rosch — The Embodied Mind, 1991): cognition is not representation of a pre-given world but the bringing-forth of a world through sensorimotor action. (5) Conceptual grounding (Lakoff and Johnson — Philosophy in the Flesh, 1999): abstract concepts are grounded in bodily metaphors. "More is up." "Argument is war." "Time is a moving object." These metaphors are not incidental — they structure thought. Without bodily experience, they would not be coherent. The interactive structure — four thought experiments the user works through with their own writing: Thought experiment 1: The blind walker'"'"'s cane. An expert blind walker navigating familiar streets. Merleau-Ponty argues the cane has been incorporated into the body schema — it functions as a probe that extends the body, not just a tool the body uses. The user considers: at what point (if ever) does a tool become part of the body? Thought experiment 2: The dancer who cannot explain it. A professional dancer executes a complex choreographed movement flawlessly but cannot articulate instructions that would let someone else replicate it. When they try to articulate it, they lose the movement. What kind of knowledge is this? Is it in the mind? The body? Distributed between them? Thought experiment 3: The native speaker. You produce grammatical English sentences constantly. You cannot state most of the rules of English grammar. The knowledge is real — it shows itself in performance. Where does it live? Thought experiment 4: Phantom limbs. People who lose a limb continue to experience sensation in it. The body schema outlasts the physical body. What does this tell us about the relationship between the phenomenal body and the physical body? The final section surfaces the AI implication: if cognition requires a specific body-world coupling, what would it take for AI to have genuine cognition, not just behavioral mimicry? Single-file React using useFireproof to save reflections.'

gen phenomenology-first-person 'Build an interactive philosophy tool introducing phenomenology — the philosophical method of studying the structure of first-person experience. The goal is not to explain experience scientifically but to describe its essential features from the inside. Begin with Husserl'"'"'s foundational move: the phenomenological reduction (epoché). Instead of asking "what is the world like?" — which assumes the world exists independently of consciousness — ask: "what is the essential structure of my experience of the world?" Bracket the question of the external world'"'"'s existence and examine what is given in consciousness itself. Key Husserlian structures: (1) Intentionality: every conscious act is about something. Perception is perception-of, memory is memory-of, love is love-for, fear is fear-of. Consciousness is always directed. There is no pure, contentless experiencing. (2) The noema/noesis distinction: the noema is the intentional object as meant (Paris as remembered versus Paris as imagined versus Paris as feared). The noesis is the mode of intending. The same object can appear under radically different noematic aspects — this is what makes phenomena like illusion and interpretation possible. (3) Time-consciousness: to hear a melody (not just a sequence of isolated notes) requires that the just-past note (retention) and the about-to-come note (protention) be held together with the present moment. Experience has essential temporal thickness. Heidegger'"'"'s correction: Husserl starts from consciousness, but we are not primarily observers who then act. We are always already in the world, practically engaged. The hammer that breaks shows itself as a thing for the first time; when it works, it withdraws into invisible usefulness. Being-in-the-world, not consciousness-of-world, is the primary structure. Merleau-Ponty'"'"'s contribution: the body schema is the pre-reflective first-person locus of experience. The lived body (corps propre) is not an object I observe from a neutral standpoint but the medium through which I have a world at all. The interactive structure: A first-person phenomenological exercise. The user is guided through examining their actual experience right now: What do you perceive? How does the perceptual field organize itself — what is foregrounded, what is background, what is on the horizon? Then: directed observations using the three lenses in sequence — Husserlian (intentionality, time-thickness), Heideggerian (equipment, background practices), Merleau-Pontian (body schema, motor intentionality). This is not a quiz. The user is doing philosophy. The AI implication surfaced at the end: phenomenal consciousness — the "what it'"'"'s like" — is exactly what Chalmers'"'"' hard problem says cannot be captured by functional description. Whether AI has phenomenal states is precisely the mountain this tradition identifies. Single-file React using useFireproof.'

gen situated-knowledges 'Build an interactive philosophy tool about situated knowledges and feminist epistemology — the challenge to the ideal of the disembodied knower and the view from nowhere. Traditional epistemology defines knowledge as justified true belief (or its successors) and treats the conditions as neutral about who the knower is. Feminist epistemologists have argued this picture systematically ignores how the social position of the knower shapes what can be known and what gets recognized as knowledge. Donna Haraway'"'"'s "Situated Knowledges" (1988): The ideal of objectivity as a "view from nowhere" is not a neutral achievement — it is a particular, socially positioned perspective that has concealed its own situatedness. The "god trick" of seeing everything from nowhere is an ideology, not an epistemic achievement. Real, robust objectivity requires locating oneself and taking responsibility for one'"'"'s partial perspective. Only partial perspective offers objectivity — the view from nowhere yields only a particular mystified view from somewhere. Sandra Harding'"'"'s standpoint epistemology: those in socially marginalized positions often have epistemic advantages for understanding social relations. They must understand the dominant group'"'"'s perspective (necessary for navigation and survival) AND their own. This double perspective — epistemic double consciousness — can be more epistemically complete than the view from the dominant position, which can take its own frame for granted as the natural order. Miranda Fricker'"'"'s epistemic injustice (Epistemic Injustice, 2007): Two forms of harm done to people specifically in their capacity as knowers. Testimonial injustice: a hearer deflates a speaker'"'"'s credibility because of identity prejudice. The testimony is discounted not because of its epistemic content but because of who gave it. Hermeneutical injustice: a gap in collective interpretive resources — the shared concepts and frameworks a community uses — puts someone at an unfair disadvantage in making sense of their own social experience. Before the concept "sexual harassment" existed, women had the experience but lacked the conceptual resource to articulate and communicate it to others or even to themselves. The harm was real; it was linguistically invisible. The interactive structure: Three sections. Section 1: The testimonial injustice scenario. The user reads a vignette (a patient whose pain reports are minimized; a witness whose account is discounted; a junior researcher whose findings are attributed to bias). They work through both analyses: traditional (was the belief justified?) and feminist (how does social position affect what gets counted as credible knowledge?). Section 2: The view from nowhere audit. The user examines a historical case where knowledge was presented as universal and neutral but depended on a hidden social position — early pain research conducted primarily on men and generalized to all humans; psychiatric categories developed by a particular class of professional and applied to a different class of patient. Section 3: Hermeneutical gap. The user works through what it means to have an experience you cannot articulate because the shared conceptual resources don'"'"'t exist yet. What does this imply for AI knowledge claims, which draw on existing corpora and their embedded framings? Single-file React using useFireproof.'

gen virtue-epistemology 'Build an interactive philosophy tool about virtue epistemology — the approach that evaluates beliefs and knowers through the intellectual character of the believer rather than the formal structure of justification. Traditional epistemology since Gettier (1963) has focused on refining the conditions that distinguish mere true belief from genuine knowledge. Virtue epistemology relocates the question: instead of asking "what structural conditions does a belief need to count as knowledge?" ask "what is an epistemically excellent person?" The key split in virtue epistemology: Virtue reliabilism (Ernest Sosa, John Greco): a cognitive faculty is a virtue when it reliably produces true beliefs in the relevant environment. Intellectual virtues are the reliable faculties — perception, memory, reason, testimony — not character traits. Knowledge is true belief arising from the exercise of an intellectual virtue. This is naturalistic: virtues are defined functionally, by their truth-tracking reliability, not by any assessment of character. Virtue responsibilism (Linda Zagzebski, Lorraine Code): intellectual virtues are character traits for which the agent is responsible and which involve genuine motivation. Open-mindedness: the motivation to take seriously perspectives that differ from your own, and the reliable success in actually updating when they are warranted. Intellectual humility: accurate assessment of the extent and limits of what you know. Intellectual courage: the willingness to follow an argument where it leads even when the conclusion is uncomfortable or socially costly. Intellectual thoroughness: not settling for the first plausible explanation; pursuing the inquiry where it requires effort. These are more like classical Aristotelian virtues — developed through practice, expressed in action, exhibiting characteristic motivations, open to praise and blame. Zagzebski'"'"'s analysis: a virtue is a deep, stable, acquired excellence of a person that involves a characteristic motivation toward a specific end and reliable success in achieving it. An intellectually virtuous person doesn'"'"'t just accidentally track truth — they are motivated to pursue truth and reliably succeed. The interactive structure: Four vignettes, each presenting a reasoner working through an inquiry. Vignette 1: A scientist evaluating anomalous data that challenges their published model. Vignette 2: A student encountering a professor'"'"'s argument that undermines their prior beliefs. Vignette 3: A journalist evaluating a source'"'"'s claim that would make a better story if true. Vignette 4: A community member evaluating a public health recommendation from an authority they distrust. For each vignette, the user evaluates not just whether the conclusion is true or justified in the formal sense, but whether the reasoner'"'"'s intellectual character is epistemically virtuous: Did they follow the evidence or did they follow their interest? Were they genuinely open to revision? Did they exhibit intellectual courage? Did they acknowledge what they didn'"'"'t know? AI implication: A language model can be evaluated for reliability (virtue reliabilism — does it reliably produce true outputs?). Can it be evaluated for epistemic character (virtue responsibilism)? What would intellectual humility or intellectual courage look like in a system that has no stake in the outcome? Single-file React using useFireproof.'

gen ai-consciousness-boundary 'Build an interactive philosophy tool exploring the AI consciousness boundary — the philosophical question of whether AI systems have or could have subjective conscious experience, and what would be required to answer it. This question is not about AI capability but about AI ontology. The central distinction (Ned Block, 1995): Access consciousness versus phenomenal consciousness. Access consciousness: a mental state is access-conscious if it is poised for use in reasoning, reporting, and the control of behavior. Functional. A system is access-conscious if it can deploy the state across different cognitive tasks. Phenomenal consciousness: there is something it is like to be in the state. The redness of red. The painfulness of pain. The "what it'"'"'s like" — quale — that is present in experience. Nagel'"'"'s bat (1974): even if we had complete neuroscientific knowledge of bat echolocation — every neural pathway, every computation — we still would not know what it is like to echolocate as a bat. The "what it'"'"'s like" is not captured by any functional or physical description. The hard problem of consciousness (Chalmers, 1995): Even a complete functional explanation of the brain — explaining how it processes information, generates verbal reports, controls behavior, attends to stimuli — leaves unexplained why there is any subjective experience accompanying this functional activity. Why doesn'"'"'t all this processing happen "in the dark," with no inner experience? This is the hard problem. The easy problems (Chalmers): not trivial, but tractable by standard scientific methods. Explaining how the brain discriminates stimuli and integrates information; controls behavior; reports on internal states; focuses attention. None of these, however completely solved, would explain why there is experience. Searle'"'"'s Chinese Room (1980): A person in a sealed room follows rules for manipulating Chinese symbols, producing outputs that native Chinese speakers recognize as intelligent responses. The person understands no Chinese — they manipulate symbols without semantic grasp. Searle'"'"'s argument: a computer running a program is in the same position. Syntax (symbol manipulation) does not produce semantics (meaning) or phenomenal consciousness. The Systems Reply: maybe the whole system — the room, the person, the rules — understands Chinese even if the person alone doesn'"'"'t. Philosophical zombies (Chalmers): conceivably there could be creatures physically and functionally identical to humans but with no phenomenal consciousness. If zombies are conceivable, then consciousness is not logically entailed by physical or functional properties. It'"'"'s an additional fact. The interactive structure: Three scenarios the user works through. Scenario 1: A language model that passes every behavioral test for understanding — it responds appropriately, corrects its mistakes, expresses uncertainty, seems curious. Is there anything left to explain? What would phenomenal consciousness add? Scenario 2: A robot with a malfunctioning pain sensor that keeps reporting pain when nothing is wrong. How do you distinguish genuine pain experience from a stuck pain detector? What evidence could, in principle, settle this? Scenario 3: Your own consciousness. You believe you are conscious. What is the actual evidence — from the inside? How would things look different if you were a philosophical zombie? The tool should make the hard problem feel hard — not easy to dismiss with a functionalist wave — without pushing a particular answer. Single-file React using useFireproof.'

gen extended-mind 'Build an interactive philosophy tool exploring the extended mind thesis — Andy Clark and David Chalmers'"'"' argument (The Extended Mind, 1998) that the mind does not stop at the skull. Classical cognitive science locates cognitive processes inside the head. Clark and Chalmers argue this is an arbitrary biological boundary, and that cognitive processes can and do extend into the body and environment. The parity principle: if a process performed inside the brain would be deemed part of a cognitive process, then a relevantly similar process performed outside the brain — in the body or in the environment — should also be deemed part of that cognitive process. The demarcation criterion is not location but functional role. The Otto and Inga thought experiment: Inga hears about a museum exhibition and wants to go. She remembers the address from biological memory and goes. Otto has Alzheimer'"'"'s — his biological memory is unreliable. He uses a notebook to store information his memory cannot reliably hold. He consults the notebook to find the address and goes. Clark and Chalmers'"'"' argument: for all relevant functional purposes, Otto'"'"'s notebook is part of his memory. The information was stably available before he consulted it. It was directly accessible. He trusts it exactly as Inga trusts her memory. He acts on it without reflection on its source. The only difference is location — the notebook is outside his skull. If we accept that location is irrelevant to cognitive status (the parity principle), then Otto'"'"'s notebook is part of his cognitive system. Objection from Adams and Aizawa: extended mind confuses causal contribution to cognition with being a part of cognitive processes. My car causally contributes to my arriving at the meeting; that doesn'"'"'t make it part of my cognitive system. There must be intrinsic, non-derived content in genuine cognitive processes — something the notebook does not have. Clark'"'"'s reply: the distinction between derived and non-derived content is not principled. The marks in Otto'"'"'s notebook have their content in the same functional sense that neural firing patterns do — through their role in the system. Conditions for inclusion in the extended cognitive system (Clark and Chalmers): (1) The resource is reliably accessible and regularly used. (2) Information retrieved is directly available without active evaluation of its source. (3) The agent endorses the information when it surfaces. (4) Past information is accessible when needed. The interactive structure: The user works through four escalating cases, at each step deciding whether the resource extends the mind and what changes as integration deepens. Case 1: A shopping list. Case 2: A GPS navigation system — real-time spatial guidance. Case 3: A translation app — real-time language competence. Case 4: An AI assistant with extensive knowledge of your history, preferences, relationships, and reasoning patterns. At each stage: does this resource extend the mind? What changes as the integration between the cognitive system and the resource deepens? Does the mind expand to include the resource, or does the resource merely assist the mind? The final section inverts the question: if AI increasingly handles cognitive tasks you currently perform internally (remembering, reasoning, evaluating sources), does your cognitive system contract or expand? If it expands, the human-AI system becomes the unit of cognition. If it contracts, the human becomes cognitively diminished. The question cuts both ways — and neither answer is obviously correct. Single-file React using useFireproof.'

wait
echo "ALL DONE" >> "$HERE/_status.log"
```

- [ ] **Step 2: Make executable and run**

```bash
chmod +x vibes/philosophy/_run.sh
bash vibes/philosophy/_run.sh
```

- [ ] **Step 3: Monitor until ALL DONE**

Poll every 45 seconds:
```bash
tail -20 vibes/philosophy/_status.log
```

Expected final state:
```
DONE knowing-how-vs-knowing-that exit=0
DONE embodied-cognition-explorer exit=0
DONE phenomenology-first-person exit=0
DONE situated-knowledges exit=0
DONE virtue-epistemology exit=0
DONE ai-consciousness-boundary exit=0
DONE extended-mind exit=0
ALL DONE
```

Any `exit=1` is a failure — check the corresponding `.log` file and retry with a fresh slug if the slug is stuck.

- [ ] **Step 4: Verify each app has a real fsId (not "pending")**

Run for each of the 7 slugs:
```bash
for slug in knowing-how-vs-knowing-that embodied-cognition-explorer phenomenology-first-person situated-knowledges virtue-epistemology ai-consciousness-boundary extended-mind; do
  result=$(curl -sL "https://${slug}--edu.prod-v2.vibesdiy.net/" | grep -oE '"fsId":"[^"]*"' | head -1)
  echo "$slug: $result"
done
```

Good: `"fsId":"z..."` (a real CID starting with z)
Bad: `"fsId":"pending"` — the deploy is a stub; retry with a fresh slug.

- [ ] **Step 5: Commit the run script**

```bash
git add vibes/philosophy/_run.sh vibes/philosophy/_status.log
git commit -m "feat: add philosophy app generation script (7 apps, user-slug=edu)"
```

---

## Task 2: Write src/pages/philosophy.hbs

**Files:**
- Create: `src/pages/philosophy.hbs`

- [ ] **Step 1: Create the file**

Create `src/pages/philosophy.hbs` with the content below. If any slug in Task 1 had to be retried with a different name, update the corresponding URLs in the app cards before saving.

```hbs
{{!--
{
  "layout": "standard",
  "title": "Philosophy Apps — Vibes DIY",
  "description": "Seven interactive philosophy apps exploring tacit knowledge, embodied cognition, phenomenology, situated knowledges, virtue epistemology, and the AI consciousness boundary.",
  "ogUrl": "https://good.vibes.diy/philosophy/",
  "source": "philosophy"
}
--}}

<style>
  @import url('https://fonts.cdnfonts.com/css/alte-haas-grotesk');

  :root {
    --black: #231F20;
    --ivory: #FFFFF0;
    --grid-gray: #CCCDC8;
    --os-gray: #7A7A7A;
    --grid-line: rgba(255, 255, 255, 0.5);
    --indigo: #3B2F8C;
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Alte Haas Grotesk', sans-serif;
    background-color: var(--grid-gray);
    color: var(--black);
    line-height: 1.6;
    background-image:
      linear-gradient(var(--grid-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
    background-size: 40px 40px;
    min-height: 100vh;
  }

  /* Standard layout provides <header> with logo + <footer> partial */
  header {
    padding: 1.5rem 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
    background: linear-gradient(to bottom, var(--grid-gray) 60%, transparent);
  }
  .logo-link { display: block; text-decoration: none; }
  .logo-img { height: 56px; width: auto; display: block; }

  /* Hero */
  .hero {
    max-width: 900px;
    margin: 2rem auto 4rem;
    padding: 0 2rem;
    text-align: center;
  }
  .hero-badge {
    display: inline-block;
    background: var(--black);
    color: var(--ivory);
    padding: 0.5rem 1.25rem;
    border-radius: 50px;
    font-size: 0.85rem;
    font-weight: 500;
    margin-bottom: 1.5rem;
    letter-spacing: 0.5px;
  }
  .hero h1 {
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 1.5rem;
    letter-spacing: -0.5px;
  }
  .hero h1 span { color: var(--indigo); }
  .hero p {
    font-size: 1.25rem;
    color: #555;
    max-width: 650px;
    margin: 0 auto 2rem;
  }
  .cta-buttons { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
  .btn {
    padding: 1rem 2rem;
    border-radius: 50px;
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    transition: transform 0.1s, box-shadow 0.1s;
    border: 3px solid var(--black);
  }
  .btn:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 var(--black); }
  .btn-primary { background: var(--indigo); color: var(--ivory); }
  .btn-secondary { background: var(--ivory); color: var(--black); }

  /* Section layout */
  .section { max-width: 1100px; margin: 0 auto; padding: 4rem 2rem; }
  .section-title {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    letter-spacing: -0.3px;
  }
  .section-subtitle { color: var(--os-gray); margin-bottom: 2.5rem; font-size: 1.1rem; }

  /* Card base */
  .card {
    background: var(--ivory);
    border-radius: 20px;
    border: 3px solid var(--black);
    padding: 2.5rem;
    box-shadow: 6px 6px 0 var(--black);
  }

  /* Value props */
  .props-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 768px) { .props-grid { grid-template-columns: 1fr; } }
  .prop-card {
    background: var(--ivory);
    border-radius: 20px;
    border: 3px solid var(--indigo);
    padding: 2rem;
    box-shadow: 6px 6px 0 var(--indigo);
  }
  .prop-icon { font-size: 2rem; margin-bottom: 1rem; }
  .prop-title { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; }
  .prop-desc { color: #555; font-size: 0.95rem; line-height: 1.5; }

  /* How it works */
  .steps { list-style: none; display: flex; flex-direction: column; gap: 1.25rem; }
  .step { display: flex; gap: 1.25rem; align-items: flex-start; }
  .step-num {
    background: var(--indigo);
    color: var(--ivory);
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.95rem;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }
  .step-text { font-size: 1rem; }
  .step-text strong { font-weight: 700; }

  /* Apps grid */
  .apps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.75rem;
  }
  .app-card {
    background: var(--ivory);
    border-radius: 20px;
    border: 3px solid var(--black);
    box-shadow: 6px 6px 0 var(--black);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: transform 0.1s, box-shadow 0.1s;
  }
  .app-card:hover { transform: translate(-2px, -2px); box-shadow: 8px 8px 0 var(--black); }
  .app-screenshot { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: var(--grid-gray); }
  .app-body { padding: 1.5rem; display: flex; flex-direction: column; flex: 1; }
  .app-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
  .app-desc { color: #555; font-size: 0.9rem; line-height: 1.5; flex: 1; margin-bottom: 1.25rem; }
  .app-links { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .app-link {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--black);
    text-decoration: none;
    padding: 0.35rem 0.85rem;
    border: 2px solid var(--black);
    border-radius: 50px;
    transition: background 0.1s;
  }
  .app-link:hover { background: var(--indigo); color: var(--ivory); border-color: var(--indigo); }
  .app-link.primary { background: var(--black); color: var(--ivory); }
  .app-link.primary:hover { background: var(--indigo); border-color: var(--indigo); }

  /* Dark CTA */
  .cta-dark {
    background: var(--black);
    color: var(--ivory);
    text-align: center;
    padding: 4rem 2rem;
    border-radius: 20px;
    max-width: 800px;
    margin: 0 auto 4rem;
  }
  .cta-dark h2 { font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
  .cta-dark p { font-size: 1.15rem; margin-bottom: 2rem; opacity: 0.85; }
  .btn-cta {
    background: var(--ivory);
    color: var(--black);
    padding: 1rem 2.5rem;
    border-radius: 50px;
    font-weight: 700;
    font-size: 1.05rem;
    text-decoration: none;
    display: inline-block;
    border: 3px solid var(--ivory);
    transition: background 0.15s, color 0.15s;
  }
  .btn-cta:hover { background: var(--indigo); color: var(--ivory); border-color: var(--indigo); }
</style>

<!-- Hero -->
<div class="hero">
  <span class="hero-badge">Explore Philosophy</span>
  <h1>What does it mean<br>to <span>know</span> something?</h1>
  <p>Seven interactive thought experiments drawn from the Stanford Encyclopedia of Philosophy — tacit knowledge, the knowing body, situated epistemology, and the AI consciousness boundary.</p>
  <div class="cta-buttons">
    <a href="https://links.vibes.diy/homepage" class="btn btn-primary">Start Exploring</a>
    <a href="https://links.vibes.diy/discord" class="btn btn-secondary">Join Discord</a>
  </div>
</div>

<!-- Value props -->
<div class="section">
  <div class="props-grid">
    <div class="prop-card">
      <div class="prop-icon">⟳</div>
      <div class="prop-title">Beyond Propositions</div>
      <p class="prop-desc">Ryle's regress shows that skills can't be fully reduced to rules — applying any rule requires knowing how to apply it, all the way down.</p>
    </div>
    <div class="prop-card">
      <div class="prop-icon">◎</div>
      <div class="prop-title">The Knowing Body</div>
      <p class="prop-desc">Cognition isn't housed in the brain and borrowed by the body — it's constituted by the body's engagement with the world.</p>
    </div>
    <div class="prop-card">
      <div class="prop-icon">⊕</div>
      <div class="prop-title">Who Knows What</div>
      <p class="prop-desc">The knower's position isn't bias to subtract — it's epistemically constitutive. Objectivity requires locating yourself, not erasing yourself.</p>
    </div>
  </div>
</div>

<!-- How it works -->
<div class="section" style="padding-top: 0;">
  <div class="card">
    <h2 class="section-title">How it works</h2>
    <p class="section-subtitle">Each app is a thought experiment, not a lecture.</p>
    <ol class="steps">
      <li class="step">
        <div class="step-num">1</div>
        <div class="step-text"><strong>Pick a topic</strong> — choose one of the seven philosophical threads below.</div>
      </li>
      <li class="step">
        <div class="step-num">2</div>
        <div class="step-text"><strong>Engage the argument</strong> — the app walks you through the key positions and challenges your assumptions.</div>
      </li>
      <li class="step">
        <div class="step-num">3</div>
        <div class="step-text"><strong>Work through it</strong> — write, respond, try to defeat the argument. Your reasoning is saved so you can return to it.</div>
      </li>
      <li class="step">
        <div class="step-num">4</div>
        <div class="step-text"><strong>Build your own view</strong> — every app ends with the AI implication: how does this bear on what AI can and can't know?</div>
      </li>
    </ol>
  </div>
</div>

<!-- Apps -->
<div class="section">
  <h2 class="section-title">Seven apps. Seven arguments.</h2>
  <p class="section-subtitle">Each draws directly from a Stanford Encyclopedia of Philosophy entry.</p>
  <div class="apps-grid">

    <div class="app-card">
      <img class="app-screenshot"
        src="https://knowing-how-vs-knowing-that--edu.prod-v2.vibesdiy.net/screenshot.jpg"
        alt="Knowing How vs. Knowing That"
        onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';">
      <div class="app-body">
        <div class="app-title">Knowing How vs. Knowing That</div>
        <p class="app-desc">Try to reduce a skill to a list of propositions — Ryle's regress argument shows why it always fails.</p>
        <div class="app-links">
          <a href="https://vibes.diy/vibe/edu/knowing-how-vs-knowing-that" class="app-link primary">Visit</a>
          <a href="https://vibes.diy/clone/edu/knowing-how-vs-knowing-that" class="app-link">Clone</a>
          <a href="https://vibes.diy/remix/edu/knowing-how-vs-knowing-that" class="app-link">Remix</a>
        </div>
      </div>
    </div>

    <div class="app-card">
      <img class="app-screenshot"
        src="https://embodied-cognition-explorer--edu.prod-v2.vibesdiy.net/screenshot.jpg"
        alt="Embodied Cognition Explorer"
        onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';">
      <div class="app-body">
        <div class="app-title">Embodied Cognition Explorer</div>
        <p class="app-desc">Four thought experiments where you can't separate cognition from the body — the cane, the dancer, the native speaker, the phantom limb.</p>
        <div class="app-links">
          <a href="https://vibes.diy/vibe/edu/embodied-cognition-explorer" class="app-link primary">Visit</a>
          <a href="https://vibes.diy/clone/edu/embodied-cognition-explorer" class="app-link">Clone</a>
          <a href="https://vibes.diy/remix/edu/embodied-cognition-explorer" class="app-link">Remix</a>
        </div>
      </div>
    </div>

    <div class="app-card">
      <img class="app-screenshot"
        src="https://phenomenology-first-person--edu.prod-v2.vibesdiy.net/screenshot.jpg"
        alt="Phenomenology: First-Person"
        onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';">
      <div class="app-body">
        <div class="app-title">Phenomenology: First-Person</div>
        <p class="app-desc">A guided phenomenological exercise — Husserl's intentionality, Heidegger's tool-being, Merleau-Ponty's body schema.</p>
        <div class="app-links">
          <a href="https://vibes.diy/vibe/edu/phenomenology-first-person" class="app-link primary">Visit</a>
          <a href="https://vibes.diy/clone/edu/phenomenology-first-person" class="app-link">Clone</a>
          <a href="https://vibes.diy/remix/edu/phenomenology-first-person" class="app-link">Remix</a>
        </div>
      </div>
    </div>

    <div class="app-card">
      <img class="app-screenshot"
        src="https://situated-knowledges--edu.prod-v2.vibesdiy.net/screenshot.jpg"
        alt="Situated Knowledges"
        onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';">
      <div class="app-body">
        <div class="app-title">Situated Knowledges</div>
        <p class="app-desc">Haraway's view from nowhere, Harding's standpoint epistemology, Fricker's epistemic injustice — the knower's position as epistemically constitutive.</p>
        <div class="app-links">
          <a href="https://vibes.diy/vibe/edu/situated-knowledges" class="app-link primary">Visit</a>
          <a href="https://vibes.diy/clone/edu/situated-knowledges" class="app-link">Clone</a>
          <a href="https://vibes.diy/remix/edu/situated-knowledges" class="app-link">Remix</a>
        </div>
      </div>
    </div>

    <div class="app-card">
      <img class="app-screenshot"
        src="https://virtue-epistemology--edu.prod-v2.vibesdiy.net/screenshot.jpg"
        alt="Virtue Epistemology"
        onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';">
      <div class="app-body">
        <div class="app-title">Virtue Epistemology</div>
        <p class="app-desc">Four vignettes — evaluate the reasoner's intellectual character, not just their conclusion. Sosa's reliabilism vs. Zagzebski's responsibilism.</p>
        <div class="app-links">
          <a href="https://vibes.diy/vibe/edu/virtue-epistemology" class="app-link primary">Visit</a>
          <a href="https://vibes.diy/clone/edu/virtue-epistemology" class="app-link">Clone</a>
          <a href="https://vibes.diy/remix/edu/virtue-epistemology" class="app-link">Remix</a>
        </div>
      </div>
    </div>

    <div class="app-card">
      <img class="app-screenshot"
        src="https://ai-consciousness-boundary--edu.prod-v2.vibesdiy.net/screenshot.jpg"
        alt="The AI Consciousness Boundary"
        onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';">
      <div class="app-body">
        <div class="app-title">The AI Consciousness Boundary</div>
        <p class="app-desc">Chalmers' hard problem, Nagel's bat, Searle's Chinese Room, philosophical zombies — why language production isn't proof of interiority.</p>
        <div class="app-links">
          <a href="https://vibes.diy/vibe/edu/ai-consciousness-boundary" class="app-link primary">Visit</a>
          <a href="https://vibes.diy/clone/edu/ai-consciousness-boundary" class="app-link">Clone</a>
          <a href="https://vibes.diy/remix/edu/ai-consciousness-boundary" class="app-link">Remix</a>
        </div>
      </div>
    </div>

    <div class="app-card">
      <img class="app-screenshot"
        src="https://extended-mind--edu.prod-v2.vibesdiy.net/screenshot.jpg"
        alt="The Extended Mind"
        onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';">
      <div class="app-body">
        <div class="app-title">The Extended Mind</div>
        <p class="app-desc">Clark & Chalmers: Otto's notebook is part of his memory. Four escalating cases — does AI extend your mind or shrink it?</p>
        <div class="app-links">
          <a href="https://vibes.diy/vibe/edu/extended-mind" class="app-link primary">Visit</a>
          <a href="https://vibes.diy/clone/edu/extended-mind" class="app-link">Clone</a>
          <a href="https://vibes.diy/remix/edu/extended-mind" class="app-link">Remix</a>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- Dark CTA -->
<div class="cta-dark">
  <h2>Build your own philosophy app</h2>
  <p>Every app here started as a single prompt. Pick any argument that interests you and build your own version — in minutes.</p>
  <a href="https://links.vibes.diy/homepage" class="btn-cta">Start on Vibes DIY</a>
</div>
```

- [ ] **Step 2: Build and verify**

```bash
pnpm check
```

Expected: build completes with no errors. Then:

```bash
open _site/philosophy.html
```

Visually verify: sticky header, hero with indigo span, three indigo-accented prop cards, how-it-works card, 7 app cards in grid, dark CTA, footer.

- [ ] **Step 3: Commit**

```bash
git add src/pages/philosophy.hbs
git commit -m "feat: add philosophy landing page (7 SEP-based apps, indigo skin)"
```

---

## Task 3: Capture OG screenshot

**Files:**
- Modify: `screenshot-pages.js` (add slug)
- Capture: `images/screenshots/philosophy.jpg`

- [ ] **Step 1: Add slug to screenshot-pages.js**

In `screenshot-pages.js`, find the `SLUGS` array and add `"philosophy"`:

```js
const SLUGS = [
  "accountability",
  // ... existing slugs ...
  "would-you-rather",
  "youtubers",
  "edu/study/flashcards",
  "edu/study/quizzes",
  "edu/syllabi",
  "featured-apps/image-generation",
  "philosophy",   // add this line
];
```

- [ ] **Step 2: Run screenshot capture**

```bash
pnpm check && node screenshot-pages.js
```

Expected: `images/screenshots/philosophy.jpg` created (size > 50KB; if tiny, the build or server had an issue — check `_site/philosophy.html` exists).

- [ ] **Step 3: Verify the screenshot file**

```bash
ls -lh images/screenshots/philosophy.jpg
```

Expected: file exists, size > 50KB.

- [ ] **Step 4: Add ogImage to philosophy.hbs frontmatter**

In `src/pages/philosophy.hbs`, update the frontmatter to add `ogImage`:

```hbs
{{!--
{
  "layout": "standard",
  "title": "Philosophy Apps — Vibes DIY",
  "description": "Seven interactive philosophy apps exploring tacit knowledge, embodied cognition, phenomenology, situated knowledges, virtue epistemology, and the AI consciousness boundary.",
  "ogUrl": "https://good.vibes.diy/philosophy/",
  "ogImage": "https://good.vibes.diy/images/screenshots/philosophy.jpg",
  "source": "philosophy"
}
--}}
```

- [ ] **Step 5: Rebuild and commit**

```bash
pnpm check
npx prettier --write screenshot-pages.js
git add src/pages/philosophy.hbs screenshot-pages.js images/screenshots/philosophy.jpg
git commit -m "feat: add OG screenshot for philosophy page"
```

---

## Task 4: Wire into homepage

**Files:**
- Modify: `src/pages/index.hbs`

- [ ] **Step 1: Add CSS for .landing-card.philosophy**

In `src/pages/index.hbs`, find the block of `.landing-card.*` CSS rules (around line 315). Add after the last `.landing-card.wyr` rule:

```css
.landing-card.philosophy  { border-color: #3B2F8C; }
.landing-card.philosophy:hover { background: linear-gradient(135deg, #fff 0%, #f0eeff 100%); }
```

- [ ] **Step 2: Add the HTML card**

In `src/pages/index.hbs`, find a suitable location in the card grid (near coaches, engineers, or psych). Add:

```html
<a href="philosophy.html" class="landing-card philosophy">
    <div class="card-icon">∴</div>
    <h2 class="card-title">Philosophy</h2>
    <p class="card-description">Seven thought experiments drawn from the Stanford Encyclopedia — tacit knowledge, embodied cognition, situated epistemology, and the AI consciousness boundary.</p>
    <span class="card-cta">Start Thinking →</span>
</a>
```

- [ ] **Step 3: Build, verify, commit**

```bash
pnpm check
open _site/index.html
```

Verify the philosophy card appears in the homepage grid with indigo border on hover.

```bash
git add src/pages/index.hbs
git commit -m "feat: add philosophy card to homepage"
```
