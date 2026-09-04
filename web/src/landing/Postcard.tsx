import { useEffect, useRef, useState } from "react";
import { growFlower, layNext, rand, type Flower } from "../flowers";
import "./Postcard.css";

/*
 * The closing card. When it comes into view the page warms a shade and flowers
 * climb the edges — each one sown a little higher than the last, so the garden
 * rises rather than any single bloom having to move.
 */

const SOW_MS = 900;
const STROKES_PER_FRAME = 3;

export function Postcard() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const watcher = new IntersectionObserver(
      ([entry]) => {
        setArrived(entry.isIntersecting);
        // The warm shade is a page-level mood, so it rides on the root.
        document.documentElement.toggleAttribute("data-soft", entry.isIntersecting);
      },
      { threshold: 0.4 },
    );
    watcher.observe(section);

    return () => {
      watcher.disconnect();
      document.documentElement.removeAttribute("data-soft");
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !arrived) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      const box = canvas.getBoundingClientRect();
      canvas.width = box.width * dpr;
      canvas.height = box.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const open: Flower[] = [];
    let raf = 0;
    let lastSow = 0;
    let climb = 1.02;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const box = canvas.getBoundingClientRect();

      if (now - lastSow > SOW_MS && climb > -0.05) {
        lastSow = now;
        // Hug the edges: the card and its message sit down the middle.
        const left = Math.random() < 0.5;
        const bloom = growFlower(
          (left ? rand(0.02, 0.2) : rand(0.8, 0.98)) * box.width,
          climb * box.height,
          now,
        );
        bloom.scale *= box.width < 700 ? 0.6 : 0.9;
        open.push(bloom);
        climb -= rand(0.07, 0.13);
      }

      for (const bloom of open) layNext(ctx, bloom, still ? bloom.strokes.length : STROKES_PER_FRAME);
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", size);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [arrived]);

  return (
    <section className={`pc${arrived ? " is-here" : ""}`} ref={sectionRef}>
      <canvas className="pc-garden" ref={canvasRef} aria-hidden="true" />

      <figure className="pc-card">
        <img
          src="/onna-bugeisha.jpg"
          alt="Utagawa Kuniyoshi's woodblock print of Ishi-jo, a woman warrior, holding a naginata"
          loading="lazy"
          width={646}
          height={900}
        />
        <figcaption>
          <span className="pc-stamp">Bazaar</span>
          <p className="pc-hand">
            An agent that can spend money is a liability
            <br />
            until it can be audited.
          </p>
          <p className="pc-meta">
            Ishi-jo, after Utagawa Kuniyoshi &middot; public domain
            <br />
            Track 01 &mdash; AI Growth &amp; Agentic Commerce
          </p>
        </figcaption>
      </figure>
    </section>
  );
}
