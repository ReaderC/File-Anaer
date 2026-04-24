package treemap

import "testing"

func TestParseTreeAndTrimDepth(t *testing.T) {
	payload := []byte(`{
		"name": "data",
		"path": "/data",
		"size": 100,
		"children": [
			{
				"name": "documents",
				"path": "/data/documents",
				"size": 60,
				"children": [
					{
						"name": "report.pdf",
						"path": "/data/documents/report.pdf",
						"size": 60
					}
				]
			},
			{
				"name": "video.mp4",
				"path": "/data/video.mp4",
				"size": 40
			}
		]
	}`)

	root, err := parseTree(payload)
	if err != nil {
		t.Fatalf("parseTree returned error: %v", err)
	}
	if len(root.Children) != 2 {
		t.Fatalf("expected 2 children, got %d", len(root.Children))
	}

	trimmed := trimTree(root, 0, 1)
	if len(trimmed.Children) != 2 {
		t.Fatalf("expected first level children to remain, got %d", len(trimmed.Children))
	}
	if len(trimmed.Children[0].Children) != 0 {
		t.Fatal("expected nested children to be trimmed at max depth")
	}
}

func TestParseArrayExportPayload(t *testing.T) {
	payload := []byte(`[1,2,{"progname":"gdu"},[{"name":"/data","mtime":1774428734},[{"name":"photos","mtime":1772008763},{"name":"a.jpg","asize":10,"dsize":12,"mtime":1743769052},{"name":"b.jpg","asize":20,"dsize":24,"mtime":1743769053}],{"name":"video.mp4","asize":30,"dsize":32,"mtime":1743769054}]]`)

	root, err := parseTree(payload)
	if err != nil {
		t.Fatalf("parseTree returned error: %v", err)
	}
	if root.Path != "/data" {
		t.Fatalf("expected root path /data, got %s", root.Path)
	}
	if len(root.Children) != 2 {
		t.Fatalf("expected 2 root children, got %d", len(root.Children))
	}
	if root.SizeBytes != 68 {
		t.Fatalf("expected total size 68, got %d", root.SizeBytes)
	}
	if root.Children[0].Type != "directory" {
		t.Fatalf("expected first child to be directory, got %s", root.Children[0].Type)
	}
}
