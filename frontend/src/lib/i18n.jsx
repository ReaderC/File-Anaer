import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { readLocaleSetting, writeLocaleSetting } from "./settingsStore";

const STRINGS = {
  zh: {
    app: {
      nav: {
        analysis: "分析",
        search: "搜索",
        duplicates: "重复文件",
        settings: "设置",
        language: "语言"
      },
      titles: {
        analysis: "磁盘分析",
        search: "文件搜索",
        duplicates: "重复文件",
        settings: "设置与偏好"
      },
      loadingPage: "页面加载中..."
    },
    actions: {
      history: "历史",
      clear: "清理",
      stop: "停止",
      removeDuplicates: "删除副本",
      renameDuplicates: "重命名",
      hardlinkDuplicates: "硬链接",
      symlinkDuplicates: "软链接",
      reflinkDuplicates: "Reflink",
      startScan: "开始扫描",
      reset: "重置",
      executeSearch: "执行搜索",
      previous: "上一页",
      next: "下一页",
      export: "导出",
      preview: "预演",
      exportSearchResults: "导出结果",
      exportDuplicateResults: "导出结果",
      copyPath: "复制路径",
      save: "保存",
      delete: "删除",
      clearHistory: "清空"
      ,rescan: "重新扫描"
    },
    labels: {
      viewAll: "全部",
      viewFolders: "文件夹",
      viewFiles: "文件",
      scanRoot: "扫描根目录",
      browseFolder: "浏览目录",
      scanDepth: "扫描深度",
      topFiles: "最大文件数",
      path: "路径",
      extensions: "扩展名",
      minSizeBytes: "最小字节数",
      maxSizeBytes: "最大字节数",
      modifiedAfter: "修改时间起",
      modifiedBefore: "修改时间止",
      fileNamePath: "文件名与路径",
      folderNamePath: "文件夹名与路径",
      size: "大小",
      type: "类型",
      items: "数量",
      modified: "修改时间",
      action: "操作",
      select: "选择",
      searchInput: "搜索文件、文件夹或扩展名..."
    },
    hints: {
      visible: "可见",
      groups: "组",
      page: "页",
      totalItems: "条"
    },
    messages: {
      loadingData: "数据加载中...",
      requestFailed: "请求失败",
      settingsSaved: "设置已保存",
      excludedPath: "当前目录在排除列表中，无法直接访问。",
      historyTitle: "最近分析",
      noHistory: "暂无历史",
      historySaved: "历史已保存",
      historyRestored: "历史已恢复",
      historyCleared: "历史已清空",
      historyRemoved: "历史已删除",
      historySaveFailed: "历史保存失败",
      duplicateRescanStarted: "已开始重新扫描重复文件。",
      invalidModifiedRange: "修改时间范围无效，开始时间不能晚于结束时间。",
      copySuccess: "已复制路径",
      copyHostPathSuccess: "已复制宿主机路径",
      copyHostPathFallback: "未配置宿主机路径映射，已回退复制容器路径",
      copyFailed: "复制失败",
      credentialsUpdated: "账户凭据已更新",
      duplicateActionSuccess: "重复文件操作已完成",
      duplicateActionPreviewReady: "已生成预演结果，请确认后再正式执行。",
      exportStarted: "正在导出结果。",
      exportCompleted: "导出已开始。",
      duplicateActionRescan: "操作已完成，建议重新扫描以刷新结果。",
      duplicateActionFailed: "重复文件操作失败",
      duplicateSelectionEmpty: "请先勾选要处理的重复文件副本。",
      duplicateRenameNoChanges: "当前选中的文件名已经满足当前规则，无需执行重命名。",
      duplicateRenameNameRequired: "请输入重命名时要使用的文件名。",
      duplicateActionReadOnly: "当前挂载为只读，不能执行删除或链接操作",
      duplicateGroupKeepRequired: "每组重复文件至少保留一个未勾选文件作为保留主体；如确需整组全选，请先在设置中开启高风险操作选项。",
      duplicateKeeperRequiredForLink: "硬链接、软链接和 Reflink 操作都必须为每组保留至少一个未勾选文件作为主体。",
      duplicateFullSelectionRiskEnabled: "已开启高风险模式：允许整组全选执行操作，请确认你了解后果。"
    },
    auth: {
      title: "登录到工作区",
      subtitle: "精准管理你的挂载文件与索引",
      description: "使用管理员账号登录后才能访问分析、搜索和设置页面。",
      username: "用户名",
      usernamePlaceholder: "输入管理员用户名",
      password: "密码",
      passwordPlaceholder: "输入密码",
      signIn: "登录",
      signingIn: "登录中...",
      signOut: "退出登录",
      showPassword: "显示密码",
      hidePassword: "隐藏密码"
    },
    setup: {
      title: "初始化管理员账号",
      subtitle: "首次启动需要先完成安全配置",
      description: "设置完成后，系统会将加密后的密码配置持久化到容器状态目录。",
      username: "管理员用户名",
      password: "管理员密码",
      passwordHint: "至少 8 个字符",
      confirmPassword: "确认密码",
      passwordMismatch: "两次输入的密码不一致",
      submit: "完成初始化",
      submitting: "初始化中..."
    },
    analysis: {
      description: "扫描一次挂载目录，然后在前端本地钻取文件夹。",
      loading: "正在扫描磁盘...",
      noAnalysisTitle: "暂无分析",
      noAnalysisDesc: "选择挂载路径并开始扫描以生成树图、文件夹列表和最大文件表。",
      treemapTitle: "占用树图",
      spaceByType: "按文件类型占用",
      foldersScope: "当前范围内的文件夹",
      topLargestFiles: "最大文件列表",
      noItemsInFilter: "当前筛选没有内容。",
      noFilesInScope: "当前范围没有文件。",
      scanDepthPlaceholder: "0 或为空 = 全部层级",
      topFilesPlaceholder: "0 或为空 = 不限制",
      depthAll: "全部",
      historyMeta: "{size} · 深度 {depth} · {time}"
    },
    settings: {
      breadcrumbHome: "首页",
      breadcrumbSettings: "设置",
      title: "设置与偏好",
      subtitle: "配置 File Anaer 环境参数",
      general: "通用",
      language: "语言",
      languageDesc: "选择界面显示语言",
      theme: "主题",
      themeDesc: "选择跟随系统、浅色或深色界面风格",
      themeSystem: "跟随系统",
      themeLight: "浅色",
      themeDark: "深色",
      treemapFileColorMode: "树图文件配色",
      treemapFileColorModeDesc: "选择按文件类型或按同级相对大小为文件块着色",
      treemapDetailLevel: "默认展开层级",
      treemapDetailLevelDesc: "控制树图首次展示时默认展开到多深。越详细，初始可见的子块越多，但大目录下可能更卡。",
      treemapFileColorBySize: "按大小",
      treemapFileColorByType: "按文件类型",
      treemapDetailSimple: "1 层",
      treemapDetailMedium: "2 层",
      treemapDetailDetailed: "3 层",
      copyPathMode: "复制路径优先级",
      copyPathModeDesc: "Docker 部署时优先复制宿主机路径，未配置映射时会回退到容器路径",
      copyHostPathEnabled: "优先复制宿主机路径",
      duplicateAllowFullSelection: "允许整组全选执行高风险操作",
      duplicateAllowFullSelectionDesc: "默认每组至少保留一个未勾选文件，作为硬链接、软链接或 Reflink 的主体。开启后允许整组全选，但删除可能直接清空整组文件，链接类操作仍必须自行保留主体文件。请确认你了解风险后再开启。",
      scanning: "扫描与分析",
      accountSecurity: "账户安全",
      accountSecurityDesc: "修改管理员用户名和登录密码。当前密码校验通过后才会生效。",
      accountUsername: "管理员用户名",
      currentPassword: "当前密码",
      newPassword: "新密码",
      newPasswordPlaceholder: "输入新密码",
      confirmNewPassword: "确认新密码",
      confirmNewPasswordPlaceholder: "再次输入新密码",
      changePassword: "更新账户",
      updatingCredentials: "更新中...",
      passwordMismatch: "两次输入的新密码不一致",
      credentialsManagedByEnv: "当前管理员凭据由环境变量预置，运行时不能在设置页修改。",
      ignoreList: "忽略列表",
      addFolder: "添加目录",
      searchSettings: "搜索设置",
      searchIgnore: "搜索忽略列表",
      searchIgnoreDesc: "以下内容将不会被搜索或索引",
      searchPageSize: "搜索页每页条数",
      searchPageSizeDesc: "控制搜索结果每页展示多少条记录",
      includeHidden: "搜索隐藏文件",
      addExclusion: "添加排除规则"
    },
    search: {
      description: "基于 fd 的只读搜索，支持大小与时间过滤。",
      noSearchTitle: "暂无搜索",
      noSearchDesc: "输入关键词并设置可选过滤条件，然后执行搜索。",
      loading: "正在搜索已挂载文件...",
      resultsTitle: "搜索结果",
      empty: "当前条件未匹配任何文件或文件夹。",
      pageSize: "每页条数",
      exportCurrentPage: "导出当前页",
      exportAll: "导出当前查询",
      exportHint: "导出会按照当前查询条件和排序方式生成 CSV。"
    },
    duplicates: {
      description: "基于 fclones 查找重复文件组，先提供只读查找与预览。",
      findDuplicates: "查找重复文件",
      loading: "正在扫描重复文件...",
      loadingHint: "文件量较大时扫描会比较慢，请耐心等待；如果不想继续扫描，可以随时点击“停止”。",
      historyMeta: "{size} · {groups} 组 · {time}",
      resultsTitle: "重复文件组",
      groups: "组",
      filesPerGroup: "个文件",
      foundSummary: "已找到 {groups} 组，共 {files} 个重复文件",
      wastedSpace: "可回收空间",
      eachSize: "单文件 {size}",
      minSizeBytes: "最小字节数",
      searchPlaceholder: "搜索重复文件...",
      filterType: "类型",
      filterSize: "大小",
      filterTime: "时间",
      sortOrder: "排序",
      renameMode: "重命名",
      renameScope: "范围",
      renameCopiesOnly: "仅副本",
      renameWholeGroup: "整组统一",
      renameUseKeeper: "跟随保留文件名",
      renameManual: "手动命名",
      renameInputLabel: "统一文件名",
      renameInputPlaceholder: "输入新的文件名",
      previewSummary: "预演摘要",
      previewAffectedGroups: "涉及分组",
      previewAffectedFiles: "涉及文件",
      previewReclaimedSpace: "预计影响空间",
      previewNoChanges: "当前规则下没有可执行的变更。",
      dryRunNote: "预演不会修改任何文件，只用于确认本次操作会影响哪些内容。",
      originalCandidate: "优先保留",
      keeperCandidate: "当前保留",
      selectionSummary: "已选择 {files} 个副本文件，来自 {groups} 组",
      readOnlyHint: "当前挂载为只读，不能执行删除或链接操作",
      insightsTitle: "重复文件类型",
      tipBadge: "优化建议",
      tipTitle: "优先清理高收益重复组",
      tipDescription: "当前结果理论上可释放 {size} 空间，建议先处理大文件组。",
      emptyTitle: "暂无重复文件结果",
      emptyDesc: "选择扫描目录并开始查找重复文件。",
      empty: "当前范围没有找到重复文件。",
      reflinkBadge: "已共享块",
      reflinkBadgeTooltip: "该文件之前已经执行过 Reflink/共享块优化。之后再次扫描时它通常仍会被识别为重复内容，再次执行 Reflink 一般也不会继续节省空间。",
      reflinkWarningTitle: "Reflink 使用提示",
      reflinkWarningBody: "Reflink 是否可用取决于当前文件系统、内核能力、挂载方式和宿主环境。已共享块的重复文件再次扫描时通常仍会显示为重复；再次执行 Reflink 一般不会继续节省空间。请在了解 Reflink 的特性，并确认自己的环境知道如何验证共享块是否生效后再使用。",
      type: {
        all: "全部",
        image: "图片",
        video: "视频",
        document: "文档",
        archive: "压缩包",
        other: "其他"
      },
      size: {
        all: "全部",
        "1mb": ">1 MB",
        "10mb": ">10 MB",
        "100mb": ">100 MB",
        "1gb": ">1 GB"
      },
      time: {
        all: "全部",
        "7d": "7天内",
        "30d": "30天内",
        "90d": "90天内"
      },
      sort: {
        timeDesc: "时间降序",
        timeAsc: "时间升序",
        sizeDesc: "大小降序",
        sizeAsc: "大小升序"
      }
    },
    status: {
      api: "API",
      gdu: "GDU",
      fd: "FD",
      fclones: "FCLONES",
      ready: "就绪",
      offline: "离线",
      found: "已找到",
      missing: "未找到"
    }
  },
  en: {
    app: {
      nav: {
        analysis: "Analysis",
        search: "Search",
        duplicates: "Duplicates",
        settings: "Settings",
        language: "Language"
      },
      titles: {
        analysis: "Disk Analysis",
        search: "File Search",
        duplicates: "Duplicate Files",
        settings: "Settings & Preferences"
      },
      loadingPage: "Loading page..."
    },
    actions: {
      history: "History",
      clear: "Clear",
      stop: "Stop",
      removeDuplicates: "Delete Copies",
      renameDuplicates: "Rename",
      hardlinkDuplicates: "Hardlink",
      symlinkDuplicates: "Symlink",
      reflinkDuplicates: "Reflink",
      startScan: "Start Scan",
      reset: "Reset",
      executeSearch: "Execute Search",
      previous: "Previous",
      next: "Next",
      export: "Export",
      preview: "Preview",
      exportSearchResults: "Export Results",
      exportDuplicateResults: "Export Results",
      copyPath: "Copy Path",
      save: "Save",
      delete: "Delete",
      clearHistory: "Clear"
      ,rescan: "Rescan"
    },
    labels: {
      viewAll: "All",
      viewFolders: "Folders",
      viewFiles: "Files",
      scanRoot: "Scan Root",
      browseFolder: "Browse Folder",
      scanDepth: "Scan Depth",
      topFiles: "Top Files",
      path: "Path",
      extensions: "Extensions",
      minSizeBytes: "Min Size Bytes",
      maxSizeBytes: "Max Size Bytes",
      modifiedAfter: "Modified From",
      modifiedBefore: "Modified Until",
      fileNamePath: "File Name & Path",
      folderNamePath: "Folder Name & Path",
      size: "Size",
      type: "Type",
      items: "Items",
      modified: "Modified",
      action: "Action",
      select: "Select",
      searchInput: "Search files, folders, or extensions..."
    },
    hints: {
      visible: "Visible",
      groups: "groups",
      page: "Page",
      totalItems: "items"
    },
    messages: {
      loadingData: "Loading data...",
      requestFailed: "Request failed",
      settingsSaved: "Settings saved.",
      excludedPath: "This path is excluded and cannot be opened directly.",
      historyTitle: "Recent Analyses",
      noHistory: "No history yet.",
      historySaved: "History saved.",
      historyRestored: "History restored.",
      historyCleared: "History cleared.",
      historyRemoved: "History removed.",
      historySaveFailed: "History save failed.",
      duplicateRescanStarted: "Duplicate rescan started.",
      invalidModifiedRange: "Invalid modified time range. The start time cannot be later than the end time.",
      copySuccess: "Path copied.",
      copyHostPathSuccess: "Host path copied.",
      copyHostPathFallback: "Host path mapping is not configured, fell back to container path.",
      copyFailed: "Copy failed.",
      credentialsUpdated: "Account credentials updated.",
      duplicateActionSuccess: "Duplicate operation completed.",
      duplicateActionPreviewReady: "Preview generated. Review it before running the real action.",
      exportStarted: "Export is being prepared.",
      exportCompleted: "Export started.",
      duplicateActionRescan: "Operation completed. Rescan to refresh the results.",
      duplicateActionFailed: "Duplicate operation failed.",
      duplicateSelectionEmpty: "Select duplicate copy files first.",
      duplicateRenameNoChanges: "The selected files already match the current rename rule. No rename changes are needed.",
      duplicateRenameNameRequired: "Enter the file name to use for renaming.",
      duplicateActionReadOnly: "This mount is read-only, so delete and link actions are unavailable.",
      duplicateGroupKeepRequired: "Keep at least one file unchecked in each duplicate group so it can remain as the keeper. If you truly need to select every file, enable the high-risk option in Settings first.",
      duplicateKeeperRequiredForLink: "Hardlink, symlink, and reflink actions require at least one unchecked keeper file in every selected group.",
      duplicateFullSelectionRiskEnabled: "High-risk mode is enabled: selecting every file in a group is allowed. Make sure you understand the consequences."
    },
    auth: {
      title: "Sign In to File Anaer",
      subtitle: "Manage mounted files and indexes with precision",
      description: "Use the administrator account to access analysis, search, and settings.",
      username: "Username",
      usernamePlaceholder: "Enter the admin username",
      password: "Password",
      passwordPlaceholder: "Enter your password",
      signIn: "Sign In",
      signingIn: "Signing in...",
      signOut: "Sign Out",
      showPassword: "Show password",
      hidePassword: "Hide password"
    },
    setup: {
      title: "Create the Administrator Account",
      subtitle: "Finish the first-run security setup",
      description: "The app will persist only the encrypted password hash in its state directory.",
      username: "Admin Username",
      password: "Admin Password",
      passwordHint: "At least 8 characters",
      confirmPassword: "Confirm Password",
      passwordMismatch: "The passwords do not match.",
      submit: "Finish Setup",
      submitting: "Setting up..."
    },
    analysis: {
      description: "Scan a mounted path once, then drill into folders locally using the returned tree data.",
      loading: "Scanning disk...",
      noAnalysisTitle: "No analysis yet",
      noAnalysisDesc: "Choose a mounted path and start a scan to populate the treemap, folder list, and top file table.",
      treemapTitle: "Occupancy Treemap",
      spaceByType: "Space by File Type",
      foldersScope: "Folders in Current Scope",
      topLargestFiles: "Top Largest Files",
      noItemsInFilter: "No items in this filter mode.",
      noFilesInScope: "No files found in the current scope.",
      scanDepthPlaceholder: "0 or empty = all",
      topFilesPlaceholder: "0 or empty = all",
      depthAll: "all",
      historyMeta: "{size} · depth {depth} · {time}"
    },
    settings: {
      breadcrumbHome: "Home",
      breadcrumbSettings: "Settings",
      title: "Settings & Preferences",
      subtitle: "Configure File Anaer environment",
      general: "General",
      language: "Language",
      languageDesc: "Choose your interface language",
      theme: "Theme",
      themeDesc: "Choose system, light, or dark appearance",
      themeSystem: "System",
      themeLight: "Light",
      themeDark: "Dark",
      treemapFileColorMode: "Treemap File Colors",
      treemapFileColorModeDesc: "Color file tiles by file type or by relative size within the current sibling group",
      treemapDetailLevel: "Default Expand Depth",
      treemapDetailLevelDesc: "Controls how deep the treemap expands by default on first render. More detail shows more child blocks up front, but may feel slower on large trees.",
      treemapFileColorBySize: "By Size",
      treemapFileColorByType: "By File Type",
      treemapDetailSimple: "1 Level",
      treemapDetailMedium: "2 Levels",
      treemapDetailDetailed: "3 Levels",
      copyPathMode: "Copy Path Preference",
      copyPathModeDesc: "When deployed in Docker, prefer host paths and fall back to container paths if no mapping is configured",
      copyHostPathEnabled: "Prefer host path when copying",
      duplicateAllowFullSelection: "Allow selecting every file in a duplicate group",
      duplicateAllowFullSelectionDesc: "By default, each group keeps at least one unchecked file as the source for hardlink, symlink, or reflink actions. Enabling this allows full-group selection, but delete can wipe the whole group and link-style actions still require you to leave a keeper file yourself. Turn it on only if you understand the risk.",
      scanning: "Scanning & Analysis",
      accountSecurity: "Account Security",
      accountSecurityDesc: "Update the administrator username and login password after verifying the current password.",
      accountUsername: "Administrator Username",
      currentPassword: "Current Password",
      newPassword: "New Password",
      newPasswordPlaceholder: "Enter the new password",
      confirmNewPassword: "Confirm New Password",
      confirmNewPasswordPlaceholder: "Repeat the new password",
      changePassword: "Update Account",
      updatingCredentials: "Updating...",
      passwordMismatch: "The new passwords do not match.",
      credentialsManagedByEnv: "The current administrator credentials are managed by environment variables and cannot be changed here at runtime.",
      ignoreList: "Ignore List",
      addFolder: "Add Folder",
      searchSettings: "Search Settings",
      searchIgnore: "Search Ignore List",
      searchIgnoreDesc: "Excluded from search and indexing",
      searchPageSize: "Search Page Size",
      searchPageSizeDesc: "How many search results to show per page",
      includeHidden: "Search Hidden Files",
      addExclusion: "Add Exclusion"
    },
    search: {
      description: "Run readonly fd-based search across mounted Linux directories with size and time filters.",
      noSearchTitle: "No search yet",
      noSearchDesc: "Provide a keyword and optional filters, then run fd to list matching files and folders under the mounted path.",
      loading: "Searching mounted files...",
      resultsTitle: "Search Results",
      empty: "No files or folders matched the current query.",
      pageSize: "Page Size",
      exportCurrentPage: "Export Current Page",
      exportAll: "Export Current Query",
      exportHint: "Exports follow the current filters and sort order as CSV."
    },
    duplicates: {
      description: "Find duplicate file groups with fclones, starting with readonly detection and preview.",
      findDuplicates: "Find Duplicates",
      loading: "Scanning duplicate files...",
      loadingHint: "Large file sets can take longer to scan. Please wait, or click Stop at any time to cancel.",
      historyMeta: "{size} · {groups} groups · {time}",
      resultsTitle: "Duplicate Groups",
      groups: "groups",
      filesPerGroup: "files",
      foundSummary: "{groups} groups across {files} duplicate files",
      wastedSpace: "Recoverable space",
      eachSize: "{size} each",
      minSizeBytes: "Min Size Bytes",
      searchPlaceholder: "Search duplicates...",
      filterType: "Type",
      filterSize: "Size",
      filterTime: "Time",
      sortOrder: "Sort",
      renameMode: "Rename",
      renameScope: "Scope",
      renameCopiesOnly: "Copies Only",
      renameWholeGroup: "Whole Group",
      renameUseKeeper: "Use Keeper Name",
      renameManual: "Manual Name",
      renameInputLabel: "Unified File Name",
      renameInputPlaceholder: "Enter a new file name",
      previewSummary: "Preview Summary",
      previewAffectedGroups: "Affected Groups",
      previewAffectedFiles: "Affected Files",
      previewReclaimedSpace: "Estimated Impact",
      previewNoChanges: "No changes would be applied under the current rule.",
      dryRunNote: "Preview mode does not change files. It only shows what the action would affect.",
      originalCandidate: "Keep First",
      keeperCandidate: "Current Keeper",
      selectionSummary: "{files} duplicate copy files selected across {groups} groups",
      readOnlyHint: "This mount is read-only, so delete and link actions are unavailable.",
      insightsTitle: "Duplicate File Types",
      tipBadge: "Optimization Tip",
      tipTitle: "Prioritize high-yield groups",
      tipDescription: "The current results could free up {size} if you clean the redundant copies.",
      emptyTitle: "No duplicate results yet",
      emptyDesc: "Choose a mounted path and start a duplicate scan.",
      empty: "No duplicate files were found in the current scope.",
      reflinkBadge: "Reflink",
      reflinkBadgeTooltip: "This file was already processed with reflink/shared-block deduplication. It can still appear as duplicate content in later scans, and running reflink again usually will not save additional space.",
      reflinkWarningTitle: "Before using reflink",
      reflinkWarningBody: "Reflink availability depends on the filesystem, kernel support, mount options, and host environment. Files that already share blocks can still appear as duplicates in later scans, and running reflink again usually does not reclaim more space. Use it only if you understand reflink behavior and know how to verify shared blocks in your own environment.",
      type: {
        all: "All",
        image: "Images",
        video: "Videos",
        document: "Documents",
        archive: "Archives",
        other: "Others"
      },
      size: {
        all: "All",
        "1mb": ">1 MB",
        "10mb": ">10 MB",
        "100mb": ">100 MB",
        "1gb": ">1 GB"
      },
      time: {
        all: "All",
        "7d": "Last 7 Days",
        "30d": "Last 30 Days",
        "90d": "Last 90 Days"
      },
      sort: {
        timeDesc: "Time Desc",
        timeAsc: "Time Asc",
        sizeDesc: "Size Desc",
        sizeAsc: "Size Asc"
      }
    },
    status: {
      api: "API",
      gdu: "GDU",
      fd: "FD",
      fclones: "FCLONES",
      ready: "READY",
      offline: "OFFLINE",
      found: "FOUND",
      missing: "MISSING"
    }
  }
};

function getValue(locale, key) {
  const parts = key.split(".");
  let current = STRINGS[locale] || STRINGS.zh;
  for (const part of parts) {
    current = current?.[part];
    if (current == null) {
      return "";
    }
  }
  return current;
}

function interpolate(value, vars) {
  if (!vars) {
    return value;
  }
  return value.replace(/\{(\w+)\}/g, (_, key) => {
    const replacement = vars[key];
    return replacement == null ? "" : String(replacement);
  });
}

const I18nContext = createContext({
  locale: "zh",
  setLocale: () => {},
  t: (key) => key
});

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => readLocaleSetting());

  const setLocale = useCallback((nextLocale) => {
    setLocaleState(nextLocale);
    writeLocaleSetting(nextLocale);
  }, []);

  const t = useCallback(
    (key, vars) => {
      const value = getValue(locale, key) || getValue("zh", key) || key;
      if (typeof value === "function") {
        return value(vars);
      }
      return interpolate(String(value), vars);
    },
    [locale]
  );

  const contextValue = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
