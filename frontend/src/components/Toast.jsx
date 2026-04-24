import { memo } from "react";
import Icon from "./Icon.jsx";

function Toast({ message }) {
  if (!message) {
    return null;
  }

  return (
    <div className="toast-banner" role="status" aria-live="polite">
      <Icon name="check_circle" />
      <span>{message}</span>
    </div>
  );
}

export default memo(Toast);
