import { useEffect, useRef, type ReactNode } from "react";
import { GitHubIcon, MoonIcon, SunIcon } from "../icons";
import { navigate } from "../router";
import { useTheme } from "../useTheme";
import "./pages.css";

const LINKS = [
  { href: "/app", label: "Agent" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agents", label: "AI buyers" },
  { href: "/protocols", label: "Protocols" },
];

function useReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((el) => el.setAttribute("data-shown", "true"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-shown", "true");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return ref;
}

export function PageShell({
  slug,
  width = 880,
  children,
}: {
  slug: string;
  width?: number;
  children: ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const mainRef = useReveal();

  return (
    <div className="pg">
      <header className="pg-head">
        <a className="pg-brand" href="/" onClick={navigate("/")}>
          <span aria-hidden="true">❖</span>
          <span className="pg-brand-name">BAZAAR</span>
          <span className="pg-brand-slash">/{slug}</span>
        </a>
        <nav className="pg-nav">
          {LINKS.filter((link) => link.href !== `/${slug}`).map((link) => (
            <a key={link.href} href={link.href} onClick={navigate(link.href)}>
              {link.label}
            </a>
          ))}
          <a
            className="pg-icon"
            href="https://github.com/Dhruv-kys/BAZAAR"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
          >
            <GitHubIcon size={15} />
          </a>
          <button
            className="pg-icon"
            type="button"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          </button>
        </nav>
      </header>

      <main className="pg-main" ref={mainRef} style={{ maxWidth: `${width}px` }}>
        {children}
      </main>
    </div>
  );
}
