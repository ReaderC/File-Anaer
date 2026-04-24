const COMMON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true"
};

function iconPaths(name) {
  switch (name) {
    case "terminal":
      return (
        <>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <path d="M7.5 10 10 12.5 7.5 15" />
          <path d="M12.5 15h4" />
        </>
      );
    case "storage":
      return (
        <>
          <ellipse cx="12" cy="6.5" rx="6.5" ry="2.5" />
          <path d="M5.5 6.5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" />
          <path d="M5.5 11.5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" />
        </>
      );
    case "admin_panel_settings":
      return (
        <>
          <path d="M12 3.5 5 6.5v4.7c0 4 2.6 7.4 7 9.3 4.4-1.9 7-5.3 7-9.3V6.5Z" />
          <circle cx="12" cy="11" r="2.2" />
          <path d="M12 13.8c-1.9 0-3.6.9-4.5 2.4" />
          <path d="M16.5 16.2c-.9-1.5-2.6-2.4-4.5-2.4" />
        </>
      );
    case "person":
      return (
        <>
          <circle cx="12" cy="8" r="3" />
          <path d="M6.5 18c1.3-2.6 3.2-4 5.5-4s4.2 1.4 5.5 4" />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="6.5" y="10.5" width="11" height="9" rx="2" />
          <path d="M9 10.5V8a3 3 0 0 1 6 0v2.5" />
        </>
      );
    case "visibility":
      return (
        <>
          <path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      );
    case "visibility_off":
      return (
        <>
          <path d="M3 3 21 21" />
          <path d="M10.6 6.7A10.6 10.6 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a18.5 18.5 0 0 1-3.7 4.2" />
          <path d="M6.2 8.2A18 18 0 0 0 2.5 12s3.5 5.5 9.5 5.5c1 0 2-.2 2.9-.5" />
          <path d="M10.6 10.6A2.5 2.5 0 0 0 14 14" />
        </>
      );
    case "login":
      return (
        <>
          <path d="M10 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h3" />
          <path d="M13 12h7" />
          <path d="m17 8 4 4-4 4" />
        </>
      );
    case "verified_user":
      return (
        <>
          <path d="M12 3.5 5.5 6.3v4.9c0 4 2.5 7.2 6.5 9.3 4-2.1 6.5-5.3 6.5-9.3V6.3Z" />
          <path d="m9.2 12.2 1.8 1.8 3.8-4" />
        </>
      );
    case "arrow_forward":
      return <path d="M5 12h14m-5-5 5 5-5 5" />;
    case "search":
    case "manage_search":
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </>
      );
    case "analytics":
      return (
        <>
          <path d="M5 19.5h14" />
          <rect x="6" y="11" width="2.8" height="6" rx="1" />
          <rect x="10.6" y="8" width="2.8" height="9" rx="1" />
          <rect x="15.2" y="5" width="2.8" height="12" rx="1" />
        </>
      );
    case "content_copy":
      return (
        <>
          <rect x="9" y="7" width="10" height="12" rx="2" />
          <path d="M6.5 15H6A2 2 0 0 1 4 13V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v.5" />
        </>
      );
    case "logout":
      return (
        <>
          <path d="M10 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h3" />
          <path d="M13 12h7" />
          <path d="m17 8 4 4-4 4" />
        </>
      );
    case "light_mode":
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
        </>
      );
    case "dark_mode":
      return <path d="M14.5 3.5a8.5 8.5 0 1 0 6 14.5A9.5 9.5 0 0 1 14.5 3.5Z" />;
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="2.6" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 0 1 0 1.7l-1.2 1.2a1.2 1.2 0 0 1-1.7 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.2 1.2 0 0 1-1.2 1.2h-1.6A1.2 1.2 0 0 1 11 20v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 0 1-1.7 0l-1.2-1.2a1.2 1.2 0 0 1 0-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4A1.2 1.2 0 0 1 2.8 13v-2A1.2 1.2 0 0 1 4 9.8h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 0 1 0-1.7l1.2-1.2a1.2 1.2 0 0 1 1.7 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4A1.2 1.2 0 0 1 11 2.8h2A1.2 1.2 0 0 1 14.2 4v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 0 1 1.7 0l1.2 1.2a1.2 1.2 0 0 1 0 1.7l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1.2 1.2 0 0 1 1.2 1.2v2A1.2 1.2 0 0 1 20 14.2h-.2a1 1 0 0 0-.9.6Z" />
        </>
      );
    case "grid_view":
      return (
        <>
          <rect x="4" y="4" width="6" height="6" rx="1.2" />
          <rect x="14" y="4" width="6" height="6" rx="1.2" />
          <rect x="4" y="14" width="6" height="6" rx="1.2" />
          <rect x="14" y="14" width="6" height="6" rx="1.2" />
        </>
      );
    case "database":
      return (
        <>
          <ellipse cx="12" cy="6.5" rx="6.5" ry="2.5" />
          <path d="M5.5 6.5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" />
          <path d="M5.5 11.5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" />
        </>
      );
    case "history":
      return (
        <>
          <path d="M4.5 5.5V10H9" />
          <path d="M5.2 14a7 7 0 1 0 2-6.3L4.5 10" />
        </>
      );
    case "schedule":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5l3 1.8" />
        </>
      );
    case "ink_eraser":
      return (
        <>
          <path d="m7 14 5.5-6.5a2 2 0 0 1 3 .1l2 2.3a2 2 0 0 1-.1 2.7L12 19H7.5L5 16.5Z" />
          <path d="M11 19h8" />
        </>
      );
    case "refresh":
      return (
        <>
          <path d="M20 5v5h-5" />
          <path d="M4 19v-5h5" />
          <path d="M6.8 9A7 7 0 0 1 18 6l2 4" />
          <path d="M17.2 15A7 7 0 0 1 6 18l-2-4" />
        </>
      );
    case "play_arrow":
      return <path fill="currentColor" stroke="none" d="M8 5.5v13l10-6.5Z" />;
    case "chevron_left":
      return <path d="m14.5 6-6 6 6 6" />;
    case "chevron_right":
      return <path d="m9.5 6 6 6-6 6" />;
    case "download":
      return (
        <>
          <path d="M12 4.5v10" />
          <path d="m8.5 11 3.5 3.5 3.5-3.5" />
          <path d="M5 19.5h14" />
        </>
      );
    case "table_view":
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M4 10h16M9 5v14M15 5v14" />
        </>
      );
    case "receipt_long":
      return (
        <>
          <path d="M7 3.5h10a2 2 0 0 1 2 2v15l-2.2-1.4-2.1 1.4-2.2-1.4-2.1 1.4-2.2-1.4-2.2 1.4v-15a2 2 0 0 1 2-2Z" />
          <path d="M9 8.5h6M9 12h6M9 15.5h4" />
        </>
      );
    case "stop_circle":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
        </>
      );
    case "playlist_remove":
      return (
        <>
          <path d="M5 7h10M5 11h10M5 15h7" />
          <path d="M18 10.5h4" />
        </>
      );
    case "progress_activity":
      return (
        <>
          <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" opacity="0.3" />
          <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" />
        </>
      );
    case "inbox":
      return (
        <>
          <path d="M4 6.5h16l-1.2 9.3a2 2 0 0 1-2 1.7H7.2a2 2 0 0 1-2-1.7Z" />
          <path d="M4.8 13.5h4.2l1.5 2h3l1.5-2h4.2" />
        </>
      );
    case "warning":
      return (
        <>
          <path d="M12 4.5 20 18.5H4Z" />
          <path d="M12 9v4.5M12 16.5h.01" />
        </>
      );
    case "close":
      return <path d="m6 6 12 12M18 6 6 18" />;
    case "expand_more":
      return <path d="m6.5 9 5.5 6 5.5-6" />;
    case "expand_less":
      return <path d="m6.5 15 5.5-6 5.5 6" />;
    case "north":
      return <path d="M12 19V6m0 0-4.5 4.5M12 6l4.5 4.5" />;
    case "south":
      return <path d="M12 5v13m0 0-4.5-4.5M12 18l4.5-4.5" />;
    case "unfold_more":
      return (
        <>
          <path d="m8 8 4-4 4 4" />
          <path d="m8 16 4 4 4-4" />
        </>
      );
    case "folder":
      return (
        <>
          <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2H18a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5Z" />
        </>
      );
    case "folder_open":
      return (
        <>
          <path d="M3.5 8A2.5 2.5 0 0 1 6 5.5h4l2 2H18a2.5 2.5 0 0 1 2.3 1.5" />
          <path d="M4.5 10.5h16l-1.6 6.5A2.5 2.5 0 0 1 16.5 19H7.2a2.5 2.5 0 0 1-2.4-1.9Z" />
        </>
      );
    case "folder_copy":
      return (
        <>
          <path d="M4.5 8A2.5 2.5 0 0 1 7 5.5h4l2 2h4a2.5 2.5 0 0 1 2.5 2.5v6A2.5 2.5 0 0 1 17 18.5H7A2.5 2.5 0 0 1 4.5 16Z" />
          <path d="M8 5.5V4.8A1.8 1.8 0 0 0 6.2 3H4.8A1.8 1.8 0 0 0 3 4.8v9.4A1.8 1.8 0 0 0 4.8 16H5" />
        </>
      );
    case "movie":
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 5v14M16 5v14M4 9h4M16 9h4M4 15h4M16 15h4" />
        </>
      );
    case "image":
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m6 16 3.5-3.5 2.5 2.5 2-2 4 3" />
        </>
      );
    case "description":
      return (
        <>
          <path d="M7 3.5h6l4 4V20.5H7z" />
          <path d="M13 3.5v4h4M9 11h6M9 14.5h6M9 18h4" />
        </>
      );
    case "folder_zip":
      return (
        <>
          <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2H18a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M12 8.5v1.5M12 12v1.5M12 15.5v1.5" />
        </>
      );
    case "draft":
      return (
        <>
          <path d="M4.5 6.5 12 12l7.5-5.5" />
          <rect x="4.5" y="6" width="15" height="12" rx="2" />
        </>
      );
    case "tune":
      return (
        <>
          <path d="M5 6h7M15 6h4M9 6v12M5 18h4M13 18h6M15 18V6" />
        </>
      );
    case "troubleshoot":
      return (
        <>
          <path d="M4.5 18h5l2-3 2 1 3.5-5" />
          <circle cx="8" cy="9" r="2.5" />
          <path d="m18 18 2.5 2.5" />
          <circle cx="17" cy="17" r="3.5" />
        </>
      );
    case "search_off":
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4M4 4l16 16" />
        </>
      );
    case "add_circle":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8M8 12h8" />
        </>
      );
    case "restart_alt":
      return (
        <>
          <path d="M8 8H4v4" />
          <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8" />
        </>
      );
    case "more_horiz":
      return (
        <>
          <circle cx="7" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="17" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </>
      );
    case "edit":
    case "drive_file_rename_outline":
      return (
        <>
          <path d="m4.5 19.5 4-.8 8.4-8.4-3.2-3.2-8.4 8.4Z" />
          <path d="m12.8 6.8 3.2 3.2M4.5 19.5h4.2" />
        </>
      );
    case "check":
    case "check_circle":
      return (
        <>
          {name === "check_circle" ? <circle cx="12" cy="12" r="8" /> : null}
          <path d="m7.5 12.5 3 3 6-7" />
        </>
      );
    case "delete":
      return (
        <>
          <path d="M5 7.5h14M9 7.5V5.5h6v2M8 7.5l.7 11h6.6l.7-11" />
        </>
      );
    case "link":
      return (
        <>
          <path d="M10 13.5 14 9.5" />
          <path d="M8 15.5H6.5a4 4 0 0 1 0-8H10" />
          <path d="M14 8.5h1.5a4 4 0 0 1 0 8H14" />
        </>
      );
    case "share":
      return (
        <>
          <circle cx="6" cy="12" r="2" />
          <circle cx="17.5" cy="6" r="2" />
          <circle cx="17.5" cy="18" r="2" />
          <path d="m7.8 11 7.9-4M7.8 13l7.9 4" />
        </>
      );
    case "difference":
      return (
        <>
          <rect x="5" y="6" width="9" height="9" rx="1.5" />
          <rect x="10" y="9" width="9" height="9" rx="1.5" />
        </>
      );
    case "deselect":
      return (
        <>
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M8 8h8v8H8z" opacity="0.25" />
          <path d="m4 4 16 16" />
        </>
      );
    case "playlist_add":
      return (
        <>
          <path d="M5 8h8M5 12h8M5 16h5M17 11v6M14 14h6" />
        </>
      );
    case "first_page":
      return (
        <>
          <path d="M18 6 12 12l6 6M12 6 6 12l6 6" />
          <path d="M5 6v12" />
        </>
      );
    case "last_page":
      return (
        <>
          <path d="m6 6 6 6-6 6M12 6l6 6-6 6" />
          <path d="M19 6v12" />
        </>
      );
    case "radio_button_unchecked":
      return <circle cx="12" cy="12" r="7" />;
    case "filter_alt":
      return <path d="M4.5 6h15l-6 6v5l-3 1.5V12Z" />;
    case "straighten":
      return (
        <>
          <path d="M5 16h14" />
          <path d="M7 8h10" />
          <path d="M9 12h6" />
        </>
      );
    case "compress":
      return (
        <>
          <path d="M8 8h8M9.5 5.5 12 8l2.5-2.5M9.5 18.5 12 16l2.5 2.5" />
        </>
      );
    case "calendar_today":
      return (
        <>
          <rect x="4.5" y="6" width="15" height="13" rx="2" />
          <path d="M8 4.5v3M16 4.5v3M4.5 10h15" />
        </>
      );
    case "event_busy":
      return (
        <>
          <rect x="4.5" y="6" width="15" height="13" rx="2" />
          <path d="M8 4.5v3M16 4.5v3M4.5 10h15M9 13l6 6M15 13l-6 6" />
        </>
      );
    default:
      return null;
  }
}

export default function Icon({ name, className = "", title = "", fallback = true }) {
  const paths = iconPaths(name);
  if (!paths) {
    return fallback ? <span className={`material-symbols-outlined ${className}`.trim()}>{name}</span> : null;
  }

  return (
    <svg className={`app-icon ${className}`.trim()} {...COMMON_PROPS} role={title ? "img" : "presentation"}>
      {title ? <title>{title}</title> : null}
      {paths}
    </svg>
  );
}
