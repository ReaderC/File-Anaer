import { memo } from "react";
import Icon from "./Icon";
import { formatBytes, formatDate } from "../lib/format";
import { getFileMeta } from "../lib/fileMeta";

function DataTable({ columns, rows, emptyText = "No data available.", onRowClick, onRowEnter, onRowLeave, sortBy, sortDir, onSort }) {
  if (!rows.length) {
    return <div className="empty-card">{emptyText}</div>;
  }

  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>
                {column.sortable ? (
                  <button
                    type="button"
                    className={`table-sort-button ${sortBy === column.sortKey ? "is-active" : ""}`}
                    onClick={() => onSort?.(column.sortKey)}
                  >
                    <span>{column.label}</span>
                    <Icon
                      name={sortBy === column.sortKey ? (sortDir === "asc" ? "north" : "south") : "unfold_more"}
                      className="table-sort-icon"
                    />
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id ?? row.path ?? index}
              className={onRowClick ? "is-clickable" : ""}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onMouseEnter={onRowEnter ? () => onRowEnter(row) : undefined}
              onMouseLeave={onRowLeave ? () => onRowLeave(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.key}>{renderCell(column.key, row[column.key], row, column.render)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(DataTable);

function renderCell(key, value, row, customRender) {
  if (customRender) {
    return customRender(value, row);
  }

  if (key === "name") {
    const meta = getFileMeta(row.name, row.extension, row.isDir || row.type === "directory");
    const subtitle = row.displayParentPath || row.parentPath || row.displayPath || row.path;
    return (
      <div className="file-cell">
        <div className={`file-icon tone-${meta.tone}`}>
          <Icon name={meta.icon} className="file-icon-glyph" fallback={false} />
        </div>
        <div className="file-copy">
          <div className="file-title" title={row.name}>
            {row.name || "--"}
          </div>
          <div className="file-subtitle" title={subtitle}>
            {subtitle || "--"}
          </div>
        </div>
      </div>
    );
  }

  if (key === "extension" || key === "type") {
    const meta = getFileMeta(row.name, row.extension, row.isDir || row.type === "directory");
    return <span className={`type-chip tone-${meta.tone}`}>{(value || meta.label || "FILE").toString().toUpperCase()}</span>;
  }

  if (key === "path" || key === "parentPath") {
    return (
      <div className="path-cell" title={value}>
        {value || "--"}
      </div>
    );
  }

  if (key.toLowerCase().includes("size")) {
    return formatBytes(value);
  }

  if (key.toLowerCase().includes("modified")) {
    return formatDate(value);
  }

  return value || "--";
}
