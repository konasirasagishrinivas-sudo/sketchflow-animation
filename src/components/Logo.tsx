import { Link } from "react-router-dom";

export const Logo = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="2.5" y="2.5" width="27" height="27" rx="5" fill="hsl(var(--paper))" stroke="hsl(var(--ink))" strokeWidth="1.6" />
      <path d="M8 22 C 12 8, 20 8, 24 22" stroke="hsl(var(--ink))" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <circle cx="24" cy="22" r="2.4" fill="hsl(var(--accent))" />
    </svg>
    <span className="font-display text-lg tracking-tight">Inkframe</span>
  </Link>
);
