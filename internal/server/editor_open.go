package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type editorTarget string

const (
	editorTargetFile      editorTarget = "file"
	editorTargetDirectory editorTarget = "directory"
	editorTargetReveal    editorTarget = "reveal"
)

type editorDefinition struct {
	ID            string
	Label         string
	DarwinAppName string
	CLI           string
	Target        editorTarget
}

type openEditorRequest struct {
	Editor string `json:"editor"`
}

var knownEditors = map[string]editorDefinition{
	"vscode": {
		ID:            "vscode",
		Label:         "VS Code",
		DarwinAppName: "Visual Studio Code",
		CLI:           "code",
		Target:        editorTargetFile,
	},
	"vscode-insiders": {
		ID:            "vscode-insiders",
		Label:         "VS Code Insiders",
		DarwinAppName: "Visual Studio Code - Insiders",
		CLI:           "code-insiders",
		Target:        editorTargetFile,
	},
	"cursor": {
		ID:            "cursor",
		Label:         "Cursor",
		DarwinAppName: "Cursor",
		CLI:           "cursor",
		Target:        editorTargetFile,
	},
	"zed": {
		ID:            "zed",
		Label:         "Zed",
		DarwinAppName: "Zed",
		CLI:           "zed",
		Target:        editorTargetFile,
	},
	"finder": {
		ID:            "finder",
		Label:         "Finder",
		DarwinAppName: "Finder",
		Target:        editorTargetReveal,
	},
	"terminal": {
		ID:            "terminal",
		Label:         "Terminal",
		DarwinAppName: "Terminal",
		Target:        editorTargetDirectory,
	},
	"iterm2": {
		ID:            "iterm2",
		Label:         "iTerm2",
		DarwinAppName: "iTerm",
		Target:        editorTargetDirectory,
	},
	"ghostty": {
		ID:            "ghostty",
		Label:         "Ghostty",
		DarwinAppName: "Ghostty",
		Target:        editorTargetDirectory,
	},
	"warp": {
		ID:            "warp",
		Label:         "Warp",
		DarwinAppName: "Warp",
		Target:        editorTargetDirectory,
	},
	"xcode": {
		ID:            "xcode",
		Label:         "Xcode",
		DarwinAppName: "Xcode",
		Target:        editorTargetFile,
	},
	"rider": {
		ID:            "rider",
		Label:         "Rider",
		DarwinAppName: "Rider",
		CLI:           "rider",
		Target:        editorTargetFile,
	},
	"goland": {
		ID:            "goland",
		Label:         "GoLand",
		DarwinAppName: "GoLand",
		CLI:           "goland",
		Target:        editorTargetFile,
	},
	"webstorm": {
		ID:            "webstorm",
		Label:         "WebStorm",
		DarwinAppName: "WebStorm",
		CLI:           "webstorm",
		Target:        editorTargetFile,
	},
}

var openFileInEditor = launchFileInEditor

func handleOpenFileInEditor(state *State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupName, err := resolveGroupFromPath(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		id := r.PathValue("id")
		if id == "" {
			http.Error(w, "missing file id", http.StatusBadRequest)
			return
		}

		var req openEditorRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024)).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		editorID := strings.TrimSpace(req.Editor)
		if !isKnownEditorID(editorID) {
			http.Error(w, "unsupported editor", http.StatusBadRequest)
			return
		}

		entry := state.FindFile(id, groupName)
		if entry == nil {
			http.Error(w, "file not found", http.StatusNotFound)
			return
		}
		if entry.Uploaded {
			http.Error(w, "uploaded files cannot be opened in an external editor", http.StatusBadRequest)
			return
		}

		if err := openFileInEditor(editorID, entry.Path); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func isKnownEditorID(editorID string) bool {
	_, ok := knownEditors[editorID]
	return ok
}

func launchFileInEditor(editorID, path string) error {
	editor, ok := knownEditors[editorID]
	if !ok {
		return fmt.Errorf("unsupported editor: %s", editorID)
	}

	switch runtime.GOOS {
	case "darwin":
		return launchFileInEditorDarwin(editor, path)
	default:
		return launchFileInEditorCLI(editor, path)
	}
}

func launchFileInEditorDarwin(editor editorDefinition, path string) error {
	if editor.Target == editorTargetReveal {
		return runEditorCommand("open", "-R", path)
	}
	target := path
	if editor.Target == editorTargetDirectory {
		target = filepath.Dir(path)
	}
	return runEditorCommand("open", "-a", editor.DarwinAppName, target)
}

func launchFileInEditorCLI(editor editorDefinition, path string) error {
	if editor.CLI == "" {
		return fmt.Errorf("%s is only supported on macOS", editor.Label)
	}
	if editor.Target != editorTargetFile {
		return fmt.Errorf("%s is only supported on macOS", editor.Label)
	}
	return runEditorCommand(editor.CLI, path)
}

func runEditorCommand(name string, args ...string) error {
	cmd := exec.Command(name, args...) //nolint:gosec // Command and args are selected from a fixed editor registry.
	output, err := cmd.CombinedOutput()
	if err == nil {
		return nil
	}
	message := strings.TrimSpace(string(output))
	if message == "" {
		message = err.Error()
	}
	if errors.Is(err, exec.ErrNotFound) {
		return fmt.Errorf("editor command not found: %s", name)
	}
	return fmt.Errorf("failed to open editor: %s", message)
}
