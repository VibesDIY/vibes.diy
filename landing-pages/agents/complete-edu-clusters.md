# Complete Remaining 10 Edu Cluster Pages

## Context

Three humanities cluster pages are live (`edu/literary-analysis`, `edu/cold-war-history`, `edu/critical-algorithms`). Ten more are marked "coming soon" in `edu/index.hbs`. All 50 apps are already deployed under `--user-slug edu`. This runbook builds the remaining pages.

## Pattern

Each cluster page is a `.hbs` file at `src/pages/edu/<slug>.hbs`. Copy the CSS verbatim from `src/pages/edu/literary-analysis.hbs` — the only differences per page are the frontmatter JSON (dept, vocab, sources, apps) and the h1 text.

Frontmatter structure:

```json
{
  "layout": "webring",
  "title": "<Cluster Label> | Vibes DIY Edu",
  "description": "<one sentence about the tools and syllabi>",
  "ogUrl": "https://good.vibes.diy/edu/<slug>/",
  "source": "edu-<slug>",
  "dept": "<department string>",
  "clusterSlug": "<json-slug>",
  "vocab": ["term1", "term2", ...],
  "sources": [ {"institution": "...", "title": "...", "url": "..."}, ... ],
  "apps": [
    {
      "num": "01", "slug": "<app-slug>", "author": "edu", "live": true,
      "title": "<Deployed Title>",
      "tagline": "<short punchy line>",
      "desc": "<2-3 sentence description for the app card>"
    },
    ...
  ]
}
```

The HTML body is identical across all cluster pages except the `h1` text and the h1's line break placement. Copy the body from `literary-analysis.hbs` exactly.

## Files to create

One `.hbs` per cluster:

```
src/pages/edu/slavery-civil-rights.hbs
src/pages/edu/us-foreign-policy.hbs
src/pages/edu/urban-race-housing.hbs
src/pages/edu/latin-american-history.hbs
src/pages/edu/ethics-philosophy.hbs
src/pages/edu/revolutions-political-change.hbs
src/pages/edu/capitalism-labor-history.hbs
src/pages/edu/gender-colonialism.hbs
src/pages/edu/music-sound-culture.hbs
src/pages/edu/algorithmic-creative-writing.hbs
```

## Files to update after creating pages

**1. `src/pages/edu/index.hbs`** — remove `cluster-card--soon` class and add href for each newly built cluster. The 10 coming-soon cards are already in the file; just add `href="<slug>.html"` and remove the `class="cluster-card cluster-card--soon"` → `class="cluster-card"`, replace the `<div class="cc-soon">` with `<div class="cc-cta">N tools →</div><div class="cc-count"><sources></div>`.

**2. `src/pages/edu/syllabi.hbs`** — the `CLUSTER_MAP` JS object at the bottom needs entries for each new cluster. Add to the `CLUSTERS` array using course title substrings from each cluster's `sources` array.

**3. `research-humanities/clusters/<cluster>.json`** — add `"page_url": "/edu/<slug>.html"` to each cluster JSON (same as was done for the 3 live clusters).

---

## Cluster data

### 1. Slavery, Civil Rights & Reconstruction

**File:** `src/pages/edu/slavery-civil-rights.hbs`
**JSON slug:** `slavery-civil-rights` · **page_url:** `/edu/slavery-civil-rights.html`

```json
{
  "dept": "History — American",
  "clusterSlug": "slavery-civil-rights",
  "vocab": [
    "chattel slavery",
    "abolition movement",
    "Reconstruction amendments",
    "freedpeople",
    "Jim Crow",
    "civil rights movement",
    "Black Power",
    "mass incarceration",
    "Great Migration",
    "Harlem Renaissance",
    "racial uplift ideology"
  ],
  "sources": [
    {
      "institution": "UW–Madison",
      "title": "History 393 – Slavery, Civil War, and Reconstruction",
      "url": "https://history.wisc.edu/syllabi-library/"
    },
    {
      "institution": "UW–Madison",
      "title": "History 321 – African American History Since 1900",
      "url": "https://history.wisc.edu/syllabi-library/"
    },
    {
      "institution": "MIT OCW",
      "title": "21H.102 American History Since 1865",
      "url": "https://ocw.mit.edu/courses/history/"
    },
    {
      "institution": "H-Net H-Urban",
      "title": "Race, Immigration & Urban Politics",
      "url": "https://networks.h-net.org/node/22277/pages/40096/syllabus-archive-introduction"
    }
  ],
  "apps": [
    {
      "num": "01",
      "slug": "reconstruction-timeline",
      "author": "edu",
      "live": true,
      "title": "Reconstruction Codex",
      "tagline": "The 13th, 14th, and 15th amendments — what they promised and what happened.",
      "desc": "Explore the Reconstruction amendments: what each said, what freedpeople expected, how Reconstruction was dismantled, and the long aftermath through Jim Crow and the civil rights era."
    },
    {
      "num": "02",
      "slug": "great-migration-tracker",
      "author": "edu",
      "live": true,
      "title": "Great Migration",
      "tagline": "Pick a Southern city. Trace the routes north and west.",
      "desc": "Pick a city of origin and trace the Great Migration routes — what pushed people out of the South, what drew them to Chicago or Detroit or Los Angeles, and what they found when they arrived."
    },
    {
      "num": "03",
      "slug": "civil-rights-movement",
      "author": "edu",
      "live": true,
      "title": "Civil Rights Timeline",
      "tagline": "Pick a year. See the organizations, the government response, the local tensions.",
      "desc": "Year-by-year explorer of the civil rights movement — key events, the organizations involved, government responses, and the local and national tensions that shaped each moment."
    },
    {
      "num": "04",
      "slug": "racial-capitalism-history",
      "author": "edu",
      "live": true,
      "title": "Racial Capitalism Timeline",
      "tagline": "Slavery, Reconstruction, Jim Crow, mass incarceration — how racial hierarchy was encoded into economics.",
      "desc": "Pick an era and trace how racial hierarchy was encoded into economic structures — labor control, property law, credit markets, and the political economy of each period."
    },
    {
      "num": "05",
      "slug": "black-feminist-thought",
      "author": "edu",
      "live": true,
      "title": "Elder Codex",
      "tagline": "Intersectionality, the matrix of domination, the politics of respectability.",
      "desc": "Explore Black feminist thought through Crenshaw, Collins, and hooks — what intersectionality means, how the matrix of domination works, and what the politics of respectability produced historically."
    }
  ]
}
```

**h1 text:** `Slavery, Reconstruction<br>&amp; Civil Rights`

**syllabi.hbs CLUSTER_MAP entry:**

```js
{
  label: "Slavery & Civil Rights",
  url: "slavery-civil-rights.html",
  matches: ["Slavery, Civil War", "African American History", "Race, Immigration"]
}
```

---

### 2. U.S. Foreign Policy & Diplomacy

**File:** `src/pages/edu/us-foreign-policy.hbs`
**JSON slug:** `us-foreign-policy` · **page_url:** `/edu/us-foreign-policy.html`

```json
{
  "dept": "History — Diplomatic / International",
  "clusterSlug": "us-foreign-policy",
  "vocab": [
    "American imperialism",
    "containment strategy",
    "FRUS documents",
    "declassified documents",
    "Big Stick diplomacy",
    "Dollar Diplomacy",
    "Open Door policy",
    "archival diplomacy",
    "modernization theory",
    "American exceptionalism",
    "transnational history"
  ],
  "sources": [
    {
      "institution": "H-Net H-Diplo",
      "title": "History of U.S. Foreign Policy (1890s–present)",
      "url": "https://networks.h-net.org/node/28443/pages/59076/h-diplo-syllabus-archive"
    },
    {
      "institution": "H-Net H-Diplo",
      "title": "U.S. Diplomatic History — 20th Century",
      "url": "https://networks.h-net.org/node/28443/pages/59076/h-diplo-syllabus-archive"
    },
    {
      "institution": "H-Net H-Diplo",
      "title": "U.S. Foreign Relations to 1914",
      "url": "https://networks.h-net.org/node/28443/pages/59076/h-diplo-syllabus-archive"
    },
    {
      "institution": "MIT OCW",
      "title": "21H.009 The World: 1400–Present",
      "url": "https://ocw.mit.edu/courses/history/"
    }
  ],
  "apps": [
    {
      "num": "01",
      "slug": "foreign-policy-doctrine-quiz",
      "author": "edu",
      "live": true,
      "title": "Doctrine Codex",
      "tagline": "Monroe, Big Stick, Open Door, containment — which doctrine was this?",
      "desc": "Read a historical scenario and identify which foreign policy doctrine applied — Monroe, Big Stick, Dollar Diplomacy, Open Door, or containment — then see what actually happened."
    },
    {
      "num": "02",
      "slug": "frus-document-explorer",
      "author": "edu",
      "live": true,
      "title": "Margin Notes",
      "tagline": "Pick a diplomatic crisis. Step through the archival record.",
      "desc": "Walk through the Foreign Relations of the United States archive — what State Department cables said, what the President knew, what was hidden from Congress, and what the documents reveal."
    },
    {
      "num": "03",
      "slug": "american-imperialism-timeline",
      "author": "edu",
      "live": true,
      "title": "Intervention Timeline",
      "tagline": "US overseas expansion from 1898 to the present, justification by justification.",
      "desc": "Trace US overseas expansion — Philippines, Panama, Cuba, Vietnam, Iraq — and examine the justifications used each time: civilizing mission, strategic interest, democracy promotion, humanitarian intervention."
    },
    {
      "num": "04",
      "slug": "transnational-history-mapper",
      "author": "edu",
      "live": true,
      "title": "Transnational Networks",
      "tagline": "Pick a 20th-century movement. Trace how it crossed borders.",
      "desc": "Pick a transnational movement — anti-colonialism, non-alignment, human rights, labor internationalism — and trace how it crossed borders and shaped US foreign policy responses and resistance."
    },
    {
      "num": "05",
      "slug": "foreign-policy-decision-case",
      "author": "edu",
      "live": true,
      "title": "Crisis Framework Coach",
      "tagline": "Cuban Missile Crisis, Gulf of Tonkin, Iraq 2003 — who advised what, what was known.",
      "desc": "Pick a foreign policy crisis and walk through the decision process — who was in the room, what each advisor recommended, what intelligence said, what assumptions drove the choice."
    }
  ]
}
```

**h1 text:** `U.S. Foreign Policy<br>&amp; Diplomacy`

**syllabi.hbs CLUSTER_MAP entry:**

```js
{
  label: "US Foreign Policy",
  url: "us-foreign-policy.html",
  matches: ["U.S. Foreign Policy", "Diplomatic History", "U.S. Foreign Relations", "The U.S. and the Modern World"]
}
```

---

### 3. Urban History, Race & Housing

**File:** `src/pages/edu/urban-race-housing.hbs`
**JSON slug:** `urban-race-housing` · **page_url:** `/edu/urban-race-housing.html`

```json
{
  "dept": "History — Urban",
  "clusterSlug": "urban-race-housing",
  "vocab": [
    "suburbanization",
    "racial segregation in housing",
    "white flight",
    "redlining",
    "metropolitan decentralization",
    "neighborhood formation",
    "residential segregation",
    "ethnic niche economics",
    "political incorporation",
    "urban reform movements",
    "minority political representation"
  ],
  "sources": [
    {
      "institution": "H-Net H-Urban",
      "title": "The New Suburban History",
      "url": "https://networks.h-net.org/node/22277/pages/40096/syllabus-archive-introduction"
    },
    {
      "institution": "H-Net H-Urban",
      "title": "Race, Immigration & Urban Politics",
      "url": "https://networks.h-net.org/node/22277/pages/40096/syllabus-archive-introduction"
    },
    {
      "institution": "H-Net H-Urban",
      "title": "History of Urban Problems",
      "url": "https://networks.h-net.org/node/22277/pages/40096/syllabus-archive-introduction"
    }
  ],
  "apps": [
    {
      "num": "01",
      "slug": "suburbanization-timeline",
      "author": "edu",
      "live": true,
      "title": "Suburban Divide",
      "tagline": "Pick a metro area. Trace the postwar expansion and who was excluded.",
      "desc": "Trace the postwar suburban boom in a metro area — FHA loans, highway construction, white flight, the hollowing of the urban core, and the mechanisms that excluded Black families from the suburban wealth boom."
    },
    {
      "num": "02",
      "slug": "redlining-explorer",
      "author": "edu",
      "live": true,
      "title": "Redlining Explorer",
      "tagline": "Pick a city and decade. See how neighborhood grades shaped wealth for generations.",
      "desc": "Explore how HOLC neighborhood grades shaped mortgage access, school funding, and generational wealth accumulation — and trace whose neighborhoods were colored red and what that meant."
    },
    {
      "num": "03",
      "slug": "urban-reform-timeline",
      "author": "edu",
      "live": true,
      "title": "Critical Timeline",
      "tagline": "Pick an urban problem. Trace the reform movement that responded.",
      "desc": "Pick a city problem — cholera, tenements, machine politics, highway construction, urban renewal — and trace the reform movement: who organized, what institutional support they had, what changed, what didn't."
    },
    {
      "num": "04",
      "slug": "ethnic-neighborhood-formation",
      "author": "edu",
      "live": true,
      "title": "Neighborhood Archive",
      "tagline": "Who came first, who replaced them, and what economic structures made each group's foothold possible.",
      "desc": "Read a neighborhood history and identify the ethnic succession — who settled first, who replaced them, what economic niches enabled each group's arrival, and how the process shaped the city's political geography."
    },
    {
      "num": "05",
      "slug": "political-incorporation-tracker",
      "author": "edu",
      "live": true,
      "title": "Incorporation Ledger",
      "tagline": "From exclusion to political representation — coalitions, machines, protest, electoral success.",
      "desc": "Pick an immigrant or minority group in a city and trace how they moved from political exclusion to representation — machine politics, community organizing, protest, coalition-building, and electoral breakthroughs."
    }
  ]
}
```

**h1 text:** `Urban History,<br>Race &amp; Housing`

**syllabi.hbs CLUSTER_MAP entry:**

```js
{
  label: "Urban, Race & Housing",
  url: "urban-race-housing.html",
  matches: ["New Suburban History", "History of Urban Problems"]
}
```

---

### 4. Latin American History

**File:** `src/pages/edu/latin-american-history.hbs`
**JSON slug:** `latin-american-history` · **page_url:** `/edu/latin-american-history.html`

```json
{
  "dept": "History — Latin American",
  "clusterSlug": "latin-american-history",
  "vocab": [
    "mestizaje",
    "encomienda system",
    "mita labor tribute",
    "castas system",
    "land reform",
    "liberation theology",
    "anti-imperialism",
    "guerrilla warfare",
    "Mexican Revolution",
    "Zapatista movement",
    "Nicaraguan Revolution",
    "indigenous sovereignty",
    "historical memory",
    "creole identity",
    "Bourbon Reforms"
  ],
  "sources": [
    {
      "institution": "H-Net H-LatAm",
      "title": "Modern Central American History",
      "url": "https://networks.h-net.org/node/23910/pages/27764/h-latam-syllabi"
    },
    {
      "institution": "H-Net H-LatAm",
      "title": "Reform and Revolution in Latin America",
      "url": "https://networks.h-net.org/node/23910/pages/27764/h-latam-syllabi"
    },
    {
      "institution": "H-Net H-LatAm",
      "title": "Colonial Latin American History",
      "url": "https://networks.h-net.org/node/23910/pages/27764/h-latam-syllabi"
    },
    {
      "institution": "UT Austin",
      "title": "ARH 347N: Aztec Art and Civilization",
      "url": "https://utdirect.utexas.edu/apps/student/coursedocs/nlogon/"
    }
  ],
  "apps": [
    {
      "num": "01",
      "slug": "colonial-latin-america",
      "author": "edu",
      "live": true,
      "title": "Codex Coloniae",
      "tagline": "Encomienda, mita, hacienda — how colonial labor shaped race and land.",
      "desc": "Pick a colonial institution and trace how it shaped labor, racial hierarchy, and land tenure — from Spanish conquest through independence and into the 19th century."
    },
    {
      "num": "02",
      "slug": "latin-american-revolution",
      "author": "edu",
      "live": true,
      "title": "Revolución Atlas",
      "tagline": "Mexico, Cuba, Nicaragua, El Salvador — causes, outcomes, and the US response.",
      "desc": "Pick a 20th-century Latin American revolution and compare the structural causes, the revolutionary ideology, the outcome, and the US government response — from covert operations to open intervention."
    },
    {
      "num": "03",
      "slug": "land-reform-case",
      "author": "edu",
      "live": true,
      "title": "Land Reform Atlas",
      "tagline": "Mexico 1917, Guatemala 1952, Chile 1970 — who got land, who resisted, what the US did.",
      "desc": "Pick a land reform effort and trace the agrarian redistribution: who organized for it, who resisted (landlords, US corporations, the CIA), and what the political aftermath produced."
    },
    {
      "num": "04",
      "slug": "historical-memory-quiz",
      "author": "edu",
      "live": true,
      "title": "Memoria Contestada",
      "tagline": "How atrocities were suppressed, remembered, and eventually recognized.",
      "desc": "Read about a historical atrocity — La Matanza, the Guatemalan genocide, the dirty wars — and trace how it was suppressed from official memory, how survivors preserved it, and how it eventually entered public reckoning."
    },
    {
      "num": "05",
      "slug": "indigenous-sovereignty",
      "author": "edu",
      "live": true,
      "title": "Sovereignty Codex",
      "tagline": "From the encomienda to the Zapatistas — indigenous resistance across five centuries.",
      "desc": "Pick a region and trace indigenous resistance to colonial and postcolonial states — from the encomienda system and colonial rebellions through independence-era dispossession to 20th-century sovereignty movements."
    }
  ]
}
```

**h1 text:** `Latin American History`

**syllabi.hbs CLUSTER_MAP entry:**

```js
{
  label: "Latin American History",
  url: "latin-american-history.html",
  matches: ["Central American History", "Reform and Revolution in Latin America", "Colonial Latin American History", "Aztec Art"]
}
```

---

### 5. Ethics & Philosophy

**File:** `src/pages/edu/ethics-philosophy.hbs`
**JSON slug:** `ethics-philosophy` · **page_url:** `/edu/ethics-philosophy.html`

```json
{
  "dept": "Linguistics & Philosophy",
  "clusterSlug": "ethics-philosophy",
  "vocab": [
    "philosophy of mind",
    "dualism vs. physicalism",
    "compatibilism",
    "free will",
    "personal identity",
    "metaethics",
    "moral subjectivism",
    "social construction",
    "feminist epistemology",
    "animal ethics",
    "global justice",
    "climate ethics",
    "normative frameworks",
    "empiricism",
    "rationalism"
  ],
  "sources": [
    {
      "institution": "MIT OCW",
      "title": "24.00 Problems of Philosophy",
      "url": "https://ocw.mit.edu/courses/linguistics-and-philosophy/"
    },
    {
      "institution": "MIT OCW SHASS",
      "title": "Good Food: Ethics and Politics of Food",
      "url": "https://ocw.mit.edu/courses/linguistics-and-philosophy/"
    },
    {
      "institution": "UT Austin",
      "title": "PHL 301L: Early Modern Philosophy",
      "url": "https://utdirect.utexas.edu/apps/student/coursedocs/nlogon/"
    }
  ],
  "apps": [
    {
      "num": "01",
      "slug": "philosophy-of-mind",
      "author": "edu",
      "live": true,
      "title": "Codex Of Mind",
      "tagline": "Dualism vs. physicalism — what each says about consciousness and what evidence could settle it.",
      "desc": "Explore the mind-body problem: what dualism and physicalism each claim about consciousness, what the hard problem is, and what kinds of evidence — if any — could settle the debate."
    },
    {
      "num": "02",
      "slug": "applied-ethics-cases",
      "author": "edu",
      "live": true,
      "title": "Moral Compass",
      "tagline": "Factory farming, climate change, AI — worked through three ethical frameworks.",
      "desc": "Pick an ethical scenario and work through it using utilitarian, deontological, and virtue ethics frameworks. See where they agree, where they diverge, and what the stakes of each position are."
    },
    {
      "num": "03",
      "slug": "free-will-moral-responsibility",
      "author": "edu",
      "live": true,
      "title": "Crucible Of Judgment",
      "tagline": "Is this person morally responsible? Compatibilist and incompatibilist reasoning through real cases.",
      "desc": "Read a scenario and decide: is the person morally responsible? The tool traces compatibilist and incompatibilist reasoning through the case — what each position says and why it matters for ethics."
    },
    {
      "num": "04",
      "slug": "epistemology-challenge",
      "author": "edu",
      "live": true,
      "title": "Foundations Epistemology",
      "tagline": "Pick an everyday belief. What would Descartes, Hume, or Kant say about how you know it?",
      "desc": "Pick an ordinary belief and trace its epistemic justification — what skeptical challenges can be raised, how Descartes, Hume, and Kant would approach it, and what's left standing after scrutiny."
    },
    {
      "num": "05",
      "slug": "metaethics-explainer",
      "author": "edu",
      "live": true,
      "title": "Metaethics Codex",
      "tagline": "Are moral facts objective or constructed? What's at stake for everyday moral judgment.",
      "desc": "Explore metaethical positions — moral subjectivism, relativism, and realism — and see what each claims about the status of moral facts and what the disagreement means for how we make moral arguments."
    }
  ]
}
```

**h1 text:** `Ethics &amp; Philosophy`

**syllabi.hbs CLUSTER_MAP entry:**

```js
{
  label: "Ethics & Philosophy",
  url: "ethics-philosophy.html",
  matches: ["Problems of Philosophy", "Ethics and Politics of Food", "Early Modern Philosophy"]
}
```

---

### 6. Revolutions & Political Change

**File:** `src/pages/edu/revolutions-political-change.hbs`
**JSON slug:** `revolutions-political-change` · **page_url:** `/edu/revolutions-political-change.html`

```json
{
  "dept": "History — Comparative",
  "clusterSlug": "revolutions-political-change",
  "vocab": [
    "American Revolution",
    "French Revolution",
    "Haitian Revolution",
    "revolutionary declarations",
    "causes of revolution",
    "Atlantic revolutions",
    "comparative history",
    "decolonization",
    "anti-imperialism",
    "caudillismo",
    "guerrilla warfare",
    "liberation theology"
  ],
  "sources": [
    {
      "institution": "MIT OCW SHASS",
      "title": "How to Stage a Revolution",
      "url": "https://ocw.mit.edu/courses/history/"
    },
    {
      "institution": "MIT OCW",
      "title": "21H.009 The World: 1400–Present",
      "url": "https://ocw.mit.edu/courses/history/"
    },
    {
      "institution": "H-Net H-LatAm",
      "title": "Reform and Revolution in Latin America",
      "url": "https://networks.h-net.org/node/23910/pages/27764/h-latam-syllabi"
    },
    {
      "institution": "H-Net H-LatAm",
      "title": "Modern Central American History",
      "url": "https://networks.h-net.org/node/23910/pages/27764/h-latam-syllabi"
    }
  ],
  "apps": [
    {
      "num": "01",
      "slug": "atlantic-revolutions",
      "author": "edu",
      "live": true,
      "title": "Revolution Compare",
      "tagline": "American, French, Haitian, Latin American — same era, different outcomes.",
      "desc": "Pick two Atlantic revolutions and compare causes, ideologies, and outcomes. How did the Haitian Revolution challenge the logic of the French? Why did Latin American independence produce different regimes?"
    },
    {
      "num": "02",
      "slug": "revolutionary-document-reading",
      "author": "edu",
      "live": true,
      "title": "Founders Codex",
      "tagline": "Declaration of Independence, Rights of Man, Haitian Declaration — who was included and who wasn't.",
      "desc": "Pick a founding document and trace who was included in its proclamations of liberty, who was excluded, and what that exclusion reveals about the revolution's actual social program."
    },
    {
      "num": "03",
      "slug": "causes-of-revolution",
      "author": "edu",
      "live": true,
      "title": "Revolution Radar",
      "tagline": "Economic crisis, political exclusion, ideological challenge, state weakness — which conditions were present?",
      "desc": "Pick a revolution and trace the structural conditions that made it possible — economic grievance, political exclusion, ideological challenge to the regime, and state weakness or overreach."
    },
    {
      "num": "04",
      "slug": "decolonization-timeline",
      "author": "edu",
      "live": true,
      "title": "Threads Of Liberation",
      "tagline": "Africa, Asia, the Caribbean — how colonized peoples won independence.",
      "desc": "Pick a region and trace how colonized peoples won independence — negotiation, armed struggle, Cold War leverage, international pressure, and the different forms independence took."
    },
    {
      "num": "05",
      "slug": "revolutionary-aftermath",
      "author": "edu",
      "live": true,
      "title": "Revolution Patterns",
      "tagline": "Consolidation, betrayal, reaction, or new revolution — what patterns repeat?",
      "desc": "Read about a revolutionary aftermath and trace what happened next: who consolidated power, where the revolution was betrayed, what the reaction produced, and what patterns recur across different cases."
    }
  ]
}
```

**h1 text:** `Revolutions &amp;<br>Political Change`

**syllabi.hbs CLUSTER_MAP entry:**

```js
{
  label: "Revolutions & Political Change",
  url: "revolutions-political-change.html",
  matches: ["How to Stage a Revolution"]
}
```

---

### 7. History of Capitalism & Labor

**File:** `src/pages/edu/capitalism-labor-history.hbs`
**JSON slug:** `capitalism-labor-history` · **page_url:** `/edu/capitalism-labor-history.html`

```json
{
  "dept": "History — Economic / Social",
  "clusterSlug": "capitalism-labor-history",
  "vocab": [
    "history of capitalism",
    "labor history",
    "class formation",
    "political economy",
    "industrialization",
    "financialization",
    "primitive accumulation",
    "market society",
    "racial capitalism",
    "Atlantic slavery",
    "plantation economy",
    "Gilded Age",
    "progressive reform"
  ],
  "sources": [
    {
      "institution": "UW–Madison",
      "title": "History 329 – History of American Capitalism",
      "url": "https://history.wisc.edu/syllabi-library/"
    },
    {
      "institution": "UW–Madison",
      "title": "History 393 – Slavery, Civil War, and Reconstruction",
      "url": "https://history.wisc.edu/syllabi-library/"
    },
    {
      "institution": "MIT OCW",
      "title": "21H.102 American History Since 1865",
      "url": "https://ocw.mit.edu/courses/history/"
    },
    {
      "institution": "MIT OCW SHASS",
      "title": "Foundations of Western Culture: The Making of the Modern World",
      "url": "https://ocw.mit.edu/courses/history/"
    }
  ],
  "apps": [
    {
      "num": "01",
      "slug": "capitalism-timeline",
      "author": "edu",
      "live": true,
      "title": "Capitalism Atlas",
      "tagline": "Mercantile, industrial, financial — how capital, labor, and the state related in each era.",
      "desc": "Pick an era of capitalism and trace how the relationship between capital, labor, and the state changed — from mercantile colonialism through industrial capitalism and into 20th-century financialization."
    },
    {
      "num": "02",
      "slug": "labor-conflict-case",
      "author": "edu",
      "live": true,
      "title": "Labor Cases",
      "tagline": "Homestead, Triangle Shirtwaist, Flint Sit-Down — what workers wanted, what changed.",
      "desc": "Pick a labor conflict and trace what workers demanded, how employers responded, what the state did, and what lasting changes — in law, organizing, or workplace conditions — the conflict produced."
    },
    {
      "num": "03",
      "slug": "racial-capitalism-cases",
      "author": "edu",
      "live": true,
      "title": "Chronicle Atlas",
      "tagline": "Racial hierarchy as a feature of capitalism, not a distortion — across four centuries.",
      "desc": "Explore how racial hierarchy was integral to capital accumulation — slavery, convict leasing, racial wage differentials, redlining — and trace how each form served the accumulation needs of its era."
    },
    {
      "num": "04",
      "slug": "primitive-accumulation-cases",
      "author": "edu",
      "live": true,
      "title": "Case Study Forum",
      "tagline": "English commons, colonial land seizure, Native dispossession — how pre-capitalist resources became capital.",
      "desc": "Pick an enclosure or dispossession and trace how pre-capitalist resources were converted into private capital — who organized it, who resisted, what legal and violent mechanisms made it possible."
    },
    {
      "num": "05",
      "slug": "financialization-quiz",
      "author": "edu",
      "live": true,
      "title": "Wall Street Quiz",
      "tagline": "Mortgage-backed securities, private equity, credit default swaps — who bears the risk?",
      "desc": "Read about a financial instrument or crisis and trace how it connects to the real economy — what it claimed to do, who profited from it, who bore the risk, and what the 2008 crisis reveals about the structure."
    }
  ]
}
```

**h1 text:** `History of Capitalism<br>&amp; Labor`

**syllabi.hbs CLUSTER_MAP entry:**

```js
{
  label: "Capitalism & Labor",
  url: "capitalism-labor-history.html",
  matches: ["History of American Capitalism", "Foundations of Western Culture"]
}
```

---

### 8. Gender, Race & Colonialism

**File:** `src/pages/edu/gender-colonialism.hbs`
**JSON slug:** `gender-colonialism` · **page_url:** `/edu/gender-colonialism.html`

```json
{
  "dept": "History — Gender / Postcolonial",
  "clusterSlug": "gender-colonialism",
  "vocab": [
    "settler colonialism",
    "intersectionality",
    "feminist historiography",
    "racial formation",
    "indigenous resistance",
    "creolization",
    "maroon history",
    "Caribbean diaspora",
    "Caribbean nationalism",
    "decolonization",
    "gender politics",
    "postcolonial studies"
  ],
  "sources": [
    {
      "institution": "UW–Madison",
      "title": "History 315 – Gender, Race and Colonialism",
      "url": "https://history.wisc.edu/syllabi-library/"
    },
    {
      "institution": "UW–Madison",
      "title": "History 347 – The Caribbean and its Diasporas",
      "url": "https://history.wisc.edu/syllabi-library/"
    },
    {
      "institution": "H-Net H-Diplo",
      "title": "U.S. Foreign Relations to 1914",
      "url": "https://networks.h-net.org/node/28443/pages/59076/h-diplo-syllabus-archive"
    },
    {
      "institution": "H-Net H-LatAm",
      "title": "Colonial Latin American History",
      "url": "https://networks.h-net.org/node/23910/pages/27764/h-latam-syllabi"
    }
  ],
  "apps": [
    {
      "num": "01",
      "slug": "settler-colonialism-explainer",
      "author": "edu",
      "live": true,
      "title": "Elder Codex",
      "tagline": "North America, Australia, Palestine, South Africa — the logic of elimination.",
      "desc": "Pick a settler colonial context and trace the logic of elimination — how settler colonial states handled indigenous presence, what the difference is between elimination and assimilation, and what resistance looked like."
    },
    {
      "num": "02",
      "slug": "intersectionality-case",
      "author": "edu",
      "live": true,
      "title": "Hermetic Codex",
      "tagline": "Gender, race, and class together — how the three axes shaped a historical experience.",
      "desc": "Pick a historical figure or group and trace how gender, race, and class intersected to shape their experience — not each axis separately but how they combined and what that produced."
    },
    {
      "num": "03",
      "slug": "caribbean-diaspora-timeline",
      "author": "edu",
      "live": true,
      "title": "Caribbean Archive",
      "tagline": "Atlantic slavery roots, emancipation, colonial rule, independence, diaspora — one island's full arc.",
      "desc": "Pick a Caribbean island and trace its full historical arc — the Atlantic slave trade, plantation economy, emancipation, colonial administration, independence movements, and the 20th-century diaspora."
    },
    {
      "num": "04",
      "slug": "feminist-historiography-explorer",
      "author": "edu",
      "live": true,
      "title": "Feminist Codex",
      "tagline": "What questions feminist historians asked that conventional history missed.",
      "desc": "Pick a historical topic — war, labor, religion, empire — and see what questions feminist historians asked that conventional history overlooked. Whose stories were missing, and what changed when they were included."
    },
    {
      "num": "05",
      "slug": "creolization-quiz",
      "author": "edu",
      "live": true,
      "title": "Syncretism Atlas",
      "tagline": "Language, religion, food, music — how African, European, and indigenous elements blended under colonial conditions.",
      "desc": "Pick a Caribbean cultural practice and trace how it blended African, European, and indigenous elements under colonial conditions — what creolization produced, how it was suppressed, how it survived."
    }
  ]
}
```

**h1 text:** `Gender, Race<br>&amp; Colonialism`

**syllabi.hbs CLUSTER_MAP entry:**

```js
{
  label: "Gender, Race & Colonialism",
  url: "gender-colonialism.html",
  matches: ["Gender, Race and Colonialism", "The Caribbean and its Diasporas"]
}
```

---

### 9. Music, Sound & Culture

**File:** `src/pages/edu/music-sound-culture.hbs`
**JSON slug:** `music-sound-culture` · **page_url:** `/edu/music-sound-culture.html`

```json
{
  "dept": "Music / Sound Studies",
  "clusterSlug": "music-sound-culture",
  "vocab": [
    "jazz improvisation",
    "free improvisation",
    "jazz history",
    "critical listening",
    "African American music",
    "jazz idiom",
    "composition vs. performance",
    "ensemble improvisation",
    "music and society",
    "non-western traditions",
    "computational music"
  ],
  "sources": [
    {
      "institution": "MIT OCW SHASS",
      "title": "Musical Improvisation",
      "url": "https://ocw.mit.edu/courses/music-and-theater-arts/"
    },
    {
      "institution": "UT Austin",
      "title": "MUS 307: Jazz Appreciation",
      "url": "https://utdirect.utexas.edu/apps/student/coursedocs/nlogon/"
    },
    {
      "institution": "SFPC",
      "title": "Computational Exploration of Magical and Divinatory Language",
      "url": "https://sfpc.study/classes"
    }
  ],
  "apps": [
    {
      "num": "01",
      "slug": "jazz-improvisation-explainer",
      "author": "edu",
      "live": true,
      "title": "Jazz Improv Explainer",
      "tagline": "Pick a jazz standard. Trace the chord changes, the modes, how improvisers navigate the form.",
      "desc": "Pick a jazz standard and trace how improvisers navigate it — the chord changes, the available modes over each chord, and how bebop, modal, and free approaches handle the same harmonic material differently."
    },
    {
      "num": "02",
      "slug": "jazz-history-timeline",
      "author": "edu",
      "live": true,
      "title": "Jazz Age Explorer",
      "tagline": "Pick a decade. Key recordings, musicians, venues, social context.",
      "desc": "Pick a decade of jazz history and see the key recordings, the musicians, the clubs and venues, and the social context — how jazz evolved from New Orleans through bebop, cool, free, and fusion."
    },
    {
      "num": "03",
      "slug": "critical-listening-guide",
      "author": "edu",
      "live": true,
      "title": "Jazz Guide",
      "tagline": "Pick a recording. Get a framework for hearing what's happening.",
      "desc": "Pick a jazz recording and get a structured listening framework — instrumentation, form, soloist choices, rhythm section interaction, and how the recording fits its historical moment and stylistic context."
    },
    {
      "num": "04",
      "slug": "music-society-case",
      "author": "edu",
      "live": true,
      "title": "Marginalia Codex",
      "tagline": "Pick a genre. Who made it, who consumed it, what it meant to its community.",
      "desc": "Pick a musical genre and trace its social context — who created it, who the audience was, how it was received by the mainstream, what it meant to its originating community, and how that meaning changed."
    },
    {
      "num": "05",
      "slug": "improvisation-traditions",
      "author": "edu",
      "live": true,
      "title": "Improv Traditions",
      "tagline": "Jazz vs. Indian classical, free jazz vs. gamelan — how each approaches the individual-ensemble relationship.",
      "desc": "Pick two improvisation traditions and compare how each approaches melody, rhythm, structure, and the relationship between the individual soloist and the ensemble — what each tradition values and why."
    }
  ]
}
```

**h1 text:** `Music, Sound<br>&amp; Culture`

**syllabi.hbs CLUSTER_MAP entry:**

```js
{
  label: "Music, Sound & Culture",
  url: "music-sound-culture.html",
  matches: ["Musical Improvisation", "Jazz Appreciation"]
}
```

---

### 10. Algorithmic & Experimental Writing

**File:** `src/pages/edu/algorithmic-creative-writing.hbs`
**JSON slug:** `algorithmic-creative-writing` · **page_url:** `/edu/algorithmic-creative-writing.html`

```json
{
  "dept": "Literature / Creative Writing / Media Arts",
  "clusterSlug": "algorithmic-creative-writing",
  "vocab": [
    "Oulipo and constrained writing",
    "algorithmic text generation",
    "language models",
    "aleatoric writing",
    "agency and authorship",
    "programmatic situations",
    "constrained writing",
    "procedural generation",
    "generative text",
    "divinatory ontologies",
    "ineffable meanings"
  ],
  "sources": [
    {
      "institution": "SFPC",
      "title": "The Unfinished Sentence: Algorithmic Text Generation",
      "url": "https://sfpc.study/classes"
    },
    {
      "institution": "SFPC",
      "title": "Computational Exploration of Magical and Divinatory Language",
      "url": "https://sfpc.study/classes"
    },
    {
      "institution": "MIT OCW SHASS",
      "title": "Writing About Literature: Writing About Love",
      "url": "https://ocw.mit.edu/courses/literature/"
    }
  ],
  "apps": [
    {
      "num": "01",
      "slug": "oulipo-constraint-generator",
      "author": "edu",
      "live": true,
      "title": "Oulipo Workshop",
      "tagline": "Lipogram, N+7, snowball — write under the constraint, see how Oulipo used it.",
      "desc": "Pick an Oulipo writing constraint — lipogram (no letter E), N+7 (replace nouns with the 7th word after them in a dictionary), snowball — and get a prompt to write under it, with examples from Oulipo authors."
    },
    {
      "num": "02",
      "slug": "aleatoric-writing-tool",
      "author": "edu",
      "live": true,
      "title": "Chance Workshop",
      "tagline": "Random word, dice roll, newspaper cut-up — how chance shapes authorship.",
      "desc": "Pick a chance-based text generation rule — random word insertion, dice-roll decisions, newspaper cut-up — and produce a piece of constrained writing, exploring how aleatory methods challenge authorial control."
    },
    {
      "num": "03",
      "slug": "language-model-authorship-quiz",
      "author": "edu",
      "live": true,
      "title": "Authorship Codex",
      "tagline": "Human-written, human-assisted, or AI-generated? What does the distinction mean for authorship?",
      "desc": "Read excerpts and decide: human-written, human-assisted, or AI-generated? Then explore what the distinction actually means — for authorship, creativity, intent, and the history of experimental writing that preceded AI."
    },
    {
      "num": "04",
      "slug": "generative-text-workshop",
      "author": "edu",
      "live": true,
      "title": "Procedural Workshop",
      "tagline": "Describe a pattern. Apply it. See how constraints produce unexpected writing.",
      "desc": "Describe a text generation pattern — every third word is a color, each sentence begins where the last one ended — and the app helps you apply it to produce a short experimental piece."
    },
    {
      "num": "05",
      "slug": "divinatory-language-explorer",
      "author": "edu",
      "live": true,
      "title": "Sigil And Sign",
      "tagline": "Tarot, I Ching, runes — how divinatory systems create meaning.",
      "desc": "Pick a divinatory system and trace how its language creates meaning — the semantic space it constructs, the interpretive tradition that develops around it, and the role of the reader in completing the meaning."
    }
  ]
}
```

**h1 text:** `Algorithmic &amp;<br>Experimental Writing`

**syllabi.hbs CLUSTER_MAP entry:**

```js
{
  label: "Algorithmic Writing",
  url: "algorithmic-creative-writing.html",
  matches: ["Unfinished Sentence", "Computational Exploration of Magical"]
}
```

---

## Execution steps

```bash
# 1. Create all 10 .hbs files using the frontmatter data above
#    and the HTML body copied verbatim from src/pages/edu/literary-analysis.hbs
#    (only the h1 text changes per page)

# 2. Add page_url to each cluster JSON
#    (same field added to literary-analysis.json, cold-war-history.json, critical-algorithms-surveillance.json)

# 3. Update edu/index.hbs: for each of the 10 coming-soon cluster cards:
#    - change class="cluster-card cluster-card--soon" to class="cluster-card"
#    - add href="<slug>.html" to the <div class="cluster-card"> → <a class="cluster-card" href="...">
#    - replace <div class="cc-soon">Coming soon</div> with <div class="cc-cta">5 tools →</div><div class="cc-count"><institutions></div>
#    - add cc-vocab chips (pick 3-4 from the vocab array)

# 4. Update syllabi.hbs: add all 10 CLUSTER_MAP entries from above into the CLUSTERS array

# 5. pnpm check — confirm all 10 new pages build without error

# 6. Add OG screenshots for each new page:
#    - Add each slug to screenshot-pages.js SLUGS array: "edu/slavery-civil-rights", etc.
#    - node screenshot-pages.js
#    - Add ogImage frontmatter to each .hbs

# 7. Commit
#    - pnpm check (again after ogImage additions)
#    - git add src/pages/edu/*.hbs research-humanities/clusters/*.json images/screenshots/edu/*.jpg screenshot-pages.js
#    - git commit
```

## Notes

- All 50 apps (`--user-slug edu`) are already deployed and will resolve immediately in screenshots.
- The CSS block is identical across all cluster pages — copy it verbatim, don't re-author per-page.
- The only per-page variation in the HTML body is the `h1` text (check the h1 note for each cluster above).
- After all 10 are built, the `edu/index.hbs` "coming soon" cards should all be replaced with live links.
