//go:build !windows

package duplicates

import (
	"fmt"
	"os"
	"syscall"
)

func describePlatformFileState(info os.FileInfo) string {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return ""
	}
	return fmt.Sprintf("inode=%d nlink=%d", stat.Ino, stat.Nlink)
}
