import { memo } from "react";
import Icon from "./Icon.jsx";
import { useI18n } from "../lib/i18n.jsx";

function ErrorState({ message }) {
  const { t } = useI18n();
  return (
    <div className="state-card error">
      <Icon name="warning" />
      <h3>{t("messages.requestFailed")}</h3>
      <p>{message}</p>
    </div>
  );
}

export default memo(ErrorState);
