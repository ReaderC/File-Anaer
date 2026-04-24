import { memo } from "react";
import Icon from "./Icon.jsx";

function FilterField({ label, icon, children, className = "" }) {
  return (
    <div className={`filter-field ${className}`.trim()}>
      <span className="filter-label">
        <Icon name={icon} />
        <span>{label}</span>
      </span>
      {children}
    </div>
  );
}

export default memo(FilterField);
