import Link from "next/link";

// Sitewide footer (root layout, so every page), copy from brand/footer/footer.css,
// plus the help and legal links.
const LINKS = [
  { href: "/faq", label: "FAQ" },
  { href: "/support", label: "Support" },
  { href: "/contact", label: "Contact us" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-line px-6 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-3 text-sm text-fg-muted">
        <nav aria-label="Help and legal" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-fg hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>&copy; 3PandaLabs LLC, USA.</span>
          <span>All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
