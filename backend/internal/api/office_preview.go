package api

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/xml"
	"fmt"
	"io"
	"mime"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/bodgit/sevenzip"
)

func buildOfficeTextPreview(targetPath string, limit int) (string, bool, bool, error) {
	if isOfficeTempPreviewPath(targetPath) {
		return "", false, false, nil
	}
	ext := strings.ToLower(filepath.Ext(targetPath))
	switch ext {
	case ".docx":
		content, truncated, err := extractDocxText(targetPath, limit)
		return content, truncated, true, err
	case ".xlsx":
		content, truncated, err := extractXlsxText(targetPath, limit)
		return content, truncated, true, err
	case ".pptx":
		content, truncated, err := extractPptxText(targetPath, limit)
		return content, truncated, true, err
	case ".odt", ".ods", ".odp":
		content, truncated, err := extractOpenDocumentText(targetPath, limit)
		return content, truncated, true, err
	case ".wps", ".wpt", ".et", ".ett", ".dps", ".dpt":
		return extractAliasedOfficeText(targetPath, limit)
	case ".epub":
		content, truncated, err := extractEpubText(targetPath, limit)
		return content, truncated, true, err
	default:
		return "", false, false, nil
	}
}

func extractAliasedOfficeText(targetPath string, limit int) (string, bool, bool, error) {
	reader, err := zip.OpenReader(targetPath)
	if err != nil {
		return "", false, false, nil
	}
	defer reader.Close()

	switch {
	case zipFileByName(reader.File, "word/document.xml") != nil:
		content, truncated, err := extractDocxTextFromZip(reader.File, limit)
		return content, truncated, true, err
	case zipFileByName(reader.File, "xl/workbook.xml") != nil || len(filterZipFiles(reader.File, "xl/worksheets/", ".xml")) > 0:
		content, truncated, err := extractXlsxTextFromZip(reader.File, limit)
		return content, truncated, true, err
	case zipFileByName(reader.File, "ppt/presentation.xml") != nil || len(filterZipFiles(reader.File, "ppt/slides/", ".xml")) > 0:
		content, truncated, err := extractPptxTextFromZip(reader.File, limit)
		return content, truncated, true, err
	case zipFileByName(reader.File, "content.xml") != nil:
		content, truncated, err := extractOpenDocumentTextFromZip(reader.File, limit)
		return content, truncated, true, err
	default:
		return "", false, false, nil
	}
}

func isAliasedOfficePreviewPath(targetPath string) bool {
	switch strings.ToLower(filepath.Ext(strings.TrimSpace(targetPath))) {
	case ".wps", ".wpt", ".et", ".ett", ".dps", ".dpt":
		return true
	default:
		return false
	}
}

func isOfficeTempPreviewPath(targetPath string) bool {
	name := strings.TrimSpace(filepath.Base(targetPath))
	if name == "" {
		return false
	}
	return strings.HasPrefix(strings.ToLower(name), "~$")
}

func isLegacyBinaryOfficePreviewPath(targetPath string) bool {
	switch strings.ToLower(filepath.Ext(strings.TrimSpace(targetPath))) {
	case ".doc", ".xls", ".ppt":
		return true
	default:
		return false
	}
}

func extractDocxText(targetPath string, limit int) (string, bool, error) {
	reader, err := zip.OpenReader(targetPath)
	if err != nil {
		return "", false, err
	}
	defer reader.Close()

	return extractDocxTextFromZip(reader.File, limit)
}

func extractDocxTextFromZip(files []*zip.File, limit int) (string, bool, error) {
	docFile := zipFileByName(files, "word/document.xml")
	if docFile == nil {
		return "", false, nil
	}
	rc, err := docFile.Open()
	if err != nil {
		return "", false, err
	}
	defer rc.Close()

	content, truncated, err := extractWordDocumentText(rc, limit)
	if err != nil {
		return "", false, err
	}
	return strings.TrimSpace(content), truncated, nil
}

func extractPptxText(targetPath string, limit int) (string, bool, error) {
	reader, err := zip.OpenReader(targetPath)
	if err != nil {
		return "", false, err
	}
	defer reader.Close()

	return extractPptxTextFromZip(reader.File, limit)
}

func extractPptxTextFromZip(files []*zip.File, limit int) (string, bool, error) {
	slideFiles, slideNames, err := readPresentationSlides(files)
	if err != nil {
		return "", false, err
	}
	if len(slideFiles) == 0 {
		slideFiles = filterZipFiles(files, "ppt/slides/", ".xml")
		sort.Slice(slideFiles, func(i, j int) bool {
			return slideFiles[i].Name < slideFiles[j].Name
		})
	}

	var builder strings.Builder
	truncated := false
	for index, file := range slideFiles {
		if index > 0 {
			appendLimitedString(&builder, "\n\n", limit, &truncated)
		}
		appendLimitedString(&builder, formatIndexedLabel("Slide", index+1, slideNames[file.Name]), limit, &truncated)
		if truncated {
			break
		}
		rc, err := file.Open()
		if err != nil {
			return "", false, err
		}
		slideText, slideTruncated, err := extractSlideText(rc, remainingLimit(limit, &builder))
		_ = rc.Close()
		if err != nil {
			return "", false, err
		}
		appendLimitedString(&builder, strings.TrimSpace(slideText), limit, &truncated)
		if slideTruncated || truncated {
			truncated = true
			break
		}
	}
	return strings.TrimSpace(builder.String()), truncated, nil
}

func extractXlsxText(targetPath string, limit int) (string, bool, error) {
	reader, err := zip.OpenReader(targetPath)
	if err != nil {
		return "", false, err
	}
	defer reader.Close()

	return extractXlsxTextFromZip(reader.File, limit)
}

func extractXlsxTextFromZip(files []*zip.File, limit int) (string, bool, error) {
	sharedStrings, err := readSharedStrings(files)
	if err != nil {
		return "", false, err
	}
	sheetFiles, sheetNames, err := readWorkbookSheets(files)
	if err != nil {
		return "", false, err
	}
	if len(sheetFiles) == 0 {
		sheetFiles = filterZipFiles(files, "xl/worksheets/", ".xml")
		sort.Slice(sheetFiles, func(i, j int) bool {
			return sheetFiles[i].Name < sheetFiles[j].Name
		})
	}

	var builder strings.Builder
	truncated := false
	for index, file := range sheetFiles {
		if index > 0 {
			appendLimitedString(&builder, "\n\n", limit, &truncated)
		}
		appendLimitedString(&builder, formatIndexedLabel("Sheet", index+1, sheetNames[file.Name]), limit, &truncated)
		if truncated {
			break
		}
		rc, err := file.Open()
		if err != nil {
			return "", false, err
		}
		sheetText, sheetTruncated, err := extractWorksheetText(rc, sharedStrings, remainingLimit(limit, &builder))
		_ = rc.Close()
		if err != nil {
			return "", false, err
		}
		appendLimitedString(&builder, strings.TrimSpace(sheetText), limit, &truncated)
		if sheetTruncated || truncated {
			truncated = true
			break
		}
	}
	return strings.TrimSpace(builder.String()), truncated, nil
}

func extractEpubText(targetPath string, limit int) (string, bool, error) {
	reader, err := zip.OpenReader(targetPath)
	if err != nil {
		return "", false, err
	}
	defer reader.Close()

	contentFiles := filterZipFiles(reader.File, "", ".xhtml")
	if len(contentFiles) == 0 {
		contentFiles = filterZipFiles(reader.File, "", ".html")
	}
	sort.Slice(contentFiles, func(i, j int) bool {
		return contentFiles[i].Name < contentFiles[j].Name
	})

	var builder strings.Builder
	truncated := false
	sectionIndex := 0
	for _, file := range contentFiles {
		rc, err := file.Open()
		if err != nil {
			return "", false, err
		}
		content, contentTruncated, err := extractXMLText(rc, remainingLimit(limit, &builder))
		_ = rc.Close()
		if err != nil {
			return "", false, err
		}
		if strings.TrimSpace(content) == "" {
			continue
		}
		if builder.Len() > 0 {
			appendLimitedString(&builder, "\n\n", limit, &truncated)
		}
		sectionIndex += 1
		appendLimitedString(&builder, formatIndexedLabel("Section", sectionIndex, path.Base(file.Name)), limit, &truncated)
		if truncated {
			break
		}
		appendLimitedString(&builder, strings.TrimSpace(content), limit, &truncated)
		if contentTruncated || truncated {
			truncated = true
			break
		}
	}
	return strings.TrimSpace(builder.String()), truncated, nil
}

func extractOpenDocumentText(targetPath string, limit int) (string, bool, error) {
	reader, err := zip.OpenReader(targetPath)
	if err != nil {
		return "", false, err
	}
	defer reader.Close()

	return extractOpenDocumentTextFromZip(reader.File, limit)
}

func extractOpenDocumentTextFromZip(files []*zip.File, limit int) (string, bool, error) {
	contentFile := zipFileByName(files, "content.xml")
	if contentFile == nil {
		return "", false, nil
	}
	rc, err := contentFile.Open()
	if err != nil {
		return "", false, err
	}
	defer rc.Close()

	content, truncated, err := extractOpenDocumentContent(rc, limit)
	if err != nil {
		return "", false, err
	}
	return strings.TrimSpace(content), truncated, nil
}

type archivePreviewEntry struct {
	Name       string `json:"name"`
	Path       string `json:"path"`
	ParentPath string `json:"parentPath"`
	Depth      int    `json:"depth"`
	IsDir      bool   `json:"isDir"`
	SizeBytes  uint64 `json:"sizeBytes,omitempty"`
}

func extractArchivePreviewEntries(targetPath string, maxEntries int, expanded bool) ([]archivePreviewEntry, bool, error) {
	root, err := buildArchiveTree(targetPath)
	if err != nil {
		return nil, false, err
	}
	if expanded {
		return flattenArchivePreviewEntries(root, maxEntries), maxEntries > 0 && countArchivePreviewEntries(root) > maxEntries, nil
	}
	children := make([]*zipTreeNode, 0, len(root.Children))
	for _, child := range root.Children {
		children = append(children, child)
	}
	sort.Slice(children, func(i, j int) bool {
		if children[i].IsDir != children[j].IsDir {
			return children[i].IsDir
		}
		return strings.ToLower(children[i].Name) < strings.ToLower(children[j].Name)
	})

	entries := make([]archivePreviewEntry, 0, minInt(maxEntries, len(children)))
	for index, child := range children {
		if maxEntries > 0 && index >= maxEntries {
			return entries, true, nil
		}
		entries = append(entries, archivePreviewEntry{
			Name:       child.Name,
			Path:       child.Name,
			ParentPath: "/",
			Depth:      0,
			IsDir:      child.IsDir,
			SizeBytes:  child.Size,
		})
	}
	return entries, false, nil
}

func flattenArchivePreviewEntries(root *zipTreeNode, maxEntries int) []archivePreviewEntry {
	entries := make([]archivePreviewEntry, 0, minInt(maxEntries, countArchivePreviewEntries(root)))
	appendFlattenedArchiveEntries(&entries, root, "", 0, maxEntries)
	return entries
}

func appendFlattenedArchiveEntries(entries *[]archivePreviewEntry, node *zipTreeNode, parentPath string, depth int, maxEntries int) {
	children := make([]*zipTreeNode, 0, len(node.Children))
	for _, child := range node.Children {
		children = append(children, child)
	}
	sort.Slice(children, func(i, j int) bool {
		if children[i].IsDir != children[j].IsDir {
			return children[i].IsDir
		}
		return strings.ToLower(children[i].Name) < strings.ToLower(children[j].Name)
	})

	for _, child := range children {
		if maxEntries > 0 && len(*entries) >= maxEntries {
			return
		}
		fullPath := child.Name
		if parentPath != "" {
			fullPath = parentPath + "/" + child.Name
		}
		currentParent := "/"
		if parentPath != "" {
			currentParent = parentPath
		}
		*entries = append(*entries, archivePreviewEntry{
			Name:       child.Name,
			Path:       fullPath,
			ParentPath: currentParent,
			Depth:      depth,
			IsDir:      child.IsDir,
			SizeBytes:  child.Size,
		})
		if child.IsDir {
			appendFlattenedArchiveEntries(entries, child, fullPath, depth+1, maxEntries)
		}
	}
}

func countArchivePreviewEntries(root *zipTreeNode) int {
	total := 0
	for _, child := range root.Children {
		total += 1
		if child.IsDir {
			total += countArchivePreviewEntries(child)
		}
	}
	return total
}

func buildArchiveTree(targetPath string) (*zipTreeNode, error) {
	switch detectArchivePreviewKind(targetPath) {
	case "zip":
		reader, err := zip.OpenReader(targetPath)
		if err != nil {
			return nil, err
		}
		defer reader.Close()
		return buildZipTree(reader.File), nil
	case "7z":
		return buildSevenZipTree(targetPath)
	case "tar", "targz":
		return buildTarTree(targetPath)
	default:
		return nil, fmt.Errorf("unsupported archive preview format")
	}
}

func extractArchiveCoverImage(targetPath string) ([]byte, string, string, bool, error) {
	switch detectArchivePreviewKind(targetPath) {
	case "zip":
		reader, err := zip.OpenReader(targetPath)
		if err != nil {
			return nil, "", "", false, err
		}
		defer reader.Close()

		imageFiles := make([]*zip.File, 0, len(reader.File))
		for _, file := range reader.File {
			if file.FileInfo().IsDir() {
				continue
			}
			if isArchiveImageFile(file.Name) {
				imageFiles = append(imageFiles, file)
			}
		}
		if len(imageFiles) == 0 {
			return nil, "", "", false, nil
		}
		sort.Slice(imageFiles, func(i, j int) bool {
			return strings.ToLower(imageFiles[i].Name) < strings.ToLower(imageFiles[j].Name)
		})

		selected := imageFiles[0]
		rc, err := selected.Open()
		if err != nil {
			return nil, "", "", false, err
		}
		defer rc.Close()
		return readArchiveCoverImage(rc, selected.Name)
	case "7z":
		reader, err := sevenzip.OpenReader(targetPath)
		if err != nil {
			return nil, "", "", false, err
		}
		defer reader.Close()

		imageFiles := make([]*sevenzip.File, 0, len(reader.File))
		for _, file := range reader.File {
			info := file.FileInfo()
			if info != nil && info.IsDir() {
				continue
			}
			if isArchiveImageFile(file.Name) {
				imageFiles = append(imageFiles, file)
			}
		}
		if len(imageFiles) == 0 {
			return nil, "", "", false, nil
		}
		sort.Slice(imageFiles, func(i, j int) bool {
			return strings.ToLower(imageFiles[i].Name) < strings.ToLower(imageFiles[j].Name)
		})

		selected := imageFiles[0]
		rc, err := selected.Open()
		if err != nil {
			return nil, "", "", false, err
		}
		defer rc.Close()
		return readArchiveCoverImage(rc, selected.Name)
	default:
		return nil, "", "", false, nil
	}
}

func buildTarTree(targetPath string) (*zipTreeNode, error) {
	file, err := os.Open(targetPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var reader io.Reader = file
	if detectArchivePreviewKind(targetPath) == "targz" {
		gzipReader, err := gzip.NewReader(file)
		if err != nil {
			return nil, err
		}
		defer gzipReader.Close()
		reader = gzipReader
	}

	root := &zipTreeNode{
		Name:     "",
		IsDir:    true,
		Children: make(map[string]*zipTreeNode),
	}
	tarReader := tar.NewReader(reader)
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		addArchiveTreeEntry(root, header.Name, header.FileInfo().IsDir(), uint64(maxInt64(header.Size, 0)))
	}
	return root, nil
}

func buildSevenZipTree(targetPath string) (*zipTreeNode, error) {
	reader, err := sevenzip.OpenReader(targetPath)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	root := &zipTreeNode{
		Name:     "",
		IsDir:    true,
		Children: make(map[string]*zipTreeNode),
	}
	for _, file := range reader.File {
		info := file.FileInfo()
		size := uint64(0)
		if info != nil {
			size = uint64(maxInt64(info.Size(), 0))
		}
		addArchiveTreeEntry(root, file.Name, info != nil && info.IsDir(), size)
	}
	return root, nil
}

type zipTreeNode struct {
	Name     string
	IsDir    bool
	Size     uint64
	Children map[string]*zipTreeNode
}

func extractWordDocumentText(reader io.Reader, limit int) (string, bool, error) {
	decoder := xml.NewDecoder(reader)
	var builder strings.Builder
	truncated := false

	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", false, err
		}
		switch element := token.(type) {
		case xml.StartElement:
			switch element.Name.Local {
			case "t":
				var text string
				if err := decoder.DecodeElement(&text, &element); err != nil {
					return "", false, err
				}
				appendLimitedString(&builder, text, limit, &truncated)
			case "tab":
				appendLimitedString(&builder, "\t", limit, &truncated)
			case "br":
				appendLimitedString(&builder, "\n", limit, &truncated)
			}
		case xml.EndElement:
			if element.Name.Local == "p" {
				appendLimitedString(&builder, "\n", limit, &truncated)
			}
		}
		if truncated {
			break
		}
	}

	return builder.String(), truncated, nil
}

func extractXMLText(reader io.Reader, limit int) (string, bool, error) {
	decoder := xml.NewDecoder(reader)
	var builder strings.Builder
	truncated := false

	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", false, err
		}
		switch element := token.(type) {
		case xml.StartElement:
			switch element.Name.Local {
			case "p", "div", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6", "li":
				if builder.Len() > 0 {
					appendLimitedString(&builder, "\n", limit, &truncated)
				}
			case "br":
				appendLimitedString(&builder, "\n", limit, &truncated)
			}
		case xml.CharData:
			text := strings.TrimSpace(string(element))
			if text != "" {
				if builder.Len() > 0 && !strings.HasSuffix(builder.String(), "\n") {
					appendLimitedString(&builder, " ", limit, &truncated)
				}
				appendLimitedString(&builder, text, limit, &truncated)
			}
		}
		if truncated {
			break
		}
	}

	return builder.String(), truncated, nil
}

func extractSlideText(reader io.Reader, limit int) (string, bool, error) {
	decoder := xml.NewDecoder(reader)
	var builder strings.Builder
	truncated := false

	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", false, err
		}
		switch element := token.(type) {
		case xml.StartElement:
			if element.Name.Local == "t" {
				var text string
				if err := decoder.DecodeElement(&text, &element); err != nil {
					return "", false, err
				}
				appendLimitedString(&builder, text, limit, &truncated)
				appendLimitedString(&builder, "\n", limit, &truncated)
			}
		}
		if truncated {
			break
		}
	}

	return builder.String(), truncated, nil
}

func extractWorksheetText(reader io.Reader, sharedStrings []string, limit int) (string, bool, error) {
	decoder := xml.NewDecoder(reader)
	var builder strings.Builder
	truncated := false

	inRow := false
	rowValues := make([]string, 0, 16)
	cellType := ""
	inlineString := false
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", false, err
		}

		switch element := token.(type) {
		case xml.StartElement:
			switch element.Name.Local {
			case "row":
				inRow = true
				rowValues = rowValues[:0]
			case "c":
				cellType = attrValue(element.Attr, "t")
				inlineString = cellType == "inlineStr"
			case "v":
				if !inRow {
					continue
				}
				var value string
				if err := decoder.DecodeElement(&value, &element); err != nil {
					return "", false, err
				}
				rowValues = append(rowValues, resolveWorksheetCellValue(value, cellType, sharedStrings))
			case "t":
				if !inRow || !inlineString {
					continue
				}
				var value string
				if err := decoder.DecodeElement(&value, &element); err != nil {
					return "", false, err
				}
				rowValues = append(rowValues, value)
			}
		case xml.EndElement:
			switch element.Name.Local {
			case "c":
				cellType = ""
				inlineString = false
			case "row":
				if !inRow {
					continue
				}
				appendLimitedString(&builder, strings.Join(rowValues, "\t"), limit, &truncated)
				appendLimitedString(&builder, "\n", limit, &truncated)
				inRow = false
				if truncated {
					break
				}
			}
		}
		if truncated {
			break
		}
	}

	return builder.String(), truncated, nil
}

func extractOpenDocumentContent(reader io.Reader, limit int) (string, bool, error) {
	decoder := xml.NewDecoder(reader)
	var builder strings.Builder
	truncated := false

	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", false, err
		}

		switch element := token.(type) {
		case xml.StartElement:
			switch element.Name.Local {
			case "p", "h":
				if builder.Len() > 0 && !strings.HasSuffix(builder.String(), "\n") {
					appendLimitedString(&builder, "\n", limit, &truncated)
				}
			case "table-row":
				if builder.Len() > 0 && !strings.HasSuffix(builder.String(), "\n") {
					appendLimitedString(&builder, "\n", limit, &truncated)
				}
			case "table-cell":
				if builder.Len() > 0 && !strings.HasSuffix(builder.String(), "\n") {
					appendLimitedString(&builder, "\t", limit, &truncated)
				}
			case "line-break":
				appendLimitedString(&builder, "\n", limit, &truncated)
			case "tab":
				appendLimitedString(&builder, "\t", limit, &truncated)
			}
		case xml.CharData:
			text := strings.TrimSpace(string(element))
			if text != "" {
				if builder.Len() > 0 && !strings.HasSuffix(builder.String(), "\n") && !strings.HasSuffix(builder.String(), "\t") {
					appendLimitedString(&builder, " ", limit, &truncated)
				}
				appendLimitedString(&builder, text, limit, &truncated)
			}
		case xml.EndElement:
			switch element.Name.Local {
			case "p", "h", "table-row":
				if builder.Len() > 0 && !strings.HasSuffix(builder.String(), "\n") {
					appendLimitedString(&builder, "\n", limit, &truncated)
				}
			}
		}

		if truncated {
			break
		}
	}

	return builder.String(), truncated, nil
}

func readSharedStrings(files []*zip.File) ([]string, error) {
	file := zipFileByName(files, "xl/sharedStrings.xml")
	if file == nil {
		return nil, nil
	}
	rc, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	decoder := xml.NewDecoder(rc)
	values := make([]string, 0, 32)
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if start, ok := token.(xml.StartElement); ok && start.Name.Local == "si" {
			value, err := decodeSharedStringItem(decoder, start)
			if err != nil {
				return nil, err
			}
			values = append(values, value)
		}
	}
	return values, nil
}

func readWorkbookSheets(files []*zip.File) ([]*zip.File, map[string]string, error) {
	workbookFile := zipFileByName(files, "xl/workbook.xml")
	if workbookFile == nil {
		return nil, nil, nil
	}
	rels, err := readZipRelationships(files, "xl/_rels/workbook.xml.rels", "xl")
	if err != nil {
		return nil, nil, err
	}

	rc, err := workbookFile.Open()
	if err != nil {
		return nil, nil, err
	}
	defer rc.Close()

	decoder := xml.NewDecoder(rc)
	targets := make([]namedZipTarget, 0, 8)
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, nil, err
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "sheet" {
			continue
		}
		relID := attrValue(start.Attr, "id")
		target, ok := rels[relID]
		if !ok {
			continue
		}
		targets = append(targets, namedZipTarget{
			Label: attrValue(start.Attr, "name"),
			Path:  target,
		})
	}
	ordered, labels := orderZipTargets(files, targets, "xl/worksheets/", ".xml")
	return ordered, labels, nil
}

func readPresentationSlides(files []*zip.File) ([]*zip.File, map[string]string, error) {
	presentationFile := zipFileByName(files, "ppt/presentation.xml")
	if presentationFile == nil {
		return nil, nil, nil
	}
	rels, err := readZipRelationships(files, "ppt/_rels/presentation.xml.rels", "ppt")
	if err != nil {
		return nil, nil, err
	}

	rc, err := presentationFile.Open()
	if err != nil {
		return nil, nil, err
	}
	defer rc.Close()

	decoder := xml.NewDecoder(rc)
	targets := make([]namedZipTarget, 0, 8)
	index := 0
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, nil, err
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "sldId" {
			continue
		}
		relID := attrValue(start.Attr, "id")
		target, ok := rels[relID]
		if !ok {
			continue
		}
		index += 1
		targets = append(targets, namedZipTarget{
			Label: fmt.Sprintf("Slide %d", index),
			Path:  target,
		})
	}
	ordered, labels := orderZipTargets(files, targets, "ppt/slides/", ".xml")
	return ordered, labels, nil
}

func readZipRelationships(files []*zip.File, relsPath string, baseDir string) (map[string]string, error) {
	relsFile := zipFileByName(files, relsPath)
	if relsFile == nil {
		return nil, nil
	}
	rc, err := relsFile.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	decoder := xml.NewDecoder(rc)
	relations := make(map[string]string)
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "Relationship" {
			continue
		}
		id := attrValue(start.Attr, "Id")
		target := attrValue(start.Attr, "Target")
		if id == "" || target == "" {
			continue
		}
		relations[id] = normalizeZipTarget(baseDir, target)
	}
	return relations, nil
}

type namedZipTarget struct {
	Label string
	Path  string
}

func orderZipTargets(files []*zip.File, targets []namedZipTarget, prefix string, suffix string) ([]*zip.File, map[string]string) {
	fileIndex := make(map[string]*zip.File, len(files))
	for _, file := range files {
		fileIndex[file.Name] = file
	}

	ordered := make([]*zip.File, 0, len(targets))
	labels := make(map[string]string, len(targets))
	seen := make(map[string]struct{}, len(targets))
	for _, target := range targets {
		file, ok := fileIndex[target.Path]
		if !ok {
			continue
		}
		ordered = append(ordered, file)
		labels[file.Name] = target.Label
		seen[file.Name] = struct{}{}
	}

	extras := make([]*zip.File, 0)
	for _, file := range files {
		if _, ok := seen[file.Name]; ok {
			continue
		}
		if strings.HasPrefix(file.Name, prefix) && strings.HasSuffix(file.Name, suffix) {
			extras = append(extras, file)
		}
	}
	sort.Slice(extras, func(i, j int) bool {
		return extras[i].Name < extras[j].Name
	})
	ordered = append(ordered, extras...)
	return ordered, labels
}

func formatIndexedLabel(kind string, index int, name string) string {
	label := fmt.Sprintf("[%s %d", kind, index)
	name = strings.TrimSpace(name)
	if name != "" && !strings.EqualFold(name, fmt.Sprintf("%s %d", kind, index)) {
		label += ": " + name
	}
	return label + "]\n"
}

func normalizeZipTarget(baseDir string, target string) string {
	target = strings.ReplaceAll(strings.TrimSpace(target), "\\", "/")
	if target == "" {
		return ""
	}
	if strings.HasPrefix(target, "/") {
		return strings.TrimPrefix(path.Clean(target), "/")
	}
	return path.Clean(path.Join(baseDir, target))
}

func buildZipTree(files []*zip.File) *zipTreeNode {
	root := &zipTreeNode{
		Name:     "",
		IsDir:    true,
		Children: make(map[string]*zipTreeNode),
	}
	for _, file := range files {
		addArchiveTreeEntry(root, file.Name, file.FileInfo().IsDir(), file.UncompressedSize64)
	}
	return root
}

func addArchiveTreeEntry(root *zipTreeNode, rawName string, isDir bool, size uint64) {
	cleanName := strings.Trim(strings.ReplaceAll(rawName, "\\", "/"), "/")
	if cleanName == "" {
		return
	}
	parts := strings.Split(cleanName, "/")
	current := root
	for index, part := range parts {
		isLast := index == len(parts)-1
		child, ok := current.Children[part]
		if !ok {
			child = &zipTreeNode{
				Name:     part,
				IsDir:    !isLast || isDir,
				Children: make(map[string]*zipTreeNode),
			}
			current.Children[part] = child
		}
		if isLast && !isDir {
			child.IsDir = false
			child.Size = size
		}
		current = child
	}
}

func isArchiveImageFile(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif":
		return true
	default:
		return false
	}
}

func isArchiveImagePreviewPath(name string) bool {
	switch strings.ToLower(filepath.Ext(strings.TrimSpace(name))) {
	case ".cbz", ".cb7":
		return true
	default:
		return false
	}
}

func readArchiveCoverImage(reader io.Reader, name string) ([]byte, string, string, bool, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, "", "", false, err
	}
	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(name)))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	return data, path.Base(name), contentType, true, nil
}

func minInt(left int, right int) int {
	if left < right {
		return left
	}
	return right
}

func maxInt64(left int64, right int64) int64 {
	if left > right {
		return left
	}
	return right
}

func detectArchivePreviewKind(targetPath string) string {
	lowerPath := strings.ToLower(strings.TrimSpace(targetPath))
	switch {
	case strings.HasSuffix(lowerPath, ".zip"), strings.HasSuffix(lowerPath, ".cbz"):
		return "zip"
	case strings.HasSuffix(lowerPath, ".7z"), strings.HasSuffix(lowerPath, ".cb7"):
		return "7z"
	case strings.HasSuffix(lowerPath, ".tar"):
		return "tar"
	case strings.HasSuffix(lowerPath, ".tgz"), strings.HasSuffix(lowerPath, ".tar.gz"):
		return "targz"
	default:
		return ""
	}
}

func decodeSharedStringItem(decoder *xml.Decoder, start xml.StartElement) (string, error) {
	var builder strings.Builder
	for {
		token, err := decoder.Token()
		if err != nil {
			return "", err
		}
		switch element := token.(type) {
		case xml.StartElement:
			if element.Name.Local == "t" {
				var text string
				if err := decoder.DecodeElement(&text, &element); err != nil {
					return "", err
				}
				builder.WriteString(text)
			}
		case xml.EndElement:
			if element.Name.Local == start.Name.Local {
				return builder.String(), nil
			}
		}
	}
}

func resolveWorksheetCellValue(value, cellType string, sharedStrings []string) string {
	if cellType == "s" {
		index, err := strconv.Atoi(strings.TrimSpace(value))
		if err == nil && index >= 0 && index < len(sharedStrings) {
			return sharedStrings[index]
		}
	}
	return value
}

func zipFileByName(files []*zip.File, name string) *zip.File {
	for _, file := range files {
		if file.Name == name {
			return file
		}
	}
	return nil
}

func filterZipFiles(files []*zip.File, prefix, suffix string) []*zip.File {
	result := make([]*zip.File, 0, len(files))
	for _, file := range files {
		if strings.HasPrefix(file.Name, prefix) && strings.HasSuffix(file.Name, suffix) {
			result = append(result, file)
		}
	}
	return result
}

func attrValue(attrs []xml.Attr, key string) string {
	for _, attr := range attrs {
		if attr.Name.Local == key {
			return attr.Value
		}
	}
	return ""
}

func appendLimitedString(builder *strings.Builder, value string, limit int, truncated *bool) {
	if *truncated || value == "" {
		return
	}
	if limit <= 0 {
		builder.WriteString(value)
		return
	}

	remaining := limit - builder.Len()
	if remaining <= 0 {
		*truncated = true
		return
	}

	if len(value) <= remaining {
		builder.WriteString(value)
		return
	}

	builder.WriteString(value[:remaining])
	*truncated = true
}

func remainingLimit(limit int, builder *strings.Builder) int {
	if limit <= 0 {
		return 0
	}
	if limit-builder.Len() < 0 {
		return 0
	}
	return limit - builder.Len()
}

func humanSize(size uint64) string {
	const (
		kb = 1024
		mb = 1024 * kb
		gb = 1024 * mb
	)
	switch {
	case size >= gb:
		return fmt.Sprintf("%.1f GB", float64(size)/float64(gb))
	case size >= mb:
		return fmt.Sprintf("%.1f MB", float64(size)/float64(mb))
	case size >= kb:
		return fmt.Sprintf("%.1f KB", float64(size)/float64(kb))
	default:
		return fmt.Sprintf("%d B", size)
	}
}
