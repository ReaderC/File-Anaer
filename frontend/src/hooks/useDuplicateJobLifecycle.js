import { useEffect } from "react";

export default function useDuplicateJobLifecycle({
  cancelDuplicateJob,
  fetchDuplicateJob,
  job,
  jobId,
  pollInterval = 1200,
  releaseJobMemory,
  resetResultsState,
  setError,
  setJob,
  setJobId
}) {
  useEffect(() => {
    if (!jobId || (job?.status && job.status !== "running" && job.status !== "pending")) return undefined;
    const timer = window.setInterval(() => {
      fetchDuplicateJob(jobId)
        .then((payload) => {
          setJob(payload);
          if (payload?.status === "done" || payload?.status === "error" || payload?.status === "canceled") {
            window.clearInterval(timer);
          }
        })
        .catch((requestError) => {
          setError(requestError.message);
          window.clearInterval(timer);
        });
    }, pollInterval);
    return () => window.clearInterval(timer);
  }, [fetchDuplicateJob, job?.status, jobId, pollInterval, setError, setJob]);

  async function handleClearResults() {
    if (job?.status === "running" && jobId) {
      try {
        await cancelDuplicateJob(jobId);
      } catch (requestError) {
        setError(requestError.message);
        return;
      }
    }
    if (jobId && typeof releaseJobMemory === "function") {
      try {
        await releaseJobMemory(jobId);
      } catch (requestError) {
        setError(requestError.message);
        return;
      }
    }
    setJobId("");
    setJob(null);
    setError("");
    resetResultsState();
  }

  return {
    handleClearResults
  };
}
