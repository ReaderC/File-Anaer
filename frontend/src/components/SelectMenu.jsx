import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";

export default function SelectMenu({ value, options, onChange, placeholder = "Select..." }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState(null);

  function handlePopoverWheel(event) {
    if (!popoverRef.current || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      event.stopPropagation();
      return;
    }

    const node = popoverRef.current;
    const nextTop = node.scrollTop + event.deltaY;
    const maxTop = Math.max(node.scrollHeight - node.clientHeight, 0);

    node.scrollTop = Math.min(Math.max(nextTop, 0), maxTop);
    event.preventDefault();
    event.stopPropagation();
  }

  useEffect(() => {
    function handlePointer(event) {
      if (rootRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) {
        return;
      }
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = rootRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const gap = 8;
      const margin = 12;
      const estimatedHeight = Math.min(options.length * 44, 240);
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openUpward = spaceBelow < Math.min(estimatedHeight, 160) && spaceAbove > spaceBelow;
      const width = rect.width;
      const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
      const maxHeight = Math.max(120, Math.min(240, openUpward ? spaceAbove - gap : spaceBelow - gap));
      setPopoverStyle({
        top: openUpward ? "auto" : rect.bottom + gap,
        bottom: openUpward ? viewportHeight - rect.top + gap : "auto",
        left,
        width,
        maxHeight
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const selected = options.find((item) => item.value === value);

  return (
    <div className="select-menu" ref={rootRef}>
      <button type="button" className="select-trigger" onClick={() => setOpen((current) => !current)}>
        <span className="select-trigger-label" title={selected?.label || value}>
          {selected?.label || placeholder}
        </span>
        <Icon name="expand_more" />
      </button>
      {open && popoverStyle
        ? createPortal(
        <div
          className="select-popover is-floating"
          style={popoverStyle}
          ref={popoverRef}
          onWheel={handlePopoverWheel}
          onWheelCapture={(event) => {
            event.stopPropagation();
          }}
        >
          {options.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`select-option ${item.value === value ? "is-active" : ""}`}
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
              title={item.label}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
}
