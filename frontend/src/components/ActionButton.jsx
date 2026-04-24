import { memo } from "react";
import Icon from "./Icon.jsx";
import { classNames } from "../lib/format";

function ActionButton({ icon, children, tone = "primary", className, ...props }) {
  return (
    <button {...props} className={classNames("action-button", `action-button-${tone}`, className)}>
      {icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
    </button>
  );
}

export default memo(ActionButton);
