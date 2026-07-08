import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-bold">
              A
            </span>
            <span className="font-semibold tracking-tight">ApexGrowth</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-8 text-sm text-muted">
            <a href="#how-it-works" className="hover:text-foreground transition">
              How it works
            </a>
            <a href="#agents" className="hover:text-foreground transition">
              AI team
            </a>
            <a href="#pricing" className="hover:text-foreground transition">
              Pricing
            </a>
            <a href="#trust" className="hover:text-foreground transition">
              Trust
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/pipeline"
              className="hidden sm:inline text-sm text-muted hover:text-foreground transition"
            >
              Explore platform
            </Link>
            <Link
              href="/os"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
            >
              Launch ApexGrowth
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 pt-16">{children}</main>
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <p>© {new Date().getFullYear()} ApexGrowth. Autonomous revenue intelligence.</p>
          <div className="flex gap-6">
            <Link href="/pipeline" className="hover:text-foreground transition">
              Platform
            </Link>
            <Link href="/command-center" className="hover:text-foreground transition">
              Command Center
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
