import { Fragment, type ReactNode } from "react";

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(?!\s)(.+?)(?<!\s)\*|`(.+?)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-i${i++}`;
    if (match[1] !== undefined) nodes.push(<strong key={key}>{match[1]}</strong>);
    else if (match[2] !== undefined) nodes.push(<em key={key}>{match[2]}</em>);
    else if (match[3] !== undefined) nodes.push(<code key={key}>{match[3]}</code>);
    last = match.index + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={key}>
        {items.map((item, i) => (
          <li key={i}>{inline(item, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);

    if (bullet) {
      list.push(bullet[1]);
      return;
    }

    flushList(`ul-${index}`);

    if (!trimmed) return;
    blocks.push(<p key={`p-${index}`}>{inline(trimmed, `p-${index}`)}</p>);
  });

  flushList("ul-end");

  return <Fragment>{blocks}</Fragment>;
}
