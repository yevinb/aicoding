import Link from "next/link";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/pipeline" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white font-bold text-lg">
              A
            </span>
            <span>
              <span className="block font-semibold leading-tight">ApexGrowth</span>
              <span className="block text-xs text-muted leading-tight">
                AI Revenue Orchestrator
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/memory"
              className="text-muted hover:text-foreground transition"
            >
              Memory
            </Link>
            <Link
              href="/providers"
              className="text-muted hover:text-foreground transition"
            >
              Providers
            </Link>
            <Link
              href="/communication"
              className="text-muted hover:text-foreground transition"
            >
              Comm OS
            </Link>
            <Link
              href="/loop"
              className="text-muted hover:text-foreground transition"
            >
              Loop
            </Link>
            <Link
              href="/runtime"
              className="text-muted hover:text-foreground transition"
            >
              Runtime
            </Link>
            <Link
              href="/revenue-signals"
              className="text-muted hover:text-foreground transition"
            >
              Signals
            </Link>
            <Link
              href="/prospect-intelligence"
              className="text-muted hover:text-foreground transition"
            >
              Prospect Intel
            </Link>
            <Link
              href="/execution"
              className="text-muted hover:text-foreground transition"
            >
              Execution
            </Link>
            <Link
              href="/mission-control"
              className="text-muted hover:text-foreground transition"
            >
              Mission Control
            </Link>
            <Link
              href="/os"
              className="text-muted hover:text-foreground transition"
            >
              Revenue OS
            </Link>
            <Link
              href="/command-center"
              className="text-muted hover:text-foreground transition"
            >
              Command Center
            </Link>
            <Link
              href="/cro"
              className="text-muted hover:text-foreground transition"
            >
              CRO
            </Link>
            <Link
              href="/crm-health"
              className="text-muted hover:text-foreground transition"
            >
              CRM Health
            </Link>
            <Link
              href="/analytics"
              className="text-muted hover:text-foreground transition"
            >
              Analytics
            </Link>
            <Link
              href="/learning"
              className="text-muted hover:text-foreground transition"
            >
              Learning
            </Link>
            <Link
              href="/pipeline"
              className="text-muted hover:text-foreground transition"
            >
              Pipeline
            </Link>
            <Link
              href="/leads/new"
              className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:opacity-90 transition"
            >
              + Add lead
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
