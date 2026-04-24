export function getPreviewKind(name) {
  const normalizedName = String(name || "").toLowerCase();
  if (normalizedName.startsWith("~$")) return "unsupported";
  if (normalizedName.endsWith(".tar.gz")) return "text";
  const ext = (normalizedName.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "ico", "jfif", "cbz", "cb7"].includes(ext)) return "image";
  if (["mp4", "mov", "mkv", "avi", "webm", "m4v", "ogv", "mpeg", "mpg", "3gp"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "opus", "m4a", "aac", "flac"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if ([
    "txt", "md", "markdown", "json", "ndjson", "js", "jsx", "ts", "tsx", "css", "html", "xml", "yml", "yaml", "log", "ini", "csv", "tsv",
    "go", "py", "java", "rs", "sh", "bat", "cmd", "ps1", "sql", "toml", "conf", "config", "cfg", "properties",
    "env", "rtf", "srt", "ass", "vtt", "docx", "xlsx", "pptx", "doc", "xls", "ppt", "odt", "ods", "odp", "wps", "wpt", "et", "ett", "dps", "dpt", "epub", "zip", "7z", "tar", "tgz",
    "c", "cc", "cpp", "h", "hpp", "vue", "lua", "rb", "php", "kt", "kts", "swift"
  ].includes(ext)) return "text";
  if (["dockerfile", "makefile", "gitignore"].includes(normalizedName)) return "text";
  return "unsupported";
}

export function previewKindLabel(kind, locale) {
  return ({
    folder: locale === "en" ? "Folder" : "文件夹",
    image: locale === "en" ? "Image" : "图片",
    video: locale === "en" ? "Video" : "视频",
    audio: locale === "en" ? "Audio" : "音频",
    text: locale === "en" ? "Text" : "文本",
    pdf: "PDF",
    unsupported: locale === "en" ? "Other" : "其他"
  }[kind]) || (locale === "en" ? "Other" : "其他");
}

export function getExtensionLabel(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return ext ? `.${ext}` : "-";
}
