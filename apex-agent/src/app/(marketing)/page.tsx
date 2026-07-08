import Link from "next/link";
import { HeroDashboard } from "@/components/homepage/hero-dashboard";

const AGENTS = [
  { name: "Revenue Orchestrator", role: "Coordinates the full pipeline operating loop" },
  { name: "Research Intelligence", role: "Deep account and decision-maker profiles" },
  { name: "Account Planning", role: "Winning strategies per opportunity" },
  { name: "Outreach Intelligence", role: "Personalized multi-channel sequences" },
  { name: "Reply Intelligence", role: "Inbound conversation management" },
  { name: "Meeting Intelligence", role: "Prep, debrief, and advancement" },
  { name: "CRM Intelligence", role: "Data quality and memory" },
  { name: "Revenue Analytics", role: "Forecasting and pipeline health" },
  { name: "Learning & Optimization", role: "Continuous improvement from outcomes" },
];

const PROBLEMS = [
  "Manual prospect research",
  "Generic outreach",
  "Missed opportunities",
  "Poor CRM data",
  "Slow follow-ups",
  "Lack of sales intelligence",
];

const STEPS = [
  {
    title: "Discover",
    body: "ApexGrowth finds companies matching your ideal customer profile — continuously, without waiting for leads to arrive.",
  },
  {
    title: "Research",
    body: "ApexGrowth understands businesses, buying signals, technology stacks, and decision makers before anyone reaches out.",
  },
  {
    title: "Strategize",
    body: "ApexGrowth creates account plans and winning approaches tailored to each opportunity's stakeholders and timing.",
  },
  {
    title: "Engage",
    body: "ApexGrowth runs personalized multi-channel outreach anchored on verified signals — not templates.",
  },
  {
    title: "Convert",
    body: "ApexGrowth handles replies, prepares meetings, advances pipeline stages, and keeps CRM accurate.",
  },
  {
    title: "Learn",
    body: "ApexGrowth improves from every interaction — messaging, targeting, and process refine automatically.",
  },
];

const TRADITIONAL = [
  "Hours researching manually",
  "Manual follow-ups that slip",
  "Generic messages at scale",
  "Disconnected tools and data",
  "Limited pipeline visibility",
];

const APEX_WINS = [
  "Always researching",
  "Always prioritizing",
  "Always following up",
  "Always learning",
  "Always improving",
];

const TRUST = [
  { title: "Enterprise security", desc: "Your data stays in your environment. No training on customer records without consent." },
  { title: "Human approval controls", desc: "Contracts, discounts, and sensitive commitments require explicit approval." },
  { title: "Transparent reasoning", desc: "Every recommendation includes evidence, assumptions, and confidence levels." },
  { title: "CRM ownership", desc: "ApexGrowth maintains your CRM as source of truth — never hides missing data." },
  { title: "Data accuracy", desc: "Verified information over assumptions. Facts separated from hypotheses." },
  { title: "Compliance-ready", desc: "Unsubscribes honored immediately. Outreach respects prospect preferences." },
];

const PRICING = [
  {
    name: "Starter",
    price: "$199",
    period: "/month",
    audience: "Solo founders and early-stage teams",
    highlights: [
      "Up to 500 leads tracked",
      "Core autonomous pipeline workflows",
      "Email support",
      "7-day free trial",
    ],
  },
  {
    name: "Growth",
    price: "$999",
    period: "/month",
    audience: "Revenue teams scaling outbound and inbound",
    highlights: [
      "Up to 5,000 leads tracked",
      "Mission Control, Execution, and Revenue Signals",
      "Priority support and onboarding",
      "Usage-based expansion available",
    ],
  },
  {
    name: "Pro / Agency",
    price: "$2,500+",
    period: "/month",
    audience: "Agencies and multi-brand GTM operators",
    highlights: [
      "Multi-workspace operations",
      "Advanced automation and provider adapters",
      "Dedicated success support",
      "Custom performance add-ons",
    ],
  },
];

export default function HomePage() {
  return (
    <div className="grid-bg">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="text-center lg:text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted mb-6 animate-fade-in">
                <span className="h-1.5 w-1.5 rounded-full bg-good" />
                Your AI Sales Team That Works 24/7
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold tracking-tight leading-[1.1] animate-fade-in">
                Meet ApexGrowth.
                <br />
                <span className="text-muted">Your Autonomous AI Revenue Employee.</span>
              </h1>
              <p className="mt-6 text-lg text-muted max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in">
                ApexGrowth finds your best prospects, researches accounts, creates personalized
                outreach, manages conversations, books meetings, and continuously
                improves your sales pipeline.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in">
                <Link
                  href="/os"
                  className="inline-flex items-center justify-center rounded-xl bg-accent px-6 py-3.5 text-sm font-medium text-white hover:opacity-90 transition shadow-lg shadow-accent/25"
                >
                  Start Building Pipeline
                </Link>
                <Link
                  href="/command-center"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium hover:bg-white/10 transition backdrop-blur"
                >
                  Watch ApexGrowth Work
                </Link>
              </div>
              <p className="mt-8 text-xs text-muted max-w-md mx-auto lg:mx-0">
                Not a chatbot. Not a CRM plugin. An autonomous revenue organization
                you deploy.
              </p>
            </div>
            <div className="animate-float">
              <HeroDashboard />
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Sales teams spend too much time searching, researching, and following up.
            </h2>
            <p className="mt-4 text-muted text-lg">
              ApexGrowth replaces fragmented sales workflows with one autonomous revenue system.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROBLEMS.map((p) => (
              <div
                key={p}
                className="rounded-xl border border-white/5 bg-surface/50 backdrop-blur px-5 py-4 text-sm text-muted"
              >
                <span className="text-bad mr-2">×</span>
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-white/5 py-24 bg-surface/30">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-medium uppercase tracking-widest text-accent mb-3">
            Autonomous engine
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight max-w-xl">
            How ApexGrowth works
          </h2>
          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className="group rounded-2xl border border-white/5 bg-background/50 p-6 hover:border-accent/30 transition duration-300"
              >
                <span className="text-xs font-mono text-muted">0{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold group-hover:text-accent transition">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Team */}
      <section id="agents" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Your AI sales team
          </h2>
          <p className="mt-4 text-muted text-lg max-w-2xl">
            Every specialist agent works together as one autonomous revenue organization.
          </p>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS.map((a) => (
              <div
                key={a.name}
                className="rounded-xl border border-white/5 bg-surface/40 backdrop-blur px-5 py-4 hover:bg-surface/70 transition"
              >
                <p className="font-medium text-sm">{a.name}</p>
                <p className="text-xs text-muted mt-1">{a.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Command Center Preview */}
      <section className="border-t border-white/5 py-24 bg-surface/30">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                Command Center
              </h2>
              <p className="mt-4 text-muted leading-relaxed">
                Pipeline dashboard, revenue forecast, agent activity, priority accounts,
                and AI recommendations — in one place.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-muted">
                <li className="flex gap-2">
                  <span className="text-accent">→</span> Real-time agent activity feed
                </li>
                <li className="flex gap-2">
                  <span className="text-accent">→</span> Weighted pipeline and forecast confidence
                </li>
                <li className="flex gap-2">
                  <span className="text-accent">→</span> Evidence-backed next actions
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-surface/80 backdrop-blur-xl p-6 shadow-xl">
              <p className="text-[10px] uppercase tracking-wider text-accent font-medium">
                Recommendation
              </p>
              <p className="mt-3 text-lg font-semibold">
                Contact NovaPay VP Sales today.
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                  <p className="text-xs text-muted uppercase tracking-wide">Reason</p>
                  <p className="mt-1">
                    Company hired 6 SDRs and is expanding outbound sales in Q3.
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                  <p className="text-xs text-muted uppercase tracking-wide">Expected impact</p>
                  <p className="mt-1 text-good font-medium">$120k pipeline opportunity</p>
                </div>
              </div>
              <Link
                href="/command-center"
                className="mt-6 inline-block text-sm text-accent hover:underline"
              >
                Open Command Center →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why ApexGrowth Wins */}
      <section className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
            Why ApexGrowth wins
          </h2>
          <div className="mt-14 grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-white/5 bg-surface/30 p-8">
              <p className="text-sm font-medium text-muted uppercase tracking-wide">
                Traditional sales team
              </p>
              <ul className="mt-6 space-y-3">
                {TRADITIONAL.map((t) => (
                  <li key={t} className="text-sm text-muted flex gap-2">
                    <span className="text-bad shrink-0">—</span> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-accent/20 bg-accent-soft/20 p-8">
              <p className="text-sm font-medium text-accent uppercase tracking-wide">
                ApexGrowth
              </p>
              <ul className="mt-6 space-y-3">
                {APEX_WINS.map((t) => (
                  <li key={t} className="text-sm flex gap-2">
                    <span className="text-good shrink-0">✓</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Autonomous Mode */}
      <section className="border-t border-white/5 py-24 bg-gradient-to-b from-accent/5 to-transparent">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Your sales team never sleeps.
          </h2>
          <p className="mt-4 text-muted text-lg max-w-2xl mx-auto">
            ApexGrowth continuously finds opportunities, monitors buying signals, updates
            intelligence, creates actions, and learns from outcomes — without waiting
            for instructions.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {[
              "Finds opportunities",
              "Monitors signals",
              "Updates intelligence",
              "Creates actions",
              "Learns from outcomes",
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-surface/50 px-4 py-2 text-sm text-muted backdrop-blur"
              >
                {item}
              </span>
            ))}
          </div>
          <Link
            href="/os"
            className="mt-10 inline-flex items-center gap-2 text-accent hover:underline text-sm font-medium"
          >
            See the Revenue Employee OS →
          </Link>
        </div>
      </section>

      {/* Trust */}
      <section id="pricing" className="border-t border-white/5 py-24 bg-surface/30">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-accent mb-3">
              Billing
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Simple pricing that scales with results
            </h2>
            <p className="mt-4 text-muted text-lg">
              Start with a monthly subscription, then scale with usage and optional
              onboarding or performance-based add-ons.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PRICING.map((plan, idx) => (
              <article
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  idx === 1
                    ? "border-accent/30 bg-accent-soft/20"
                    : "border-white/10 bg-surface/60"
                }`}
              >
                <p className="text-sm font-medium uppercase tracking-wide text-muted">
                  {plan.name}
                </p>
                <p className="mt-4">
                  <span className="text-4xl font-semibold">{plan.price}</span>
                  <span className="text-sm text-muted">{plan.period}</span>
                </p>
                <p className="mt-3 text-sm text-muted">{plan.audience}</p>
                <ul className="mt-6 space-y-2 text-sm">
                  {plan.highlights.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-good shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-white/10 bg-surface/50 px-5 py-4 text-sm text-muted">
            One-time onboarding setup is available from $500 to $5,000 depending on
            integrations and workflow complexity.
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Built for enterprise trust
          </h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TRUST.map((t) => (
              <div
                key={t.title}
                className="rounded-xl border border-white/5 p-5 hover:border-white/10 transition"
              >
                <h3 className="font-medium">{t.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-3xl border border-white/10 bg-surface/60 backdrop-blur-xl px-8 py-16 sm:px-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Build your autonomous revenue engine.
            </h2>
            <p className="mt-4 text-muted max-w-lg mx-auto">
              ApexGrowth is not software you use. ApexGrowth is an AI employee you deploy.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/os"
                className="inline-flex items-center justify-center rounded-xl bg-accent px-8 py-4 text-sm font-medium text-white hover:opacity-90 transition shadow-lg shadow-accent/25"
              >
                Launch ApexGrowth
              </Link>
              <Link
                href="/pipeline"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-sm font-medium hover:bg-white/10 transition"
              >
                Explore the platform
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
