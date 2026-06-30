// Static export of the quick suggestions data
// This avoids issues with YAML parsing in test environments

export interface Suggestion {
  label: string;
  text: string;
}

export const quickSuggestions: Suggestion[] = [
  {
    label: "Order Form",
    text: "Create an order form for my small business where customers pick items, add quantities, see a running total, and check out — collect their name, contact, and pickup or delivery choice. Show me a live dashboard of incoming orders with status (new, prepping, ready, done) that everyone behind the counter can update together.",
  },
  {
    label: "Daily Specials",
    text: "Create a daily-specials board for a food truck or cafe: I post today's menu with prices, customers tap to place an order, and the kitchen sees a shared prep queue that updates live. Let me reuse yesterday's menu as a starting point and mark items sold out.",
  },
  {
    label: "Kill the Spreadsheet",
    text: "Turn the shared spreadsheet my team fights over into a real app: a simple form to add rows, the fields we actually use, filters and search, and a dashboard with the totals and counts up top. One source of truth, and let me control who can edit versus just view.",
  },
  {
    label: "Booking & Intake",
    text: "Create a booking and intake app for my service business where clients pick an available time slot, fill out an intake form with the details I need, and get a confirmation. Show me a calendar of upcoming appointments and a list of intake responses I can mark as contacted or done.",
  },
  {
    label: "Inventory Count",
    text: "Create a phone-friendly inventory counter where I add products with a current count and a low-stock threshold, tap plus/minus to adjust on the floor, and see a dashboard that flags anything running low. Let me share it with staff so we count together and it stays in sync.",
  },
  {
    label: "Client Portal",
    text: "Create a customer portal where each of my clients gets their own private page showing their order or job status, files, and updates — and I see an admin view of everyone. I decide exactly who can open which page; clients only see their own.",
  },
  {
    label: "Invoice Sender",
    text: "Create an invoice-tracking app for my business: I add a client and line items, it totals the amount with tax, and drafts a clean invoice I can share by link. I mark each invoice paid or unpaid, and get a dashboard of what's outstanding.",
  },
  {
    label: "Lead Pipeline",
    text: "Create a simple CRM where I track leads through stages — new, contacted, quoted, won, lost. Each lead has a name, contact info, value, and notes. Show me a pipeline board I can drag cards across and a dashboard with totals per stage. Let me share read-only access with a teammate.",
  },
  {
    label: "Online Storefront",
    text: "Create a small online storefront where I list products with photos, prices, and stock, customers add to a cart and place an order with their details, and I see incoming orders with a status I can update. Let me mark items sold out and feature a few on the front page.",
  },
  {
    label: "Staff Scheduler",
    text: "Create a staff scheduling app where I lay out shifts across the week, assign people to them, and staff can see their own schedule and request swaps. Flag conflicts and unfilled shifts, and show a weekly grid everyone shares.",
  },
  {
    label: "Time Clock",
    text: "Create a time clock where staff tap to clock in and out from their phones, breaks included, and I get a dashboard of hours per person per week. Let me correct entries and export the totals.",
  },
  {
    label: "Sales Dashboard",
    text: "Create a sales dashboard where I enter or paste daily numbers — revenue, transactions, top items — and it charts trends over time with week-over-week and month-over-month comparisons. Highlight my best and worst days and let me filter by date range.",
  },
  {
    label: "Work Orders",
    text: "Create a work-order app for my field crew: I create a job with customer, address, task, and priority, assign it to a tech, and they update status and add photos from their phone. Show me a dispatch board of everything open, in progress, and done.",
  },
  {
    label: "Loyalty Card",
    text: "Create a digital loyalty card where customers collect a stamp each visit and earn a reward at ten, all from a link on their phone — no app to install. I get a dashboard of active members and redemptions, and can run a double-stamp day.",
  },
  {
    label: "Table Waitlist",
    text: "Create a restaurant waitlist app where the host adds a party with size and phone, sees the live queue with wait estimates, and marks them seated. Guests get a link to check their place in line. Show turnover stats for the night.",
  },
  {
    label: "Expense Tracker",
    text: "Create a business expense tracker where I log expenses with amount, category, vendor, and a photo of the receipt, and see a dashboard of spend by category and month. Let me flag tax-deductible items and export a summary for my accountant.",
  },
  {
    label: "Tip Split",
    text: "Create a tip-pooling app where I enter the shift's total tips and each person's hours, and it splits the pool fairly and shows everyone their cut. Keep a history by date and let staff see their own totals over time.",
  },
  {
    label: "Membership Tracker",
    text: "Create a membership tracker for my gym or club: members with plan type, start date, and renewal date, flagged when they're about to lapse. Show me a dashboard of active, expiring, and churned members, and let members check their own status by link.",
  },
  {
    label: "Class Signups",
    text: "Create a class booking app for my studio where I post classes with date, time, and capacity, clients reserve a spot and join a waitlist when full, and I see the roster for each session. Let clients cancel, which opens their spot for the waitlist.",
  },
  {
    label: "Supplier Orders",
    text: "Create a purchasing app where I track orders to suppliers — what I ordered, quantity, cost, expected date, and received status. Show me what's outstanding and overdue, and total spend per supplier. Let me reorder a past order in one tap.",
  },
  {
    label: "Feedback Collector",
    text: "Create a customer feedback app where I share a link after a purchase, customers leave a star rating and a comment, and I see a dashboard of average rating over time with the latest reviews. Let me feature the best ones on a public page.",
  },
  {
    label: "Fundraiser Tracker",
    text: "Create a fundraiser tracker for my nonprofit or team where supporters pledge or donate, a goal thermometer fills toward the target, and recent contributions show on a public page. I get an admin view of every donor and the running total.",
  },
  {
    label: "Character Bot",
    text: "Create a chat app where I design a character — name, personality, and speaking style — then have a conversation with them. Let me edit the character's style anytime, keep my drafts private, and publish the ones I like to a public gallery others can chat with.",
  },
  {
    label: "Pitch Deck",
    text: "Interview me about my company, the problem I'm solving, my market size, team, traction, and funding ask, then use createVibe to open a pitch deck app with my slides already written — problem, solution, market, team, traction, and ask all pre-populated with my actual content, ready to present and refine.",
  },
  {
    label: "Speech Writer",
    text: "Interview me about the occasion, who I'm speaking about, my relationship to them, and a few key memories or things I want to say, then use createVibe to open a speech app with my full draft already written — introduction, stories, and closing already shaped around what I told you.",
  },
  {
    label: "Cover Letter",
    text: "Ask me to paste the job description, then interview me about my relevant experience and what I most want to highlight, then use createVibe to open a cover letter app with a tailored draft already written for that specific role — ready to edit and send.",
  },
  {
    label: "Lesson Plan",
    text: "Interview me about the subject, age group, learning objectives, and how long the lesson runs, then use createVibe to open a lesson plan app with the full plan already structured — objectives, activities, materials, and assessment built around my topic.",
  },
  {
    label: "Brand Kit",
    text: "Interview me about my company name, what it does, who it's for, the tone I want, and a few visual preferences, then use createVibe to open a brand guidelines app with colors, fonts, voice, and a mission statement already drafted for my brand.",
  },
  {
    label: "Podcast Script",
    text: "Interview me about my episode topic, who the guest is, what I want to cover, and how long the episode runs, then use createVibe to open a script app with my episode already structured — intro, talking points, questions, and outro written and ready to edit.",
  },
  {
    label: "Neighborhood Map",
    text: "Create a community resource map where anyone can add local resources (food banks, shelters, free wifi) with name, address, hours, and category — everyone's contributions show up in a shared, filterable list the whole neighborhood can browse.",
  },
  {
    label: "Workout Log",
    text: "Create a workout tracker where I log exercises, sets, reps, and weight each session, see my progress over time, and can share my routine for others to copy.",
  },
  {
    label: "Chord Maker",
    text: "Create a chord progression generator for songwriting — pick a key and mood, hear it play back with the Web Audio API, tweak each chord, and save the progressions you like.",
  },
  {
    label: "Event Tracker",
    text: "Create a festival schedule app where a group builds a shared lineup of acts with stage and time, and each person stars their own favorites. Include a text area to paste and parse any schedule.",
  },
  {
    label: "Dream Job",
    text: "Take my photo with the camera, ask me my dream job, then generate a fun caricature of me doing that job. Post it to a public gallery so everyone can see each other's dream jobs.",
  },
  {
    label: "History Quest",
    text: "Create a history RPG where the AI writes a short scene set in a real era, then gives you 3 choices. Each choice leads to a new scene. Track your score on a public leaderboard.",
  },
  {
    label: "Jam Session",
    text: "Create a drum machine with tempo control, 8 pattern slots, and a step sequencer grid. Use createOscillator for hi-hats, kicks, and snares.",
  },
  {
    label: "Brain Dump",
    text: "Create a task tracker with freeform textarea entry that sends the text to AI to create task list items using json, tags them into the selected list, and lets you keep a list private or invite someone to share it.",
  },
  {
    label: "Photo Wall",
    text: "Shared photo wall where anyone can drop in images that auto-save, analyze, tag, and describe themselves, appearing in a masonry grid everyone can browse as the tags and descriptions come back.",
  },
  {
    label: "Legends Chat",
    text: "Chat with historical legends — pick a figure and have a conversation. Results are streamed live.",
  },
  {
    label: "DJ Playlist",
    text: "Describe your mood and AI curates the perfect playlist with YouTube search links for each track.",
  },
  {
    label: "Money Moves",
    text: "Interview me about my loans, income, savings rate, and retirement goals, then use createVibe to open a personal finance app with my numbers already loaded — payoff curves, compound interest projections, and retirement timeline built around my actual situation.",
  },
  {
    label: "Emoji Chef",
    text: "AI recipe generator that uses emoji for ingredients. An AI food critic tastes your creations and roasts them with scores.",
  },
  {
    label: "Meet Up",
    text: "Create a shared availability poll — invite people to mark when they're free and AI instantly finds the best overlapping time to meet.",
  },
  {
    label: "Focus Timer",
    text: "Pomodoro timer with multiple concurrent timers, work/break intervals, and session stats. Persists across page refreshes.",
  },
  {
    label: "Loop Machine",
    text: "Music loop composition tool with an 8-step sequencer using createOscillator, with distinct tones per instrument track.",
  },
  {
    label: "Trivia Night",
    text: "Game show trivia — pick any topic, AI generates questions and judges your answers. Styled like a retro board game.",
  },
  {
    label: "Brick Breaker",
    text: "Full-screen paddle-and-ball game with sound effects via createOscillator. Break bricks, grab power-ups, survive the speed-up.",
  },
  {
    label: "Memory Match",
    text: "Flip-and-match card game with custom images and satisfying sound effects on every pair.",
  },
  {
    label: "Flash Study",
    text: "Flashcard app — pick any topic and AI generates a study deck you can flip through and shuffle.",
  },
  {
    label: "Guitar",
    text: "Hendrix-style guitar solo machine using Web Audio API — sawtooth oscillators, wah-wah filter sweeps, feedback distortion, whammy bar dives, and pentatonic shredding with human-like timing. Crank the gain and let it rip.",
  },
  {
    label: "Wildcard",
    text: "Ask me one unexpected question, then use createVibe to open an app I didn't know I wanted — something genuinely surprising based on my answer.",
  },
];

// Named exports for specific prompts used in the create page
export const partyPlannerPrompt =
  "Create a party planning app with a shared guest list where invitees RSVP themselves, plus collaborative budget tracking.";
export const progressTrackerPrompt = "Create a random app idea and build it automatically.";
export const eventTrackerPrompt =
  "Create a festival schedule app where a group builds a shared lineup of acts with stage and time, and each person stars their own favorites. Include a text area to paste and parse any schedule.";
export const historyQuestPrompt =
  "Create a history RPG where the AI writes a short scene set in a real era, then gives you 3 choices. Each choice leads to a new scene. Track your score on a public leaderboard.";
export const jamSessionPrompt =
  "Create a drum machine with tempo control, 8 pattern slots, and a step sequencer grid. Use createOscillator for hi-hats, kicks, and snares.";
