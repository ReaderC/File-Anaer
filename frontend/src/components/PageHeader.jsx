import { memo } from "react";

function PageHeader({ title, description, actions }) {
  return (
    <section className="page-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="page-header-actions">{actions}</div>
    </section>
  );
}

export default memo(PageHeader);
