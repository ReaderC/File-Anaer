import { memo } from "react";
import Icon from "../Icon.jsx";

function DuplicateGroupMenu({
  allowFullGroupSelection,
  applyQuickSelectionToGroup,
  clearGroupSelection,
  group,
  groupMenuRef,
  handleCopyGroupPaths,
  handleIgnoreGroup,
  handleSkipGroup,
  invertGroupSelection,
  isFullGroupSelected,
  locale,
  open,
  setOpenGroupMenuHash,
  toggleFullGroupSelection
}) {
  return (
    <div className="duplicates-group-menu-shell" ref={open ? groupMenuRef : null}>
      <button
        type="button"
        className={`panel-toggle-button duplicates-group-menu-trigger ${open ? "is-active" : ""}`}
        onClick={() => setOpenGroupMenuHash((current) => current === group.hash ? "" : group.hash)}
      >
        <Icon name="more_horiz" />
        <span>{locale === "en" ? "Group Actions" : "组操作"}</span>
      </button>
      {open ? (
        <div className="duplicates-group-menu">
          <button type="button" className="duplicates-group-menu-item" onClick={() => { applyQuickSelectionToGroup(group, "first"); setOpenGroupMenuHash(""); }}>
            {locale === "en" ? "Keep First In Group" : "本组保留第一项"}
          </button>
          <button type="button" className="duplicates-group-menu-item" onClick={() => { applyQuickSelectionToGroup(group, "last"); setOpenGroupMenuHash(""); }}>
            {locale === "en" ? "Keep Last In Group" : "本组保留最后一项"}
          </button>
          <button type="button" className="duplicates-group-menu-item" onClick={() => { applyQuickSelectionToGroup(group, "newest"); setOpenGroupMenuHash(""); }}>
            {locale === "en" ? "Keep Newest In Group" : "本组保留较新"}
          </button>
          <button type="button" className="duplicates-group-menu-item" onClick={() => { applyQuickSelectionToGroup(group, "oldest"); setOpenGroupMenuHash(""); }}>
            {locale === "en" ? "Keep Oldest In Group" : "本组保留较旧"}
          </button>
          <button type="button" className="duplicates-group-menu-item" onClick={() => { invertGroupSelection(group); setOpenGroupMenuHash(""); }}>
            {locale === "en" ? "Invert Group Selection" : "反选本组"}
          </button>
          <button type="button" className="duplicates-group-menu-item" onClick={() => { clearGroupSelection(group); setOpenGroupMenuHash(""); }}>
            {locale === "en" ? "Clear Group Selection" : "清空本组勾选"}
          </button>
          <button type="button" className="duplicates-group-menu-item" onClick={() => { handleCopyGroupPaths(group, false); setOpenGroupMenuHash(""); }}>
            {locale === "en" ? "Copy All Paths In Group" : "复制本组全部路径"}
          </button>
          <button type="button" className="duplicates-group-menu-item" onClick={() => { handleCopyGroupPaths(group, true); setOpenGroupMenuHash(""); }}>
            {locale === "en" ? "Copy Selected Paths In Group" : "复制本组已勾选路径"}
          </button>
          {allowFullGroupSelection ? (
            <button type="button" className="duplicates-group-menu-item" onClick={() => { toggleFullGroupSelection(group); setOpenGroupMenuHash(""); }}>
              {isFullGroupSelected
                ? (locale === "en" ? "Clear Group Selection" : "取消当前组选择")
                : (locale === "en" ? "Select Entire Group" : "选中整个分组")}
            </button>
          ) : null}
          <button type="button" className="duplicates-group-menu-item" onClick={() => handleSkipGroup(group)}>
            {locale === "en" ? "Skip This Group" : "跳过当前组"}
          </button>
          <button type="button" className="duplicates-group-menu-item is-danger" onClick={() => handleIgnoreGroup(group)}>
            {locale === "en" ? "Ignore This Group" : "忽略当前组"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default memo(DuplicateGroupMenu);
