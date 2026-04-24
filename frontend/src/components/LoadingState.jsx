import { memo } from "react";
import Icon from "./Icon.jsx";
import { useI18n } from "../lib/i18n.jsx";

function LoadingState({ title, description }) {
  const { t } = useI18n();
  const message = title || t("messages.loadingData");
  return (
    <div className="state-card">
      <Icon name="progress_activity" className="spin" />
      <h3>{message}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export default memo(LoadingState);
