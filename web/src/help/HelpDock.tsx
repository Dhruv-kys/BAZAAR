import { useEffect, useRef, useState } from "react";
import { CloseIcon, CoinIcon } from "../icons";
import "./HelpDock.css";

const PROMPTS = [
  "Why can't the agent charge me?",
  "What happens if I ask for a bigger discount?",
  "Where is my payment actually taken?",
];

/**
 * The shell for a money-questions assistant. It deliberately answers nothing:
 * the backend does not exist yet, and inventing replies here would be the
 * exact kind of fake state the rest of this app refuses to ship.
 */
export function HelpDock() {
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function ask(q: string) {
    if (!q.trim()) return;
    setAsked((prev) => [...prev, q]);
    setDraft("");
  }

  return (
    <>
      <button
        className={`hd-launch${open ? " is-open" : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls="hd-panel"
        aria-label={open ? "Close money questions" : "Ask about money and limits"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <CloseIcon size={15} /> : <CoinIcon size={17} />}
      </button>

      {open && (
        <div className="hd-panel" id="hd-panel" ref={panelRef} role="dialog" aria-label="Money questions">
          <header className="hd-head">
            <span className="hd-title">Money questions</span>
            <span className="hd-state">Not connected yet</span>
          </header>

          <div className="hd-body">
            <p className="hd-intro">
              This is where you will be able to ask how the limits work, what the agent may do with your money, and
              what happened on any order. The assistant behind it is not built yet, so nothing here will answer you.
            </p>

            {asked.map((q, i) => (
              <div key={i} className="hd-turn">
                <p className="hd-q">{q}</p>
                <p className="hd-a">
                  Saved. There is no assistant wired to this yet, so this question has not been answered.
                </p>
              </div>
            ))}

            {asked.length === 0 && (
              <ul className="hd-prompts">
                {PROMPTS.map((p) => (
                  <li key={p}>
                    <button type="button" onClick={() => ask(p)}>
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form
            className="hd-composer"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about limits or a payment"
              aria-label="Ask about limits or a payment"
            />
            <button type="submit" disabled={!draft.trim()}>
              Ask
            </button>
          </form>
        </div>
      )}
    </>
  );
}
