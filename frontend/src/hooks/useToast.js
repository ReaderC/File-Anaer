import { useEffect, useState } from "react";

export default function useToast(timeout = 1800) {
  const [toastState, setToastState] = useState({ message: "", timeout });
  const { message, timeout: activeTimeout } = toastState;

  useEffect(() => {
    if (!message) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setToastState((current) => (current.message ? { message: "", timeout } : current));
    }, activeTimeout);
    return () => window.clearTimeout(timer);
  }, [message, activeTimeout, timeout]);

  return {
    message,
    showToast(nextMessage, nextTimeout = timeout) {
      setToastState({ message: nextMessage, timeout: nextTimeout });
    },
    clearToast() {
      setToastState({ message: "", timeout });
    }
  };
}
