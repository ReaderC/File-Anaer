package domain

import "time"

type Root struct {
	ID       string `json:"id"`
	Path     string `json:"path"`
	HostPath string `json:"hostPath,omitempty"`
	Writable bool   `json:"writable"`
	Warning  string `json:"warning,omitempty"`
}

type DirectoryEntry struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	HostPath string `json:"hostPath,omitempty"`
	IsDir    bool   `json:"isDir"`
}

type TreeNode struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	Path            string     `json:"path"`
	HostPath        string     `json:"hostPath,omitempty"`
	SizeBytes       int64      `json:"sizeBytes"`
	ModifiedAt      time.Time  `json:"modifiedAt"`
	Type            string     `json:"type"`
	FileCount       int64      `json:"fileCount"`
	HasLazyChildren bool       `json:"hasLazyChildren,omitempty"`
	Children        []TreeNode `json:"children,omitempty"`
}

type TypeStat struct {
	Label      string  `json:"label"`
	SizeBytes  int64   `json:"sizeBytes"`
	Percentage float64 `json:"percentage"`
}

type TopFile struct {
	Name           string    `json:"name"`
	Path           string    `json:"path"`
	HostPath       string    `json:"hostPath,omitempty"`
	ParentPath     string    `json:"parentPath"`
	ParentHostPath string    `json:"parentHostPath,omitempty"`
	Extension      string    `json:"extension"`
	SizeBytes      int64     `json:"sizeBytes"`
	ModifiedAt     time.Time `json:"modifiedAt"`
	IsDir          bool      `json:"isDir"`
}

type AnalyzeRequest struct {
	Root     string   `json:"root"`
	Path     string   `json:"path"`
	MaxDepth int      `json:"maxDepth"`
	TopN     int      `json:"topN"`
	Ignore   []string `json:"ignore"`
}

type AnalyzeResponse struct {
	Root      string     `json:"root"`
	Path      string     `json:"path"`
	Tree      TreeNode   `json:"tree"`
	TypeStats []TypeStat `json:"typeStats"`
	TopFiles  []TopFile  `json:"topFiles"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

type AnalyzeJob struct {
	ID        string           `json:"jobId"`
	Status    string           `json:"status"`
	Result    *AnalyzeResponse `json:"result,omitempty"`
	Error     string           `json:"error,omitempty"`
	CreatedAt time.Time        `json:"createdAt"`
}

type SearchRequest struct {
	Root           string   `json:"root"`
	Roots          []string `json:"roots,omitempty"`
	Path           string   `json:"path"`
	Query          string   `json:"query"`
	Extensions     []string `json:"extensions"`
	Ignore         []string `json:"ignore"`
	IncludeHidden  bool     `json:"includeHidden"`
	SizeMin        int64    `json:"sizeMin"`
	SizeMax        int64    `json:"sizeMax"`
	ModifiedAfter  string   `json:"modifiedAfter"`
	ModifiedBefore string   `json:"modifiedBefore"`
	Limit          int      `json:"limit"`
	Offset         int      `json:"offset"`
	RequestLimit   int      `json:"requestLimit,omitempty"`
	SortBy         string   `json:"sortBy,omitempty"`
	SortDir        string   `json:"sortDir,omitempty"`
}

type SearchResult struct {
	Root           string    `json:"root,omitempty"`
	Path           string    `json:"path"`
	HostPath       string    `json:"hostPath,omitempty"`
	Name           string    `json:"name"`
	Extension      string    `json:"extension"`
	SizeBytes      int64     `json:"sizeBytes"`
	ModifiedAt     time.Time `json:"modifiedAt"`
	IsDir          bool      `json:"isDir"`
	ParentPath     string    `json:"parentPath"`
	ParentHostPath string    `json:"parentHostPath,omitempty"`
}

type SearchResponse struct {
	Root           string         `json:"root"`
	Roots          []string       `json:"roots,omitempty"`
	Path           string         `json:"path"`
	Items          []SearchResult `json:"items"`
	Total          int            `json:"total"`
	Limit          int            `json:"limit"`
	Offset         int            `json:"offset"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	MatchedTotal   int            `json:"matchedTotal,omitempty"`
	Truncated      bool           `json:"truncated,omitempty"`
	TruncatedCount int            `json:"truncatedCount,omitempty"`
	ResultLimit    int            `json:"resultLimit,omitempty"`
	TruncatedBy    string         `json:"truncatedBy,omitempty"`
}

type DuplicateFindRequest struct {
	Mode          string   `json:"mode,omitempty"`
	Root          string   `json:"root"`
	Path          string   `json:"path"`
	ComparePath   string   `json:"comparePath,omitempty"`
	Ignore        []string `json:"ignore"`
	MinSizeBytes  int64    `json:"minSizeBytes"`
	IncludeHidden bool     `json:"includeHidden"`
}

type DuplicateFile struct {
	Path           string    `json:"path"`
	HostPath       string    `json:"hostPath,omitempty"`
	Name           string    `json:"name"`
	ParentPath     string    `json:"parentPath"`
	ParentHostPath string    `json:"parentHostPath,omitempty"`
	SizeBytes      int64     `json:"sizeBytes"`
	ModifiedAt     time.Time `json:"modifiedAt"`
}

type DuplicateGroup struct {
	Hash        string          `json:"hash"`
	FileCount   int             `json:"fileCount"`
	SizeBytes   int64           `json:"sizeBytes"`
	WastedBytes int64           `json:"wastedBytes"`
	Files       []DuplicateFile `json:"files"`
}

type DuplicateFindResponse struct {
	Mode             string           `json:"mode,omitempty"`
	Root             string           `json:"root"`
	Path             string           `json:"path"`
	ComparePath      string           `json:"comparePath,omitempty"`
	Groups           []DuplicateGroup `json:"groups"`
	TotalGroups      int              `json:"totalGroups"`
	TotalFiles       int              `json:"totalFiles"`
	TotalWastedBytes int64            `json:"totalWastedBytes"`
	UpdatedAt        time.Time        `json:"updatedAt"`
}

type DuplicateJob struct {
	ID              string                 `json:"jobId"`
	Status          string                 `json:"status"`
	ProgressText    string                 `json:"progressText,omitempty"`
	ProgressPercent int                    `json:"progressPercent,omitempty"`
	ProgressStep    int                    `json:"progressStep,omitempty"`
	ProgressTotal   int                    `json:"progressTotal,omitempty"`
	Result          *DuplicateFindResponse `json:"result,omitempty"`
	Error           string                 `json:"error,omitempty"`
	CreatedAt       time.Time              `json:"createdAt"`
}

type DuplicateActionMode string

const (
	DuplicateActionDelete   DuplicateActionMode = "delete"
	DuplicateActionHardlink DuplicateActionMode = "hardlink"
	DuplicateActionSymlink  DuplicateActionMode = "symlink"
	DuplicateActionReflink  DuplicateActionMode = "reflink"
	DuplicateActionRename   DuplicateActionMode = "rename"
)

type DuplicateRenameMode string

const (
	DuplicateRenameModeKeeper DuplicateRenameMode = "keeper"
	DuplicateRenameModeManual DuplicateRenameMode = "manual"
)

type DuplicateRenameScope string

const (
	DuplicateRenameScopeCopies DuplicateRenameScope = "copies"
	DuplicateRenameScopeGroup  DuplicateRenameScope = "group"
)

type DuplicateActionGroup struct {
	Hash          string   `json:"hash"`
	KeepPath      string   `json:"keepPath"`
	SelectedPaths []string `json:"selectedPaths"`
}

type DuplicateActionRequest struct {
	Root        string                 `json:"root"`
	Mode        DuplicateActionMode    `json:"mode"`
	DryRun      bool                   `json:"dryRun"`
	RenameMode  DuplicateRenameMode    `json:"renameMode,omitempty"`
	RenameScope DuplicateRenameScope   `json:"renameScope,omitempty"`
	RenameName  string                 `json:"renameName,omitempty"`
	Groups      []DuplicateActionGroup `json:"groups"`
}

type DuplicateRenamedFile struct {
	OldPath string `json:"oldPath"`
	NewPath string `json:"newPath"`
}

type DuplicateActionResponse struct {
	Mode             DuplicateActionMode    `json:"mode"`
	DryRun           bool                   `json:"dryRun"`
	GroupCount       int                    `json:"groupCount"`
	FileCount        int                    `json:"fileCount"`
	ReclaimedBytes   int64                  `json:"reclaimedBytes"`
	NeedsRescan      bool                   `json:"needsRescan"`
	AffectedPaths    []string               `json:"affectedPaths"`
	RenamedFiles     []DuplicateRenamedFile `json:"renamedFiles,omitempty"`
	UnchangedMessage string                 `json:"unchangedMessage,omitempty"`
}

type DuplicateUndoRenameRequest struct {
	Root         string                 `json:"root"`
	RenamedFiles []DuplicateRenamedFile `json:"renamedFiles"`
}

type DuplicateUndoRenameResponse struct {
	FileCount     int                    `json:"fileCount"`
	RestoredFiles []DuplicateRenamedFile `json:"restoredFiles"`
}

type DuplicateRefreshRequest struct {
	Root   string                  `json:"root"`
	Paths  []string                `json:"paths,omitempty"`
	Groups []DuplicateRefreshGroup `json:"groups,omitempty"`
}

type DuplicateRefreshGroup struct {
	Paths []string `json:"paths"`
}

type DuplicateRefreshResponse struct {
	ExistingPaths []string `json:"existingPaths"`
	RetainedPaths []string `json:"retainedPaths"`
	MissingPaths  []string `json:"missingPaths"`
}

type LoginRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	RememberMe bool   `json:"rememberMe"`
}

type SetupRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type UpdateCredentialsRequest struct {
	Username        string `json:"username"`
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type AuthUser struct {
	Username string `json:"username"`
}

type AuthStatusResponse struct {
	Enabled              bool      `json:"enabled"`
	SetupRequired        bool      `json:"setupRequired"`
	Authenticated        bool      `json:"authenticated"`
	CanManageCredentials bool      `json:"canManageCredentials"`
	User                 *AuthUser `json:"user,omitempty"`
}

type AppSettings struct {
	Locale                      string   `json:"locale"`
	Theme                       string   `json:"theme"`
	TreemapFileColorMode        string   `json:"treemapFileColorMode"`
	TreemapDetailLevel          string   `json:"treemapDetailLevel"`
	CopyHostPath                bool     `json:"copyHostPath"`
	DuplicateAllowFullSelection bool     `json:"duplicateAllowFullSelection"`
	ScanIgnore                  []string `json:"scanIgnore"`
	DuplicateIgnore             []string `json:"duplicateIgnore"`
	SearchIgnore                []string `json:"searchIgnore"`
	SearchHidden                bool     `json:"searchHidden"`
	SearchPageSize              int      `json:"searchPageSize"`
}
