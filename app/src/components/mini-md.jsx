import React from "react";

// minimal markdown renderer (port of the live app's tinyMd)
export function miniMd(md) {
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "\u0026amp;").replace(/</g, "\u0026lt;").replace(/>/g, "\u0026gt;");
  let h = esc(md);
  h = h.replace(/^#{1,4}\s+(.+)$/gm, "<h4>$1</h4>");
  h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/((?:^[-*\u2022]\s.+\n?)+)/gm, (m) =>
    "<ul>" + m.trim().split("\n").map((l) => "<li>" + l.replace(/^[-*\u2022]\s/, "") + "</li>").join("") + "</ul>");
  h = h.replace(/((?:^\d+[.)]\s.+\n?)+)/gm, (m) =>
    "<ol>" + m.trim().split("\n").map((l) => "<li>" + l.replace(/^\d+[.)]\s/, "") + "</li>").join("") + "</ol>");
  return h.split(/\n{2,}/).map((p) =>
    /^\s*<(ul|ol|h4)/.test(p) ? p : "<p>" + p.replace(/\n/g, "<br>") + "</p>"
  ).join("");
}

export function Html({ content, className }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: content }} />;
}
