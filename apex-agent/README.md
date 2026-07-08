# Apex — AI Revenue Orchestrator

Apex is an autonomous AI revenue orchestrator: it observes the whole pipeline, scores every lead, executes the highest-value actions through virtual specialist agents, keeps the CRM complete, and reports back like a head of sales. Built with Next.js (App Router), TypeScript, and Tailwind CSS.

## What it does

- **Marketing homepage** — premium enterprise landing at `/` positioning Apex as an autonomous AI revenue employee: hero with live Command Center preview, problem/solution narrative, autonomous engine, full AI agent roster, Command Center recommendation card, comparison vs traditional sales, trust section, and CTAs into the platform.
- **Command Center** — run a full orchestration cycle (observe → analyze → plan → execute → learn). Apex re-scores every active lead (ICP fit, buying intent, urgency, relationship strength, expected revenue, priority), executes the top actions via specialist agents (Outreach, Qualification, Meeting Scheduling, Research, Analytics…), applies CRM updates, and produces an 8-section report: executive summary, highest-priority opportunities, actions completed, actions in progress, risks, recommended next actions, CRM changes, and confidence assessment. Cycle history is kept.
- **Deep research** — on any lead, the Research Intelligence Agent builds a full pre-outreach profile: company overview, business health, technology stack (with confidence per finding), buying signals (with strength and why they matter), pain points separated into confirmed / likely / unknown, opportunity assessment, decision-maker map, competitive landscape, personalization opportunities, an explained qualification scorecard (ICP fit, buying intent, growth, tech match, urgency, strategic value, priority), and a recommended strategy (angles, discovery questions, first channel, CTA, expected objections, follow-up cadence). Unverifiable data is explicitly marked Unknown, with research gaps listed.
- **Strategic account planning** — the Planning Agent turns research into the strategy every downstream agent follows: executive assessment with priority classification, ranked opportunity analysis, stakeholder strategy with engagement order and decision-influence scores, sales strategy (value props, business case, ROI narrative, proof points), a grouped 10–20 question discovery plan, objection forecast with probability/severity/response, engagement strategy (contact order, agenda, cadence, escalation path), competitive strategy, an 8-area risk assessment with mitigations, and a success plan (deal probability, cycle length, contract value, top three win-probability actions). Verified facts are explicitly separated from inferred recommendations.
- **Outreach intelligence** — the Outreach Agent converts the account plan into ready-to-send communication: a go/no-go decision (with the reason to wait if outreach shouldn't happen yet), channel strategy, a personalized 5-touch multi-channel sequence (each touch with day, channel, objective, message, CTA, success condition, and fallback), follow-up logic for nine reply scenarios, objection responses that acknowledge/educate/reduce risk/advance, a meeting plan, quality scores (personalization, relevance, business value, clarity, trust, reply likelihood — all held to the 85+ bar), and A/B variants of the opener with a testing hypothesis. Personalization only ever uses verified signals and recorded pain points — never fabricated observations.
- **Reply intelligence** — paste any inbound prospect reply and the Reply Agent runs the full 10-step analysis: multi-label intent classification with confidence (25 intent categories), sentiment and engagement scoring, opportunity re-assessment with explained score deltas, conversation analysis (questions, concerns, stakeholders, deadlines, commitments), objection analysis (surface vs. real objection, hidden concern, root cause), a single recommended next action, a drafted response that answers what was asked with exactly one CTA, CRM updates (applied automatically, changed fields only), learnings (assumptions confirmed/incorrect, strategy changes), and automatic escalation to human approval for legal, security, procurement, pricing-approval, and executive scenarios. Unsubscribes are honored immediately.
- **Meeting intelligence** — before a meeting, generate a full prep pack: intelligence brief (situation, signals, pains, objections, competitive picture, deal probability), attendee-by-attendee analysis with recommended approach, meeting objectives (desired vs. minimum acceptable outcome), meeting strategy (opening, discovery approach, proof points, topics to avoid), discovery questions across 11 categories, and objection preparation. After the meeting, paste your notes to get a debrief extracted strictly from what was recorded (pains, goals, budget, timeline, stakeholders, commitments — never invented), a qualification update with explained deltas, a follow-up email referencing specific conversation points, CRM updates, a 7-dimension meeting quality analysis with improvement recommendations, and escalation flags for legal/procurement/security/pricing/executive scenarios.
- **CRM Health** — the CRM Intelligence Agent is the memory system of the revenue organization: it audits every record against 14 completeness checks, detects contradictions (status mismatches, impossible follow-ups, unscored active deals), flags stale records and overdue follow-ups, surfaces pipeline risks (stalled and single-threaded deals), detects possible duplicates by company name / domain / email with a confidence score (recommend-merge only — never auto-delete), applies only evidence-based corrections (logged with their justification), builds structured customer memory (goals, pains, preferences, stakeholders, timeline) and sales memory (what worked, what failed, objections seen, competitive intel, buying patterns), notifies other agents when they need to act (missing research, plan built on stale research, plan without playbook, meeting without debrief), and reports five explained health scores: completeness, accuracy, opportunity hygiene, pipeline confidence, and overall CRM health. Audit history is kept.
- **Revenue Intelligence** — the Analytics Agent operates like a VP of Sales: set a revenue target and it forecasts against it (pipeline value, weighted pipeline, expected revenue, best/worst case, revenue gap, probability of hitting target, time to close — with every assumption listed), scores seven pipeline-health dimensions with explanations (coverage, quality, velocity, opportunity health, forecast reliability, activity health, overall), detects bottlenecks with evidence/impact/solution/priority, analyzes the funnel stage by stage to find the biggest revenue leak, measures sales velocity (fast/slow/stalled deals with stage timings), surfaces hidden opportunities (high-fit accounts with no outreach, strong signals at early stages, engagement momentum, competitor-risk deals, reactivation candidates), grades team performance from activity data, ranks strategic recommendations by expected value (with revenue opportunity, effort, urgency, confidence), and models what-if scenarios (more meetings, better reply rate, shorter cycle, more qualified leads) with the formula behind each estimate. Facts, calculations, and assumptions are always separated. Read-only: it analyzes and guides, never modifies records. Analysis history is kept.
- **Learning & Optimization** — the Learning Agent is the intelligence layer that makes every other agent better: it analyzes prospecting performance by industry, size, title, and region (conversion rates, priority scores, segment assessments), extracts outreach patterns behind positive replies, ignored messages, and objections, identifies effective value props / pain points / CTAs and themes to continue or stop, reviews every stage of the sales process with findings labeled Fact, Correlation, or Hypothesis, scores all seven Apex agents (Research, Planning, Outreach, Reply, Meeting, Analytics, CRM) with metrics and improvement areas, proposes controlled experiments with hypothesis / success metric / decision rule, maintains organizational memory (winning patterns, losing patterns, market intelligence), ranks optimization recommendations by expected ROI, and produces an executive learning report (what improved, what declined, what to test next, expected revenue impact). Read-only — it never modifies CRM or sends outreach. Learning history is kept.
- **Mission Control** — the COO layer that operates Apex as a continuously running revenue organization: one "Run Mission Control cycle" button runs observe → understand → create missions → assign agents → execute → measure. It collects signals from CRM, pipeline, agent reports, analytics, and learning; converts opportunities into prioritized missions (objective, reason, expected revenue impact, required agents, deadline, success criteria, risk, confidence); delegates execution to specialist agents (qualification, research, planning, outreach — up to 3 missions per cycle with multi-step progression); holds meeting-booking missions for human approval per autonomous decision rules; tracks mission lifecycle (created, assigned, running, completed, failed, blocked, waiting approval); and produces a daily autonomous briefing: revenue situation, missions created/active/completed/blocked, risks, human recommendations, and learning. Mission and briefing history are kept.
- **Prospect Intelligence** — the data acquisition and prospect intelligence layer: one "Run intelligence cycle" button runs discover → enrich → contact discovery → buying signal detection → ICP matching → opportunity scoring. It scans market catalogs and the live CRM against ICP criteria (industry, size, tech stack, hiring, funding); discovers new companies and contacts with source/confidence/timestamp on every data point; detects buying signals with strength and recommended actions; builds account intelligence profiles (overview, pains, decision makers, outreach angles); ranks top opportunities by ICP score, priority, deal size, and timing; flags duplicates for merge review (never auto-deletes); assesses data quality (completeness, accuracy, freshness); creates autonomous prospect missions for downstream agents; and reports market trends. Prospect universe and cycle history are kept. Read-only — discovers and enriches, never sends outreach.
- **Revenue Signals** — the real-time revenue signal engine and organizational nervous system: one "Run signal cycle" button continuously detects meaningful events from CRM, replies, meetings, analytics refreshes, and market intelligence; classifies signal type (growth, intent, contact, sales activity); scores urgency, revenue impact, and confidence into a priority score; generates high-priority alerts with action windows; creates opportunity candidates with evidence and estimated value; and automatically triggers downstream missions for high-value signals. It tracks trend shifts, signal quality, false positives, and timing patterns to improve future scoring. Signal history is kept.
- **Scheduler Runtime** — the autonomous heartbeat and worker runtime: one "Run scheduler cycle" triggers the multi-frequency operating system that runs 15-minute, hourly, daily, weekly, and event-driven jobs; queues worker tasks with statuses (queued, running, completed, failed, blocked, waiting approval); prevents duplicate/conflicting runs; applies retry logic and failure escalation; enforces approval gates for sensitive actions; and coordinates Revenue Signals, Prospect Intelligence, Mission Control, Execution, CRM Health, Analytics, Learning, and CRO cycles. Runtime history and worker task logs are kept.
- **Loop Controller** — the top-level autonomous operating loop that keeps Apex continuously alive: one "Run loop cycle" executes wake → observe → decide → activate → execute → verify across all major systems. It ingests CRM changes, signals, pipeline movement, execution outcomes, and runtime health; decides highest-impact next actions; triggers Scheduler Runtime and specialist systems in synchronized order; prevents duplicate loops; records completed and blocked work; carries forward approval requirements; and captures cycle learning patterns to improve future autonomous decisions. Loop history is kept.
- **Communication OS** — the communication infrastructure layer between Apex intelligence and external channels: one "Run communication cycle" validates context-aware message drafts, schedules/sends approved communications, tracks threads, detects replies, enforces stop conditions (reply, unsubscribe, wrong contact, negative response), updates conversation memory, and routes approval-required messages (executive, high-value, sensitive/commercial/legal contexts). It is provider-agnostic via adapter-style metadata and captures communication analytics (sent, replies, positive replies, meetings, conversion, channel/timing health). Communication history is kept.
- **Provider Adapter Layer** — the communication provider bridge with interchangeable adapters and fallback routing: one "Run provider cycle" executes provider manager logic over registered adapters (Mock, SMTP, IMAP, optional Google, optional Microsoft), enforces adapter interface methods (`send`, `receive`, `sync`, `status`), routes outbound delivery through available providers with fallback when one is unavailable, syncs inbound messages/replies, monitors connection/auth/rate-limit health, records retryable failures, and keeps provider configs and sync telemetry independent from communication intelligence logic.
- **Memory Graph Engine** — the long-term memory and knowledge graph layer: one "Run memory cycle" captures and updates customer/contact/conversation/action/outcome memories with source, timestamp, confidence, importance, and expiration; preserves historical intelligence; builds relationships (company→people, action→outcome, strategy→result); generates pattern insights from outcomes and learning artifacts; and serves retrieval bundles for pre-action context (outreach, meeting, strategy). Memory graph history is kept.
- **Execution Engine** — the action layer that converts decisions into completed outcomes: one "Run execution cycle" button runs receive → validate → execute → verify. It ingests work from Mission Control, Revenue Orchestrator, CRO, Analytics, and the live pipeline; creates trackable tasks (email, calendar, CRM, research, outreach, qualification, follow-up, prospect discovery); validates each action for sufficient information, approval requirements, and safety gates; executes up to 5 approved tasks per cycle with real agent delegation (qualification runs, research profiles, account plans, outreach playbooks, CRM updates with audit logs); holds sensitive emails and all calendar bookings for human approval; tracks task lifecycle (pending, running, completed, failed, blocked, needs approval); reports automation health, scheduled jobs, revenue impact, and execution learning. Task and cycle history are kept.
- **Revenue Employee OS** — Apex as an autonomous AI revenue employee: one "Run workday cycle" button runs the full observe → think → plan → execute loop without waiting for instructions. It observes CRM, conversations, buying signals, agent artifacts, and learning memory; thinks about the highest expected revenue impact action; plans tasks with agent, priority, confidence, and risk; and actually executes by delegating to specialist agents (qualification, research, account planning, outreach — up to 4 high-value tasks per cycle with real CRM updates and artifact creation). Each workday produces a revenue brief, opportunity discovery (pipeline accounts with strong signals + market-scan ICP matches with ranked buying signals and message angles), completed work log, pipeline impact, memory snapshot, learning updates, and risks. Prospect discovery mode flags unworked high-signal accounts and demo market opportunities. Workday history is kept.
- **CRO Command** — the Chief Revenue Officer is the executive intelligence layer: set a revenue target and run an executive review that synthesizes every agent (Orchestrator, Research, Planning, Outreach, Reply, Meeting, CRM, Analytics, Learning), runs the observe → diagnose → prioritize → direct loop, reports revenue status and forecast confidence, diagnoses revenue gaps / pipeline / conversion / process / agent inefficiencies, ranks priority directives by impact and urgency with responsible agents, directs pipeline focus (which accounts matter, which need intervention, which to nurture), manages all nine agents with behavior-change instructions and an Orchestrator directive, allocates resources (more research, outreach, follow-up, meetings; less effort on low-value leads), makes strategic decisions with evidence and timeframe, produces a weekly operating review (wins, problems, next-week priorities), and flags emergencies (forecast collapse, pipeline shortage, deal risk, data integrity). Read-only — commands and directs, never executes sales tasks. Review history is kept.
- **Pipeline dashboard** — all leads sorted by priority score, with status, next action, and follow-ups due.
- **Autonomous agent runs** — for any lead, Apex produces a lead summary, fit / intent / priority scores, estimated deal size, close probability, a recommended next action with justification, a ready-to-send personalized outreach message, a time-bound follow-up plan, and a complete CRM update (applied automatically).
- **Objection handling** — give Apex an instruction like "they said the price is too high" and it responds accordingly.
- **CRM discipline** — every run updates status, pain points, goals, decision makers, timeline, competitors, notes, and follow-up date. Full activity timeline per lead.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the marketing homepage, or [http://localhost:3000/pipeline](http://localhost:3000/pipeline) to jump straight into the app. The app ships with three seeded example leads so you can try it immediately.

## Connecting a real LLM (optional)

Without an API key, Apex runs in **demo mode**: a deterministic engine that scores leads from their actual data (buying signals, funding, seniority, engagement) and drafts outreach from templates.

To use OpenAI instead, copy `.env.example` to `.env.local` and set your key:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini   # optional
```

The system prompts live in `src/lib/orchestrator-prompt.ts` (Revenue Orchestrator — full pipeline cycles), `src/lib/research-prompt.ts` (Research Intelligence Agent — deep account profiles), `src/lib/planning-prompt.ts` (Strategic Account Planning Agent — account plans), `src/lib/outreach-prompt.ts` (Outreach Intelligence Agent — sequences and messaging), `src/lib/reply-prompt.ts` (Reply Intelligence Agent — inbound reply handling), `src/lib/meeting-prompt.ts` (Meeting Intelligence Agent — prep and debrief), `src/lib/crm-prompt.ts` (CRM Intelligence Agent — data quality audits), `src/lib/analytics-prompt.ts` (Pipeline Analytics & Revenue Intelligence Agent — forecasting and health), `src/lib/learning-prompt.ts` (Learning & Optimization Agent — continuous improvement), `src/lib/cro-prompt.ts` (Chief Revenue Officer — executive direction), `src/lib/employee-os-prompt.ts` (Autonomous Revenue Employee OS — continuous workday loop), `src/lib/mission-control-prompt.ts` (Autonomous Mission Control — COO mission orchestration), `src/lib/execution-engine-prompt.ts` (Autonomous Execution Engine — action layer), `src/lib/prospect-intelligence-prompt.ts` (Data Acquisition & Prospect Intelligence), `src/lib/revenue-signal-prompt.ts` (Real-Time Revenue Signal Engine), `src/lib/scheduler-runtime-prompt.ts` (Autonomous Scheduler & Worker Runtime), `src/lib/loop-controller-prompt.ts` (Autonomous Loop Controller), `src/lib/communication-os-prompt.ts` (Communication Operating System), `src/lib/provider-adapter-prompt.ts` (Communication Provider Adapter Layer), `src/lib/memory-graph-prompt.ts` (Memory & Knowledge Graph Engine), and `src/lib/system-prompt.ts` (per-lead SDR runs).

## Data

Leads are stored in `data/leads.json`, cycle reports in `data/reports.json`, research profiles in `data/research.json`, account plans in `data/plans.json`, outreach playbooks in `data/outreach.json`, reply analyses in `data/replies.json`, meeting reports in `data/meetings.json`, CRM audits in `data/crm-audits.json`, revenue analyses in `data/analytics.json`, learning reports in `data/learning.json`, CRO reviews in `data/cro-reviews.json`, workday reports in `data/employee-os.json`, missions in `data/missions.json`, mission control briefings in `data/mission-control.json`, execution tasks in `data/execution-tasks.json`, execution cycle reports in `data/execution-engine.json`, prospect universe in `data/prospect-universe.json`, prospect intelligence reports in `data/prospect-intelligence.json`, revenue signal reports in `data/revenue-signals.json`, scheduler runtime reports in `data/scheduler-runtime.json`, worker runtime tasks in `data/worker-runtime-tasks.json`, loop controller reports in `data/autonomous-loop.json`, communication OS reports in `data/communication-os.json`, communication messages in `data/communications.json`, conversation memory in `data/conversation-memory.json`, provider adapter reports in `data/provider-adapter.json`, provider configs in `data/provider-configs.json`, memory graph reports in `data/memory-graph.json`, memories in `data/memories.json`, and relationships in `data/knowledge-graph.json` (created on first run; leads are seeded with examples). Delete the files to reset.

## Structure

```
src/
  lib/
    orchestrator-prompt.ts  # Revenue Orchestrator system prompt
    orchestrator.ts         # Full-pipeline cycle engine (OpenAI + demo)
    research-prompt.ts      # Research Intelligence Agent system prompt
    research.ts             # Deep research engine (OpenAI + demo)
    planning-prompt.ts      # Strategic Account Planning Agent system prompt
    planning.ts             # Account planning engine (OpenAI + demo)
    outreach-prompt.ts      # Outreach Intelligence Agent system prompt
    outreach.ts             # Outreach playbook engine (OpenAI + demo)
    reply-prompt.ts         # Reply Intelligence Agent system prompt
    reply.ts                # Inbound reply analysis engine (OpenAI + demo)
    meeting-prompt.ts       # Meeting Intelligence Agent system prompt
    meeting.ts              # Meeting prep + debrief engine (OpenAI + demo)
    crm-prompt.ts           # CRM Intelligence Agent system prompt
    crm-audit.ts            # CRM data quality audit engine (OpenAI + demo)
    analytics-prompt.ts     # Revenue Intelligence Agent system prompt
    analytics.ts            # Forecasting + pipeline analytics engine (OpenAI + demo)
    learning-prompt.ts      # Learning & Optimization Agent system prompt
    learning.ts             # Continuous improvement engine (OpenAI + demo)
    cro-prompt.ts           # Chief Revenue Officer system prompt
    cro.ts                  # Executive review engine (OpenAI + demo)
    employee-os-prompt.ts   # Autonomous Revenue Employee OS prompt
    employee-os.ts          # Observe/think/plan/execute engine with real delegation
    mission-control-prompt.ts # Autonomous Mission Control COO prompt
    mission-control.ts      # Mission observe/create/execute engine (OpenAI + demo)
    mission-store.ts        # Persistent mission registry
    mission-control-store.ts # Mission Control briefing history
    execution-engine-prompt.ts # Autonomous Execution Engine prompt
    execution-engine.ts      # Receive/validate/execute/verify engine (OpenAI + demo)
    execution-task-store.ts  # Persistent execution task registry
    execution-engine-store.ts # Execution cycle report history
    prospect-intelligence-prompt.ts # Data acquisition & prospect intelligence prompt
    prospect-intelligence.ts  # Discover/enrich/score engine (OpenAI + demo)
    prospect-universe-store.ts # Persistent prospect universe
    prospect-intelligence-store.ts # Intelligence cycle report history
    revenue-signal-prompt.ts # Real-time revenue signal engine prompt
    revenue-signal.ts        # Signal detection/scoring/trigger engine (OpenAI + demo)
    revenue-signal-store.ts  # Revenue signal report history
    scheduler-runtime-prompt.ts # Autonomous scheduler and worker runtime prompt
    scheduler-runtime.ts     # Continuous scheduler + worker coordination engine
    scheduler-runtime-store.ts # Runtime report + worker task history
    loop-controller-prompt.ts # Autonomous loop controller prompt
    loop-controller.ts       # Top-level wake/observe/decide/act loop controller
    loop-controller-store.ts # Loop controller report history
    communication-os-prompt.ts # Communication operating system prompt
    communication-os.ts      # Multi-channel communication orchestration engine
    communication-os-store.ts # Communication reports/messages/conversation memory
    provider-adapter-prompt.ts # Communication provider adapter layer prompt
    provider-adapter.ts      # Provider manager + adapters + fallback + sync engine
    provider-adapter-store.ts # Provider reports and provider configuration
    memory-graph-prompt.ts   # Memory and knowledge graph engine prompt
    memory-graph.ts          # Long-term memory capture/retrieval/learning engine
    memory-graph-store.ts    # Memory graph, memory items, relationship persistence
    system-prompt.ts        # Per-lead Apex SDR system prompt
    agent.ts                # Per-lead agent engine (OpenAI + demo)
    store.ts                # File-based lead store
    report-store.ts         # Cycle report history
    research-store.ts       # Research profiles per lead
    plan-store.ts           # Account plans per lead
    outreach-store.ts       # Outreach playbooks per lead
    reply-store.ts          # Reply analyses per lead
    meeting-store.ts        # Meeting reports per lead
    crm-audit-store.ts      # CRM audit history
    analytics-store.ts      # Revenue analysis history
    learning-store.ts       # Learning cycle history
    cro-store.ts            # CRO executive review history
    employee-os-store.ts    # Revenue OS workday history
    types.ts                # Lead / CRM / report types
    seed.ts                 # Example leads
  app/
    (marketing)/            # Premium enterprise homepage at /
    (platform)/             # App shell: pipeline, agents, command center
      pipeline/             # Pipeline dashboard
      command-center/       # Orchestrator
      os/                   # Revenue Employee OS
      mission-control/      # Autonomous Mission Control COO
      execution/            # Autonomous Execution Engine
      prospect-intelligence/ # Data acquisition & prospect intelligence
      revenue-signals/      # Real-time revenue signal radar
      runtime/              # Autonomous scheduler and worker runtime
      loop/                 # Autonomous loop controller
      communication/        # Communication operating system
      providers/            # Communication provider adapter layer
      memory/               # Memory and knowledge graph dashboard
      cro/                  # CRO Command
      crm-health/           # CRM Intelligence
      analytics/            # Revenue Intelligence
      learning/             # Learning & Optimization
      leads/                # Lead detail + new lead
    api/                    # Agent and data API routes
  components/               # Badges, panels, homepage hero dashboard
```
