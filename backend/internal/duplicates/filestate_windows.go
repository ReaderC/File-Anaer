//go:build windows

package duplicates

import "os"

func describePlatformFileState(_ os.FileInfo) string {
	return ""
}
