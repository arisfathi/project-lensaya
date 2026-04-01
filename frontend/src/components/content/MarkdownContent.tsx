import { useMemo } from "react";

type MarkdownContentProps = {
  markdown: string;
  className?: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatInline = (raw: string) => {
  let value = escapeHtml(raw);
  value = value.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/\*(.+?)\*/g, "<em>$1</em>");
  value = value.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return value;
};

const renderMarkdown = (markdown: string) => {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      closeList();
      const level = Math.min(6, headingMatch[1].length);
      html.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (unorderedMatch) {
      if (listType !== "ul") {
        closeList();
        listType = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${formatInline(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (orderedMatch) {
      if (listType !== "ol") {
        closeList();
        listType = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${formatInline(orderedMatch[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${formatInline(trimmed)}</p>`);
  }

  closeList();
  return html.join("\n");
};

export function MarkdownContent({ markdown, className }: MarkdownContentProps) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);

  return (
    <div
      className={[
        "space-y-3 text-sm leading-7 text-slate-700",
        "[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-slate-950",
        "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-950",
        "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-950",
        "[&_ul]:list-disc [&_ul]:pl-6",
        "[&_ol]:list-decimal [&_ol]:pl-6",
        "[&_a]:font-medium [&_a]:text-cyan-700 hover:[&_a]:text-cyan-600",
        className || "",
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}


