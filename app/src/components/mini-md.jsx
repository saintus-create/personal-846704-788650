import React from "react";

// minimal markdown renderer with inline citation markers
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "\u0026amp;").replace(/</g, "\u0026lt;").replace(/>/g, "\u0026gt;");
}

function tables(h) {
  return h.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const next = i + 1 < lines.length ? lines[i + 1] : "";
      if (line.includes("|") && next.includes("-") && /^\s*\|?[\s:|-]+\|?\s*$/.test(next)) {
        const cellsOf = (l) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
        const head = cellsOf(line);
        const rows = [];
        let j = i + 2;
        while (j < lines.length && lines[j].includes("|")) { rows.push(cellsOf(lines[j])); j++; }
        out.push({ table: "<table><thead><tr>" + head.map((c) => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>" +
          rows.map((r) => "<tr>" + head.map((_, k) => "<td>" + (r[k] || "") + "</td>").join("") + "</tr>").join("") + "</tbody></table>" });
        i = j;
      } else { out.push({ line }); i++; }
    }
    return out.map((x) => (x.table ? "\n\n" + x.table + "\n\n" : x.line)).join("\n");
  }).join("\n\n");
}

export function miniMd(md) {
  let h = esc(md);
  h = h.replace(/^#{1,4}\s+(.+)$/gm, "<h4>$1</h4>");
  h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  h = h.replace(/\*([^*\n]+)\*/g, "<i>$1</i>");
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = tables(h);
  h = h.replace(/((?:^[-*\u2022]\s.+\n?)+)/gm, (m) =>
    "<ul>" + m.trim().split("\n").map((l) => "<li>" + l.replace(/^[-*\u2022]\s/, "") + "</li>").join("") + "</ul>");
  h = h.replace(/((?:^\d+[.)]\s.+\n?)+)/gm, (m) =>
    "<ol>" + m.trim().split("\n").map((l) => "<li>" + l.replace(/^\d+[.)]\s/, "") + "</li>").join("") + "</ol>");
  return h.split(/\n{2,}/).map((p) =>
    /^\s*<(ul|ol|h4|table)/.test(p) ? p : "<p>" + p.replace(/\n/g, "<br>") + "</p>"
  ).join("");
}

// turn [3] / [c2] citation markers into clickable superscripts
export function withCites(html) {
  return String(html)
    .replace(/\[\s*c(\d+)\s*\]/gi, '<sup class="cite-mark" data-cite="c$1">\u0026nbsp;#c$1</sup>')
    .replace(/\[\s*(\d{1,2})\s*\]/g, '<sup class="cite-mark" data-cite="$1">#$1</sup>');
}

export function Html({ content, className, onCite }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !onCite) return;
    const h = (e) => {
      const t = e.target.closest("sup.cite-mark");
      if (t) onCite(t.getAttribute("data-cite"));
    };
    el.addEventListener("click", h);
    return () => el.removeEventListener("click", h);
  }, [onCite]);
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: content }} />;
}
