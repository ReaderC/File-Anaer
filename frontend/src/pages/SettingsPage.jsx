import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import FilePickerDialog from "../components/FilePickerDialog";
import Icon from "../components/Icon";
import SelectMenu from "../components/SelectMenu";
import Toast from "../components/Toast";
import useDirectories from "../hooks/useDirectories";
import useRoots from "../hooks/useRoots";
import useToast from "../hooks/useToast";
import { useI18n } from "../lib/i18n.jsx";
import {
  persistSettingsToServer,
  readCopyHostPathSetting,
  readDuplicateAllowFullSelectionSetting,
  readDuplicateIgnoreList,
  readScanIgnoreList,
  readSearchHiddenSetting,
  readTreemapDetailLevelSetting,
  readSearchPageSizeSetting,
  readSearchIgnoreList,
  readThemeSetting,
  readTreemapFileColorModeSetting,
  writeCopyHostPathSetting,
  writeDuplicateAllowFullSelectionSetting,
  writeDuplicateIgnoreList,
  writeScanIgnoreList,
  writeSearchHiddenSetting,
  writeSearchIgnoreList,
  writeSearchPageSizeSetting,
  writeThemeSetting,
  writeTreemapDetailLevelSetting,
  writeTreemapFileColorModeSetting
} from "../lib/settingsStore";
import { applyThemeMode } from "../lib/theme";

const SEARCH_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { user, canManageCredentials, updateCredentials } = useAuth();
  const roots = useRoots();
  const toast = useToast();
  const [scanIgnore, setScanIgnore] = useState([]);
  const [scanIgnoreInput, setScanIgnoreInput] = useState("");
  const [duplicateIgnore, setDuplicateIgnore] = useState([]);
  const [duplicateIgnoreInput, setDuplicateIgnoreInput] = useState("");
  const [searchIgnore, setSearchIgnore] = useState([]);
  const [searchIgnoreInput, setSearchIgnoreInput] = useState("");
  const [searchHidden, setSearchHidden] = useState(false);
  const [searchPageSize, setSearchPageSize] = useState(50);
  const [treemapFileColorMode, setTreemapFileColorMode] = useState("size");
  const [treemapDetailLevel, setTreemapDetailLevel] = useState("medium");
  const [themeMode, setThemeMode] = useState("system");
  const [copyHostPath, setCopyHostPath] = useState(true);
  const [duplicateAllowFullSelection, setDuplicateAllowFullSelection] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [credentialUsername, setCredentialUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [credentialSubmitting, setCredentialSubmitting] = useState(false);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);
  const [pickerState, setPickerState] = useState(null);

  const hasPendingInputs = Boolean(
    scanIgnoreInput.trim() || duplicateIgnoreInput.trim() || searchIgnoreInput.trim()
  );
  const duplicateSettingsTitle = locale === "en" ? "Duplicate Files" : "重复文件";
  const duplicateIgnoreLabel = locale === "en" ? "Duplicate Ignore List" : "重复文件忽略列表";
  const duplicateIgnoreDesc = locale === "en"
    ? "Excluded from duplicate-file scanning and grouping"
    : "以下内容将不会参与重复文件扫描与分组";
  const languageOptions = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" }
  ];
  const themeOptions = [
    { value: "system", label: t("settings.themeSystem") },
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") }
  ];
  const treemapColorOptions = [
    { value: "size", label: t("settings.treemapFileColorBySize") },
    { value: "type", label: t("settings.treemapFileColorByType") }
  ];
  const treemapDetailOptions = [
    { value: "simple", label: t("settings.treemapDetailSimple") },
    { value: "medium", label: t("settings.treemapDetailMedium") },
    { value: "detailed", label: t("settings.treemapDetailDetailed") }
  ];
  const searchPageSizeOptions = SEARCH_PAGE_SIZE_OPTIONS.map((value) => ({ value, label: String(value) }));
  const rootPaths = roots.items.map((item) => item?.path).filter(Boolean);
  const pickerRoot = pickerState?.root || rootPaths[0] || "";
  const pickerBrowsePath = pickerState?.browsePath || pickerRoot;
  const pickerDirectories = useDirectories(pickerRoot, pickerBrowsePath, true);

  useEffect(() => {
    setScanIgnore(readScanIgnoreList());
    setDuplicateIgnore(readDuplicateIgnoreList());
    setSearchIgnore(readSearchIgnoreList());
    setSearchHidden(readSearchHiddenSetting());
    setSearchPageSize(readSearchPageSizeSetting());
    setTreemapFileColorMode(readTreemapFileColorModeSetting());
    setTreemapDetailLevel(readTreemapDetailLevelSetting());
    setThemeMode(readThemeSetting());
    setCopyHostPath(readCopyHostPathSetting());
    setDuplicateAllowFullSelection(readDuplicateAllowFullSelectionSetting());
  }, []);

  useEffect(() => {
    applyThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    setCredentialUsername(user?.username ?? "");
  }, [user?.username]);

  function addScanIgnore() {
    addIgnoreEntry(scanIgnoreInput, setScanIgnore, setScanIgnoreInput, setHasUnsavedChanges);
  }

  function addDuplicateIgnore() {
    addIgnoreEntry(duplicateIgnoreInput, setDuplicateIgnore, setDuplicateIgnoreInput, setHasUnsavedChanges);
  }

  function addSearchIgnore() {
    addIgnoreEntry(searchIgnoreInput, setSearchIgnore, setSearchIgnoreInput, setHasUnsavedChanges);
  }

  function openIgnorePicker(target) {
    const firstRoot = rootPaths[0] || "";
    setPickerState({
      target,
      root: firstRoot,
      browsePath: firstRoot,
      selectedPath: firstRoot
    });
  }

  function handlePickerConfirm(selectedPath) {
    if (!pickerState?.target || !selectedPath) {
      setPickerState(null);
      return;
    }
    const applyMap = {
      scan: setScanIgnore,
      duplicate: setDuplicateIgnore,
      search: setSearchIgnore
    };
    const setList = applyMap[pickerState.target];
    if (typeof setList === "function") {
      setList((current) => addUniqueEntry(current, selectedPath));
      setHasUnsavedChanges(true);
    }
    setPickerState(null);
  }

  async function handleSave() {
    const finalScanIgnore = finalizeIgnoreList(scanIgnore, scanIgnoreInput);
    const finalDuplicateIgnore = finalizeIgnoreList(duplicateIgnore, duplicateIgnoreInput);
    const finalSearchIgnore = finalizeIgnoreList(searchIgnore, searchIgnoreInput);

    setScanIgnore(finalScanIgnore);
    setDuplicateIgnore(finalDuplicateIgnore);
    setSearchIgnore(finalSearchIgnore);
    setScanIgnoreInput("");
    setDuplicateIgnoreInput("");
    setSearchIgnoreInput("");

    writeScanIgnoreList(finalScanIgnore);
    writeDuplicateIgnoreList(finalDuplicateIgnore);
    writeSearchIgnoreList(finalSearchIgnore);
    writeSearchHiddenSetting(searchHidden);
    writeSearchPageSizeSetting(searchPageSize);
    writeTreemapFileColorModeSetting(treemapFileColorMode);
    writeTreemapDetailLevelSetting(treemapDetailLevel);
    writeThemeSetting(themeMode);
    writeCopyHostPathSetting(copyHostPath);
    writeDuplicateAllowFullSelectionSetting(duplicateAllowFullSelection);
    setSettingsSubmitting(true);
    try {
      await persistSettingsToServer();
      setHasUnsavedChanges(false);
      toast.showToast(t("messages.settingsSaved"));
    } catch (error) {
      toast.showToast(error?.message || t("messages.requestFailed"));
    } finally {
      setSettingsSubmitting(false);
    }
  }

  async function handleCredentialsSave() {
    if (!canManageCredentials) {
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.showToast(t("settings.passwordMismatch"));
      return;
    }

    setCredentialSubmitting(true);
    try {
      await updateCredentials({
        username: credentialUsername,
        currentPassword,
        newPassword
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.showToast(t("messages.credentialsUpdated"));
    } catch (error) {
      toast.showToast(localizeCredentialError(error?.message, locale, t));
    } finally {
      setCredentialSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="settings-header">
        <div>
          <h2>{t("settings.title")}</h2>
        </div>
        <button
          type="button"
          className="settings-primary-button"
          onClick={handleSave}
          disabled={settingsSubmitting || (!hasUnsavedChanges && !hasPendingInputs)}
        >
          {t("actions.save")}
        </button>
      </div>

      <section className="settings-grid">
        <div className="card settings-card">
          <div className="settings-card-title">
            <Icon name="tune" className="settings-card-icon tone-primary" />
            <h3>{t("settings.general")}</h3>
          </div>
          <div className="settings-card-body">
            <div className="settings-row">
              <div>
                <div className="settings-label">{t("settings.language")}</div>
                <div className="settings-help">{t("settings.languageDesc")}</div>
              </div>
              <div className="settings-select-shell">
                <SelectMenu
                  value={locale}
                  options={languageOptions}
                  onChange={(value) => {
                    setLocale(value);
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">{t("settings.theme")}</div>
                <div className="settings-help">{t("settings.themeDesc")}</div>
              </div>
              <div className="settings-select-shell">
                <SelectMenu
                  value={themeMode}
                  options={themeOptions}
                  onChange={(value) => {
                    setThemeMode(value);
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">{t("settings.treemapFileColorMode")}</div>
                <div className="settings-help">{t("settings.treemapFileColorModeDesc")}</div>
              </div>
              <div className="settings-select-shell">
                <SelectMenu
                  value={treemapFileColorMode}
                  options={treemapColorOptions}
                  onChange={(value) => {
                    setTreemapFileColorMode(value);
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">{t("settings.treemapDetailLevel")}</div>
                <div className="settings-help">{t("settings.treemapDetailLevelDesc")}</div>
              </div>
              <div className="settings-select-shell">
                <SelectMenu
                  value={treemapDetailLevel}
                  options={treemapDetailOptions}
                  onChange={(value) => {
                    setTreemapDetailLevel(value);
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">{t("settings.copyPathMode")}</div>
                <div className="settings-help">{t("settings.copyPathModeDesc")}</div>
              </div>
              <label className="settings-toggle-row">
                <span>{t("settings.copyHostPathEnabled")}</span>
                <input
                  type="checkbox"
                  checked={copyHostPath}
                  onChange={(event) => {
                    setCopyHostPath(event.target.checked);
                    setHasUnsavedChanges(true);
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-title">
            <Icon name="lock" className="settings-card-icon tone-danger" />
            <h3>{t("settings.accountSecurity")}</h3>
          </div>
          <div className="settings-card-body">
            <div className="settings-help">{t("settings.accountSecurityDesc")}</div>
            <label className="settings-field">
              <span>{t("settings.accountUsername")}</span>
              <input
                value={credentialUsername}
                onChange={(event) => setCredentialUsername(event.target.value)}
                disabled={!canManageCredentials || credentialSubmitting}
              />
            </label>
            <label className="settings-field">
              <span>{t("settings.currentPassword")}</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="••••••••"
                disabled={!canManageCredentials || credentialSubmitting}
              />
            </label>
            <div className="settings-field-row">
              <label className="settings-field">
                <span>{t("settings.newPassword")}</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={t("settings.newPasswordPlaceholder")}
                  disabled={!canManageCredentials || credentialSubmitting}
                />
              </label>
              <label className="settings-field">
                <span>{t("settings.confirmNewPassword")}</span>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                  placeholder={t("settings.confirmNewPasswordPlaceholder")}
                  disabled={!canManageCredentials || credentialSubmitting}
                />
              </label>
            </div>
            {canManageCredentials ? (
              <button
                type="button"
                className="settings-primary-button"
                onClick={handleCredentialsSave}
                disabled={
                  credentialSubmitting ||
                  !credentialUsername.trim() ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmNewPassword
                }
              >
                {credentialSubmitting ? t("settings.updatingCredentials") : t("settings.changePassword")}
              </button>
            ) : (
              <div className="settings-help">{t("settings.credentialsManagedByEnv")}</div>
            )}
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-title">
            <Icon name="troubleshoot" className="settings-card-icon tone-secondary" />
            <h3>{t("settings.scanning")}</h3>
          </div>
          <div className="settings-card-body">
            <div className="settings-label">{t("settings.ignoreList")}</div>
            <div className="settings-chip-list settings-chip-list-scroll">
              {scanIgnore.map((item) => (
                <IgnoreRow
                  key={item}
                  icon="folder"
                  value={item}
                  onRemove={() => {
                    setScanIgnore((current) => current.filter((entry) => entry !== item));
                    setHasUnsavedChanges(true);
                  }}
                />
              ))}
              <div className="settings-add-row">
                <input
                  value={scanIgnoreInput}
                  onChange={(event) => setScanIgnoreInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addScanIgnore();
                    }
                  }}
                  placeholder="/path/to/ignore"
                />
                <button type="button" className="settings-link-button" onClick={addScanIgnore}>
                  <Icon name="add_circle" />
                  {t("settings.addFolder")}
                </button>
                <button type="button" className="settings-link-button" onClick={() => openIgnorePicker("scan")}>
                  <Icon name="folder_open" />
                  {t("labels.select")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-title">
            <Icon name="content_copy" className="settings-card-icon tone-secondary" />
            <h3>{duplicateSettingsTitle}</h3>
          </div>
          <div className="settings-card-body">
            <div className="settings-label">{duplicateIgnoreLabel}</div>
            <div className="settings-help">{duplicateIgnoreDesc}</div>
            <label className="settings-toggle-row">
              <span>{t("settings.duplicateAllowFullSelection")}</span>
              <input
                type="checkbox"
                checked={duplicateAllowFullSelection}
                onChange={(event) => {
                  setDuplicateAllowFullSelection(event.target.checked);
                  setHasUnsavedChanges(true);
                }}
              />
            </label>
            <div className="settings-help">{t("settings.duplicateAllowFullSelectionDesc")}</div>
            <div className="settings-chip-list settings-chip-list-scroll">
              {duplicateIgnore.map((item) => (
                <IgnoreRow
                  key={item}
                  icon="folder_copy"
                  value={item}
                  onRemove={() => {
                    setDuplicateIgnore((current) => current.filter((entry) => entry !== item));
                    setHasUnsavedChanges(true);
                  }}
                />
              ))}
              <div className="settings-add-row">
                <input
                  value={duplicateIgnoreInput}
                  onChange={(event) => setDuplicateIgnoreInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addDuplicateIgnore();
                    }
                  }}
                  placeholder="/path/to/ignore"
                />
                <button type="button" className="settings-link-button" onClick={addDuplicateIgnore}>
                  <Icon name="add_circle" />
                  {t("settings.addExclusion")}
                </button>
                <button type="button" className="settings-link-button" onClick={() => openIgnorePicker("duplicate")}>
                  <Icon name="folder_open" />
                  {t("labels.select")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-title">
            <Icon name="search_off" className="settings-card-icon tone-primary" />
            <h3>{t("settings.searchSettings")}</h3>
          </div>
          <div className="settings-card-body">
            <div className="settings-label">{t("settings.searchIgnore")}</div>
            <div className="settings-help">{t("settings.searchIgnoreDesc")}</div>
            <label className="settings-toggle-row">
              <span>{t("settings.includeHidden")}</span>
              <input
                type="checkbox"
                checked={searchHidden}
                onChange={(event) => {
                  setSearchHidden(event.target.checked);
                  setHasUnsavedChanges(true);
                }}
                />
              </label>
            <div className="settings-row">
              <div>
                <div className="settings-label">{t("settings.searchPageSize")}</div>
                <div className="settings-help">{t("settings.searchPageSizeDesc")}</div>
              </div>
              <div className="settings-select-shell">
                <SelectMenu
                  value={searchPageSize}
                  options={searchPageSizeOptions}
                  onChange={(value) => {
                    setSearchPageSize(Number(value));
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
            </div>
            <div className="settings-chip-list settings-chip-list-scroll">
              {searchIgnore.map((item) => (
                <IgnoreRow
                  key={item}
                  icon="description"
                  value={item}
                  onRemove={() => {
                    setSearchIgnore((current) => current.filter((entry) => entry !== item));
                    setHasUnsavedChanges(true);
                  }}
                />
              ))}
              <div className="settings-add-row">
                <input
                  value={searchIgnoreInput}
                  onChange={(event) => setSearchIgnoreInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSearchIgnore();
                    }
                  }}
                  placeholder="*.log or /path"
                />
                <button type="button" className="settings-link-button" onClick={addSearchIgnore}>
                  <Icon name="add_circle" />
                  {t("settings.addExclusion")}
                </button>
                <button type="button" className="settings-link-button" onClick={() => openIgnorePicker("search")}>
                  <Icon name="folder_open" />
                  {t("labels.select")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FilePickerDialog
        open={Boolean(pickerState)}
        mode="file"
        roots={roots.items}
        root={pickerRoot}
        browsePath={pickerBrowsePath}
        selectedPath={pickerState?.selectedPath || pickerBrowsePath}
        ignoreList={[]}
        title={pickerTitleForTarget(pickerState?.target, locale)}
        searchPlaceholder={locale === "en" ? "Search files or folders..." : "搜索文件或目录..."}
        directories={pickerDirectories}
        onClose={() => setPickerState(null)}
        onConfirm={handlePickerConfirm}
        onRootChange={(root) => setPickerState((current) => current ? ({
          ...current,
          root,
          browsePath: root,
          selectedPath: root
        }) : current)}
        onBrowsePathChange={(browsePath) => setPickerState((current) => current ? ({
          ...current,
          browsePath,
          selectedPath: browsePath
        }) : current)}
      />

      <Toast message={toast.message} />
    </div>
  );
}

function pickerTitleForTarget(target, locale) {
  if (locale === "en") {
    switch (target) {
      case "scan":
        return "Select scan exclusion";
      case "duplicate":
        return "Select duplicate exclusion";
      case "search":
        return "Select search exclusion";
      default:
        return "Select path";
    }
  }
  switch (target) {
    case "scan":
      return "选择扫描排除项";
    case "duplicate":
      return "选择重复文件排除项";
    case "search":
      return "选择搜索排除项";
    default:
      return "选择路径";
  }
}

function IgnoreRow({ icon, value, onRemove }) {
  return (
    <div className="settings-chip-row">
      <Icon name={icon} fallback={false} />
      <span>{value}</span>
      <button type="button" className="settings-inline-button" onClick={onRemove} aria-label="Remove">
        ×
      </button>
    </div>
  );
}

function addUniqueEntry(list, entry) {
  const normalized = entry.trim();
  if (!normalized) {
    return list;
  }
  return list.includes(normalized) ? list : [...list, normalized];
}

function addIgnoreEntry(inputValue, setList, setInput, setDirty) {
  const next = inputValue.trim();
  if (!next) {
    return;
  }
  setList((current) => addUniqueEntry(current, next));
  setInput("");
  setDirty(true);
}

function finalizeIgnoreList(list, inputValue) {
  return inputValue.trim() ? addUniqueEntry(list, inputValue) : list;
}

function localizeCredentialError(message, locale, t) {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized) {
    return t("messages.requestFailed");
  }
  if (normalized === "current password is incorrect") {
    return locale === "en" ? "Current password is incorrect." : "当前密码不正确。";
  }
  if (normalized === "new password must be at least 8 characters") {
    return locale === "en" ? "New password must be at least 8 characters." : "新密码长度至少需要 8 个字符。";
  }
  if (normalized === "invalid credentials update request") {
    return locale === "en" ? "Credentials update request is invalid." : "更新账户信息的请求无效。";
  }
  if (normalized === "authentication required") {
    return locale === "en" ? "Authentication is required." : "需要先登录。";
  }
  if (normalized === "initial setup required") {
    return locale === "en" ? "Initial setup is required first." : "请先完成初始化设置。";
  }
  return message || t("messages.requestFailed");
}
