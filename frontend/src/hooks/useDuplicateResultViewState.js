import { useEffect, useRef, useState } from "react";

export default function useDuplicateResultViewState({
  groupsLength,
  groupMenuRef,
  hasScanResults,
  initialVisibleGroups,
  menuScopeKey,
  openGroupMenuHash,
  resetKey,
  setOpenGroupMenuHash,
  visibleGroupsStep
}) {
  const filterBarRef = useRef(null);
  const loadMoreRef = useRef(null);
  const [bulkBarOffset, setBulkBarOffset] = useState(98);
  const [filterBarExpanded, setFilterBarExpanded] = useState(false);
  const [visibleGroupCount, setVisibleGroupCount] = useState(initialVisibleGroups);

  useEffect(() => {
    function handlePointerDown(event) {
      if (groupMenuRef.current?.contains(event.target)) {
        return;
      }
      setOpenGroupMenuHash("");
    }
    if (!openGroupMenuHash) {
      return undefined;
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openGroupMenuHash]);

  useEffect(() => {
    setOpenGroupMenuHash("");
  }, [menuScopeKey]);

  useEffect(() => {
    setVisibleGroupCount((current) => Math.min(Math.max(initialVisibleGroups, current), Math.max(groupsLength, initialVisibleGroups)));
  }, [groupsLength, initialVisibleGroups]);

  useEffect(() => {
    setVisibleGroupCount(initialVisibleGroups);
  }, [initialVisibleGroups, resetKey]);

  useEffect(() => {
    if (visibleGroupCount >= groupsLength) {
      return undefined;
    }
    const target = loadMoreRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      setVisibleGroupCount((current) => Math.min(current + visibleGroupsStep, groupsLength));
    }, { rootMargin: "320px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [groupsLength, visibleGroupCount, visibleGroupsStep]);

  useEffect(() => {
    if (!hasScanResults) {
      return undefined;
    }
    function updateBulkBarOffset() {
      const filterHeight = filterBarRef.current?.getBoundingClientRect?.().height || filterBarRef.current?.offsetHeight || 0;
      setBulkBarOffset(filterHeight + 32);
    }
    updateBulkBarOffset();
    let animationFrame = window.requestAnimationFrame(updateBulkBarOffset);
    let resizeObserver;
    if (typeof ResizeObserver !== "undefined" && filterBarRef.current) {
      resizeObserver = new ResizeObserver(() => {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(updateBulkBarOffset);
      });
      resizeObserver.observe(filterBarRef.current);
    }
    window.addEventListener("resize", updateBulkBarOffset);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateBulkBarOffset);
    };
  }, [filterBarExpanded, groupsLength, hasScanResults]);

  return {
    bulkBarOffset,
    filterBarExpanded,
    filterBarRef,
    loadMoreRef,
    setFilterBarExpanded,
    visibleGroupCount
  };
}
