import ReactMarkdown from "react-markdown";

function isMarkdownName(name) {
  const normalized = String(name || "").toLowerCase();
  return normalized.endsWith(".md") || normalized.endsWith(".markdown");
}

export default function TextPreviewContent({ content, fileName, expanded = false }) {
  const className = `duplicates-preview-text${expanded ? " is-expanded" : ""}`;
  if (isMarkdownName(fileName)) {
    return (
      <div className={`${className} duplicates-preview-markdown`}>
        <ReactMarkdown>{content || ""}</ReactMarkdown>
      </div>
    );
  }

  return <pre className={className}>{content || ""}</pre>;
}
