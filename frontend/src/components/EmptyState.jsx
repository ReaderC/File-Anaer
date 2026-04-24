import { memo } from "react";
import Icon from "./Icon.jsx";

function EmptyState({ title, description }) {
  return (
    <div className="state-card">
      <Icon name="inbox" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export default memo(EmptyState);
