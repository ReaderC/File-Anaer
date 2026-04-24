import { useEffect, useState } from "react";
import { fetchTextPreview } from "../api/client";

export default function useDuplicatePreview({ previewKind, previewRoot, selectedFile }) {
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreviewDetails, setShowPreviewDetails] = useState(false);
  const [textPreview, setTextPreview] = useState(null);

  useEffect(() => {
    if (!selectedFile || previewKind !== "text") {
      setTextPreview(null);
      setPreviewLoading(false);
      setPreviewError("");
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError("");
    fetchTextPreview(previewRoot, selectedFile.path)
      .then((payload) => {
        if (!cancelled) {
          setTextPreview(payload);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setPreviewError(requestError.message);
          setTextPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [previewKind, previewRoot, selectedFile]);

  function resetPreviewState() {
    setTextPreview(null);
    setPreviewError("");
    setPreviewLoading(false);
    setShowPreviewDetails(false);
  }

  return {
    previewError,
    previewLoading,
    resetPreviewState,
    setShowPreviewDetails,
    showPreviewDetails,
    textPreview
  };
}
