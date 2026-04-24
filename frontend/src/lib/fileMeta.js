const TYPE_META = {
  video: { icon: "movie", tone: "tertiary", label: "VIDEO" },
  image: { icon: "image", tone: "secondary", label: "IMAGE" },
  document: { icon: "description", tone: "primary", label: "DOCUMENT" },
  archive: { icon: "folder_zip", tone: "neutral", label: "ARCHIVE" },
  folder: { icon: "folder", tone: "secondary", label: "FOLDER" },
  other: { icon: "draft", tone: "neutral", label: "FILE" }
};

export function getFileMeta(name = "", extension = "", isDir = false) {
  if (isDir) {
    return TYPE_META.folder;
  }

  const ext = (extension || name.split(".").pop() || "").toLowerCase();
  if (["mp4", "mov", "mkv", "avi", "webm", "m4v"].includes(ext)) {
    return TYPE_META.video;
  }
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "ico", "jfif", "psd"].includes(ext)) {
    return TYPE_META.image;
  }
  if (["pdf", "doc", "docx", "txt", "md", "xlsx", "ppt", "pptx"].includes(ext)) {
    return TYPE_META.document;
  }
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso"].includes(ext)) {
    return TYPE_META.archive;
  }
  return TYPE_META.other;
}

export function normalizeTypeStats(items = []) {
  const order = ["视频", "图片", "文档", "压缩包", "其他"];
  const byLabel = new Map(items.map((item) => [item.label, item]));
  return order.map((label) => byLabel.get(label) ?? { label, sizeBytes: 0, percentage: 0 });
}
