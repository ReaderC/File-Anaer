export function toDelimitedText(columns, rows, delimiter = ",") {
  const header = columns.map((column) => escapeDelimitedValue(column, delimiter)).join(delimiter);
  const lines = rows.map((row) => row.map((value) => escapeDelimitedValue(value, delimiter)).join(delimiter));
  return [header, ...lines].join("\r\n");
}

export function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([`\uFEFF${content}`], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeDelimitedValue(value, delimiter) {
  const text = String(value ?? "");
  if (!text.includes("\"") && !text.includes("\n") && !text.includes("\r") && !text.includes(delimiter)) {
    return text;
  }
  return `"${text.replace(/"/g, "\"\"")}"`;
}
