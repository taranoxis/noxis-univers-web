// Keep prose and source separate, including when a reply ends mid-block.
export function messageParts(content) {
  const parts = [];
  const fence = /^[ \t]{0,3}(`{3,}|~{3,})([^\r\n]*)\r?$/gm;
  const html = /^[ \t]*(?:<!doctype[ \t]+html\b|<html(?:[ \t\r\n>]))/im;
  const htmlEnd = /<\/html[ \t]*>/i;
  let from = 0;

  function addProse(prose) {
    const start = html.exec(prose);
    if (!start) {
      if (prose) parts.push({ text: prose });
      return;
    }

    const source = prose.slice(start.index);
    const end = htmlEnd.exec(source);
    if (start.index) parts.push({ text: prose.slice(0, start.index) });
    parts.push({ code: end ? source.slice(0, end.index + end[0].length) : source, language: "html" });
    if (end) {
      const after = source.slice(end.index + end[0].length);
      if (after) parts.push({ text: after });
    }
  }

  for (let open; (open = fence.exec(content));) {
    const info = open[2].trim();
    if (info.includes(open[1][0])) continue;
    addProse(content.slice(from, open.index));
    const start = fence.lastIndex + (content[fence.lastIndex] === "\n" ? 1 : 0);
    let close;
    while ((close = fence.exec(content))) {
      if (close[1][0] === open[1][0] && close[1].length >= open[1].length && !close[2].trim()) break;
    }
    const end = close?.index ?? content.length;
    const code = content.slice(start, end);
    parts.push({
      code: close ? code.replace(/\r?\n$/, "") : code,
      language: info.split(/\s+/, 1)[0].toLowerCase(),
      fenced: content.slice(open.index, close ? fence.lastIndex : content.length),
    });
    if (!close) return parts;
    from = fence.lastIndex;
  }
  addProse(content.slice(from));
  return parts;
}
