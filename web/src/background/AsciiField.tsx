import { useMemo } from "react";
import "./AsciiField.css";

const GLYPHS = "BAZAAR//AGENT<>[]{}()$*+=~^#%&0123456789";
const CELL_COUNT = 900;

function seeded(index: number): string {
  const hash = (index * 2654435761) % 4294967296;
  return GLYPHS[hash % GLYPHS.length];
}

export function AsciiField() {
  const cells = useMemo(
    () =>
      Array.from({ length: CELL_COUNT }, (_, i) => {
        const char = seeded(i);
        return { char, code: char.charCodeAt(0) };
      }),
    [],
  );

  return (
    <div className="af" aria-hidden="true">
      {cells.map((cell, i) => (
        <span className="af-cell" key={i}>
          <b>{cell.char}</b>
          <i>{cell.code}</i>
        </span>
      ))}
    </div>
  );
}
