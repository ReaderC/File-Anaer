package api

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

var tinyPNG = []byte{
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
	0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
	0x00, 0x03, 0x01, 0x01, 0x00, 0xc9, 0xfe, 0x92,
	0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
	0x44, 0xae, 0x42, 0x60, 0x82,
}

func TestExtractArchivePreviewEntriesShowsTopLevelOnly(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.zip")

	file, err := os.Create(archivePath)
	if err != nil {
		t.Fatalf("create archive: %v", err)
	}

	writer := zip.NewWriter(file)
	for _, name := range []string{"docs/", "docs/chapter/", "docs/chapter/page.txt"} {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatalf("create entry %q: %v", name, err)
		}
		if !strings.HasSuffix(name, "/") {
			if _, err := entry.Write([]byte("x")); err != nil {
				t.Fatalf("write entry %q: %v", name, err)
			}
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close file: %v", err)
	}

	entries, truncated, err := extractArchivePreviewEntries(archivePath, 20, false)
	if err != nil {
		t.Fatalf("extractArchivePreviewEntries() error = %v", err)
	}
	if truncated {
		t.Fatalf("expected non-truncated entries")
	}
	if len(entries) != 1 {
		t.Fatalf("entry count = %d, want 1", len(entries))
	}
	if entries[0].Name != "docs" || entries[0].Depth != 0 || !entries[0].IsDir {
		t.Fatalf("unexpected first entry: %#v", entries[0])
	}
	if entries[0].ParentPath != "/" {
		t.Fatalf("unexpected parent path: %#v", entries[0])
	}
}

func TestExtractArchiveCoverImageReturnsFirstImage(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.cbz")

	file, err := os.Create(archivePath)
	if err != nil {
		t.Fatalf("create archive: %v", err)
	}

	writer := zip.NewWriter(file)
	entry, err := writer.Create("001-cover.png")
	if err != nil {
		t.Fatalf("create image entry: %v", err)
	}
	if _, err := entry.Write(tinyPNG); err != nil {
		t.Fatalf("write image entry: %v", err)
	}
	entry, err = writer.Create("002-note.txt")
	if err != nil {
		t.Fatalf("create text entry: %v", err)
	}
	if _, err := entry.Write([]byte("ignored")); err != nil {
		t.Fatalf("write text entry: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close file: %v", err)
	}

	data, name, contentType, ok, err := extractArchiveCoverImage(archivePath)
	if err != nil {
		t.Fatalf("extractArchiveCoverImage() error = %v", err)
	}
	if !ok {
		t.Fatalf("expected archive cover preview to be available")
	}
	if name != "001-cover.png" {
		t.Fatalf("cover image name = %q, want %q", name, "001-cover.png")
	}
	if contentType != "image/png" {
		t.Fatalf("content type = %q, want %q", contentType, "image/png")
	}
	if len(data) == 0 {
		t.Fatalf("expected non-empty image data")
	}
}

func TestExtractArchiveCoverImageReturnsFirstImageFromCb7(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.cb7")

	data, err := base64.StdEncoding.DecodeString("N3q8ryccAAS07O9CxwAAAAAAAAAhAAAAAAAAANLdR3vgAFAATV0ARJQFxHon9vfuiY5QkIizqtVQIJYzd/penA8ly9BiL+x00+oY/DaaQ/8K2vELKA5GC6x4RnDe8hz1bCsXj9YUnIIsbDXu7hyykvNUmLYAAACBMweuD9MB9D1AwJDS/31pTYaU9T5L+MJdbwKrLpMQgfWtG3xhzkMc0Uw50AawTHt8NQPnxxuua+SdnBAOzZBtSscGXUUt1kHD3YRhuiU/Yy4Lgd3tK4J3wAJzRljnYe7WYTNyfahEtESpAntECwAAFwZVAQlyAAcLAQABIwMBAQVdABAAAAyAjgoBLwCQKAAA")
	if err != nil {
		t.Fatalf("decode sample cb7: %v", err)
	}
	if err := os.WriteFile(archivePath, data, 0o644); err != nil {
		t.Fatalf("write archive: %v", err)
	}

	imageData, name, contentType, ok, err := extractArchiveCoverImage(archivePath)
	if err != nil {
		t.Fatalf("extractArchiveCoverImage() error = %v", err)
	}
	if !ok {
		t.Fatalf("expected archive cover preview to be available")
	}
	if name != "001-cover.png" {
		t.Fatalf("cover image name = %q, want %q", name, "001-cover.png")
	}
	if contentType != "image/png" {
		t.Fatalf("content type = %q, want %q", contentType, "image/png")
	}
	if len(imageData) == 0 {
		t.Fatalf("expected non-empty image data")
	}
}

func TestExtractArchivePreviewEntriesSupportsTar(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.tar")

	file, err := os.Create(archivePath)
	if err != nil {
		t.Fatalf("create archive: %v", err)
	}
	writer := tar.NewWriter(file)
	writeTarEntry(t, writer, "docs/", nil, true)
	writeTarEntry(t, writer, "docs/readme.txt", []byte("hello"), false)
	writeTarEntry(t, writer, "cover.jpg", []byte("jpg"), false)
	if err := writer.Close(); err != nil {
		t.Fatalf("close tar writer: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close archive: %v", err)
	}

	entries, truncated, err := extractArchivePreviewEntries(archivePath, 20, false)
	if err != nil {
		t.Fatalf("extractArchivePreviewEntries() error = %v", err)
	}
	if truncated {
		t.Fatalf("expected non-truncated entries")
	}
	if len(entries) != 2 {
		t.Fatalf("entry count = %d, want 2", len(entries))
	}
	if entries[0].Name != "docs" || !entries[0].IsDir {
		t.Fatalf("unexpected first entry: %#v", entries[0])
	}
	if entries[1].Name != "cover.jpg" || entries[1].IsDir {
		t.Fatalf("unexpected second entry: %#v", entries[1])
	}
}

func TestExtractArchivePreviewEntriesSupportsTgz(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.tgz")

	file, err := os.Create(archivePath)
	if err != nil {
		t.Fatalf("create archive: %v", err)
	}
	gzipWriter := gzip.NewWriter(file)
	writer := tar.NewWriter(gzipWriter)
	writeTarEntry(t, writer, "comic/", nil, true)
	writeTarEntry(t, writer, "comic/page1.png", tinyPNG, false)
	if err := writer.Close(); err != nil {
		t.Fatalf("close tar writer: %v", err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatalf("close gzip writer: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close archive: %v", err)
	}

	entries, truncated, err := extractArchivePreviewEntries(archivePath, 20, false)
	if err != nil {
		t.Fatalf("extractArchivePreviewEntries() error = %v", err)
	}
	if truncated {
		t.Fatalf("expected non-truncated entries")
	}
	if len(entries) != 1 || entries[0].Name != "comic" || !entries[0].IsDir {
		t.Fatalf("unexpected entries: %#v", entries)
	}
}

func TestExtractArchivePreviewEntriesSupports7z(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.7z")

	data, err := base64.StdEncoding.DecodeString("N3q8ryccAAS2z5IcEQAAAAAAAABaAAAAAAAAAO7hTnoBAAzvu79oZWxsbyA3eg0KAAEEBgABCREABwsBAAEhIQEADA0ACAoBHSCGCQAABQEZDAAAAAAAAAAAAAAAABEVAGMAbwB2AGUAcgAuAHQAeAB0AAAAFAoBAAUEnHFhztwBFQYBACAAAAAAAA==")
	if err != nil {
		t.Fatalf("decode sample 7z: %v", err)
	}
	if err := os.WriteFile(archivePath, data, 0o644); err != nil {
		t.Fatalf("write archive: %v", err)
	}

	entries, truncated, err := extractArchivePreviewEntries(archivePath, 20, false)
	if err != nil {
		t.Fatalf("extractArchivePreviewEntries() error = %v", err)
	}
	if truncated {
		t.Fatalf("expected non-truncated entries")
	}
	if len(entries) != 1 {
		t.Fatalf("entry count = %d, want 1", len(entries))
	}
	if entries[0].Name != "cover.txt" || entries[0].IsDir {
		t.Fatalf("unexpected first entry: %#v", entries[0])
	}
}

func TestExtractOpenDocumentTextSupportsOdt(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.odt")
	writeZipArchive(t, archivePath, map[string]string{
		"content.xml": `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="office" xmlns:text="text">
  <office:body>
    <office:text>
      <text:h>标题</text:h>
      <text:p>第一段内容</text:p>
      <text:p>第二段内容</text:p>
    </office:text>
  </office:body>
</office:document-content>`,
	})

	content, truncated, err := extractOpenDocumentText(archivePath, 64*1024)
	if err != nil {
		t.Fatalf("extractOpenDocumentText() error = %v", err)
	}
	if truncated {
		t.Fatalf("expected non-truncated content")
	}
	for _, want := range []string{"标题", "第一段内容", "第二段内容"} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected content to contain %q, got:\n%s", want, content)
		}
	}
}

func TestExtractOpenDocumentTextSupportsOds(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.ods")
	writeZipArchive(t, archivePath, map[string]string{
		"content.xml": `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="office" xmlns:table="table" xmlns:text="text">
  <office:body>
    <office:spreadsheet>
      <table:table table:name="Sheet1">
        <table:table-row>
          <table:table-cell><text:p>姓名</text:p></table:table-cell>
          <table:table-cell><text:p>年龄</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell><text:p>Alice</text:p></table:table-cell>
          <table:table-cell><text:p>18</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document-content>`,
	})

	content, truncated, err := extractOpenDocumentText(archivePath, 64*1024)
	if err != nil {
		t.Fatalf("extractOpenDocumentText() error = %v", err)
	}
	if truncated {
		t.Fatalf("expected non-truncated content")
	}
	for _, want := range []string{"姓名", "年龄", "Alice", "18"} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected content to contain %q, got:\n%s", want, content)
		}
	}
}

func TestExtractOpenDocumentTextSupportsOdp(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.odp")
	writeZipArchive(t, archivePath, map[string]string{
		"content.xml": `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="office" xmlns:text="text">
  <office:body>
    <office:presentation>
      <draw:page xmlns:draw="draw">
        <text:p>第一页标题</text:p>
        <text:p>第一页说明</text:p>
      </draw:page>
    </office:presentation>
  </office:body>
</office:document-content>`,
	})

	content, truncated, err := extractOpenDocumentText(archivePath, 64*1024)
	if err != nil {
		t.Fatalf("extractOpenDocumentText() error = %v", err)
	}
	if truncated {
		t.Fatalf("expected non-truncated content")
	}
	for _, want := range []string{"第一页标题", "第一页说明"} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected content to contain %q, got:\n%s", want, content)
		}
	}
}

func TestBuildOfficeTextPreviewSupportsEtAlias(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.et")
	writeZipArchive(t, archivePath, map[string]string{
		"xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
		"xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
</Relationships>`,
		"xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
<worksheet>
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>货物清单</t></is></c>
      <c r="B1" t="inlineStr"><is><t>Sheet1</t></is></c>
    </row>
  </sheetData>
</worksheet>`,
	})

	content, truncated, ok, err := buildOfficeTextPreview(archivePath, 64*1024)
	if err != nil {
		t.Fatalf("buildOfficeTextPreview() error = %v", err)
	}
	if !ok {
		t.Fatalf("expected ET alias preview to be supported")
	}
	if truncated {
		t.Fatalf("expected non-truncated content")
	}
	for _, want := range []string{"Sheet 1: Sheet1", "货物清单"} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected content to contain %q, got:\n%s", want, content)
		}
	}
}

func TestBuildOfficeTextPreviewSupportsDpsAlias(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sample.dps")
	writeZipArchive(t, archivePath, map[string]string{
		"ppt/presentation.xml": `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>`,
		"ppt/_rels/presentation.xml.rels": `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="slides/slide1.xml"/>
</Relationships>`,
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp><p:txBody><a:p><a:r><a:t>第一页标题</a:t></a:r></a:p></p:txBody></p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
	})

	content, truncated, ok, err := buildOfficeTextPreview(archivePath, 64*1024)
	if err != nil {
		t.Fatalf("buildOfficeTextPreview() error = %v", err)
	}
	if !ok {
		t.Fatalf("expected DPS alias preview to be supported")
	}
	if truncated {
		t.Fatalf("expected non-truncated content")
	}
	for _, want := range []string{"[Slide 1]", "第一页标题"} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected content to contain %q, got:\n%s", want, content)
		}
	}
}

func TestIsAliasedOfficePreviewPath(t *testing.T) {
	cases := map[string]bool{
		"sample.wps":  true,
		"sample.wpt":  true,
		"sample.et":   true,
		"sample.ett":  true,
		"sample.dps":  true,
		"sample.dpt":  true,
		"sample.docx": false,
		"sample.txt":  false,
	}
	for path, want := range cases {
		if got := isAliasedOfficePreviewPath(path); got != want {
			t.Fatalf("isAliasedOfficePreviewPath(%q) = %v, want %v", path, got, want)
		}
	}
}

func TestBuildTextPreviewPayloadReturnsUnsupportedForLegacyWps(t *testing.T) {
	tempDir := t.TempDir()
	targetPath := filepath.Join(tempDir, "legacy.wps")
	if err := os.WriteFile(targetPath, []byte{0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00, 0x00, 0x00}, 0o644); err != nil {
		t.Fatalf("write legacy wps: %v", err)
	}

	info, err := os.Stat(targetPath)
	if err != nil {
		t.Fatalf("stat legacy wps: %v", err)
	}

	payload, err := buildTextPreviewPayload(targetPath, info, 64*1024, false)
	if err != nil {
		t.Fatalf("buildTextPreviewPayload() error = %v", err)
	}
	if got := payload["kind"]; got != "unsupported" {
		t.Fatalf("payload kind = %v, want unsupported", got)
	}
}

func TestIsLegacyBinaryOfficePreviewPath(t *testing.T) {
	cases := map[string]bool{
		"sample.doc":  true,
		"sample.xls":  true,
		"sample.ppt":  true,
		"sample.docx": false,
		"sample.txt":  false,
	}
	for path, want := range cases {
		if got := isLegacyBinaryOfficePreviewPath(path); got != want {
			t.Fatalf("isLegacyBinaryOfficePreviewPath(%q) = %v, want %v", path, got, want)
		}
	}
}

func TestIsOfficeTempPreviewPath(t *testing.T) {
	cases := map[string]bool{
		"~$sample.docx":     true,
		"/data/~$sheet.xlsx": true,
		"sample.docx":       false,
		"notes.txt":         false,
	}
	for path, want := range cases {
		if got := isOfficeTempPreviewPath(path); got != want {
			t.Fatalf("isOfficeTempPreviewPath(%q) = %v, want %v", path, got, want)
		}
	}
}

func TestBuildTextPreviewPayloadReturnsUnsupportedForOfficeTempFile(t *testing.T) {
	tempDir := t.TempDir()
	targetPath := filepath.Join(tempDir, "~$代理告知书.docx")
	if err := os.WriteFile(targetPath, []byte("temporary office lock file"), 0o644); err != nil {
		t.Fatalf("write temp office file: %v", err)
	}

	info, err := os.Stat(targetPath)
	if err != nil {
		t.Fatalf("stat temp office file: %v", err)
	}

	payload, err := buildTextPreviewPayload(targetPath, info, 64*1024, false)
	if err != nil {
		t.Fatalf("buildTextPreviewPayload() error = %v", err)
	}
	if got := payload["kind"]; got != "unsupported" {
		t.Fatalf("payload kind = %v, want unsupported", got)
	}
}

func TestBuildTextPreviewPayloadReturnsUnsupportedForLegacyBinaryOffice(t *testing.T) {
	for _, ext := range []string{"doc", "xls", "ppt"} {
		t.Run(ext, func(t *testing.T) {
			tempDir := t.TempDir()
			targetPath := filepath.Join(tempDir, "legacy."+ext)
			if err := os.WriteFile(targetPath, []byte{0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00, 0x00, 0x00}, 0o644); err != nil {
				t.Fatalf("write legacy %s: %v", ext, err)
			}

			info, err := os.Stat(targetPath)
			if err != nil {
				t.Fatalf("stat legacy %s: %v", ext, err)
			}

			payload, err := buildTextPreviewPayload(targetPath, info, 64*1024, false)
			if err != nil {
				t.Fatalf("buildTextPreviewPayload() error = %v", err)
			}
			if got := payload["kind"]; got != "unsupported" {
				t.Fatalf("payload kind = %v, want unsupported", got)
			}
		})
	}
}

func TestNormalizeZipTarget(t *testing.T) {
	got := normalizeZipTarget("xl", "../worksheets/sheet1.xml")
	want := "worksheets/sheet1.xml"
	if got != want {
		t.Fatalf("normalizeZipTarget() = %q, want %q", got, want)
	}
}

func writeTarEntry(t *testing.T, writer *tar.Writer, name string, data []byte, isDir bool) {
	t.Helper()
	header := &tar.Header{
		Name: name,
		Mode: 0o644,
		Size: int64(len(data)),
	}
	if isDir {
		header.Typeflag = tar.TypeDir
		header.Mode = 0o755
		header.Size = 0
	}
	if err := writer.WriteHeader(header); err != nil {
		t.Fatalf("write tar header %q: %v", name, err)
	}
	if !isDir && len(data) > 0 {
		if _, err := writer.Write(data); err != nil {
			t.Fatalf("write tar body %q: %v", name, err)
		}
	}
}

func writeZipArchive(t *testing.T, archivePath string, files map[string]string) {
	t.Helper()
	file, err := os.Create(archivePath)
	if err != nil {
		t.Fatalf("create archive: %v", err)
	}
	writer := zip.NewWriter(file)
	for name, content := range files {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatalf("create entry %q: %v", name, err)
		}
		if _, err := entry.Write([]byte(content)); err != nil {
			t.Fatalf("write entry %q: %v", name, err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close file: %v", err)
	}
}
