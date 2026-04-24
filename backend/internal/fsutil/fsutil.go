package fsutil

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

func NormalizeRoot(root string) string {
	root = filepath.Clean(root)
	if root == "." {
		return string(filepath.Separator)
	}
	return root
}

func ResolveWithinRoot(root, requested string) (string, error) {
	root = NormalizeRoot(root)
	requested = filepath.Clean(requested)

	if requested == "." || requested == "" {
		requested = root
	} else if !filepath.IsAbs(requested) {
		requested = filepath.Join(root, requested)
	}

	resolved := filepath.Clean(requested)
	if !isWithinRoot(root, resolved) {
		return "", errors.New("requested path escapes configured root")
	}

	return resolved, nil
}

func isWithinRoot(root, candidate string) bool {
	root = filepath.Clean(root)
	candidate = filepath.Clean(candidate)
	if root == candidate {
		return true
	}

	base := root + string(filepath.Separator)
	if runtime.GOOS == "windows" {
		root = strings.ToLower(root)
		candidate = strings.ToLower(candidate)
		base = root + string(filepath.Separator)
	}
	return strings.HasPrefix(candidate, base)
}

func RootExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func CanWriteDir(path string) bool {
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return false
	}
	file, err := os.CreateTemp(path, ".file-anaer-write-check-*")
	if err != nil {
		return false
	}
	name := file.Name()
	_ = file.Close()
	_ = os.Remove(name)
	return true
}
