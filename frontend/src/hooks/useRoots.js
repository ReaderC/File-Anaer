import { useEffect, useState } from "react";
import { fetchRoots } from "../api/client";

export default function useRoots() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  useEffect(() => {
    let cancelled = false;
    fetchRoots()
      .then((payload) => {
        if (!cancelled) {
          setState({ items: payload.items ?? [], loading: false, error: "" });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ items: [], loading: false, error: error.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
