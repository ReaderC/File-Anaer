export function isMediaPreviewSupported(name, kind) {
  if (kind !== "video" && kind !== "audio") {
    return true;
  }
  if (typeof document === "undefined") {
    return true;
  }
  const type = getMediaMimeType(name);
  if (!type) {
    return true;
  }
  const element = document.createElement(kind);
  return typeof element.canPlayType === "function" && element.canPlayType(type) !== "";
}

export function getMediaPreviewMessage(name, kind, locale) {
  if (isMediaPreviewSupported(name, kind)) {
    return "";
  }
  return locale === "en"
    ? "This browser kernel does not support inline playback for this format. Try another browser or open the file directly."
    : "当前浏览器内核不支持这种格式的内嵌播放。请换个浏览器，或直接打开文件。";
}

export function getMediaMimeType(name) {
  const ext = (String(name || "").toLowerCase().split(".").pop() || "");
  return ({
    mp4: "video/mp4",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    webm: "video/webm",
    m4v: "video/mp4",
    ogv: "video/ogg",
    mpeg: "video/mpeg",
    mpg: "video/mpeg",
    "3gp": "video/3gpp",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    opus: "audio/ogg; codecs=opus",
    m4a: "audio/mp4",
    aac: "audio/aac",
    flac: "audio/flac"
  })[ext] || "";
}
