package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type fileDiffResponse struct {
	FileName     string `json:"fileName"`
	RelativePath string `json:"relativePath"`
	BaseRef      string `json:"baseRef"`
	BaseExists   bool   `json:"baseExists"`
	OldContent   string `json:"oldContent"`
	NewContent   string `json:"newContent"`
}

type gitFileContext struct {
	root string
	rel  string
}

func handleFileDiff(state *State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		group, err := resolveGroupFromPath(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		id := r.PathValue("id")
		if id == "" {
			http.Error(w, "missing file id", http.StatusBadRequest)
			return
		}

		entry := state.FindFile(id, group)
		if entry == nil {
			http.Error(w, "file not found", http.StatusNotFound)
			return
		}
		if entry.Uploaded {
			http.Error(w, "diff view is not available for uploaded files", http.StatusBadRequest)
			return
		}

		newContent, err := os.ReadFile(entry.Path) //nolint:gosec // Path is server-managed, not direct user input.
		if err != nil {
			if os.IsNotExist(err) {
				state.RemoveFilesByPath(entry.Path)
				http.Error(w, "file not found", http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		ctx, err := gitContextForEntry(state, entry)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := verifyGitHead(ctx.root); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		oldContent, baseExists, err := gitShowHeadFile(ctx.root, ctx.rel)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(fileDiffResponse{
			FileName:     entry.Name,
			RelativePath: ctx.rel,
			BaseRef:      "HEAD",
			BaseExists:   baseExists,
			OldContent:   oldContent,
			NewContent:   string(newContent),
		}); err != nil {
			slog.Error("failed to encode response", "error", err)
		}
	}
}

func gitContextForEntry(state *State, entry *FileEntry) (gitFileContext, error) {
	if entry.RelativePath != "" {
		scope := state.RepoScope()
		if scope.Enabled() {
			return gitFileContext{root: scope.Root, rel: entry.RelativePath}, nil
		}
	}

	root, err := gitRootForPath(filepath.Dir(entry.Path))
	if err != nil {
		return gitFileContext{}, err
	}
	rel, err := filepath.Rel(root, entry.Path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return gitFileContext{}, fmt.Errorf("file %s is outside git repository %s", entry.Path, root)
	}
	return gitFileContext{root: root, rel: filepath.ToSlash(rel)}, nil
}

func gitRootForPath(path string) (string, error) {
	out, err := exec.Command("git", "-C", path, "rev-parse", "--show-toplevel").Output() //nolint:gosec
	if err != nil {
		return "", fmt.Errorf("cannot find git repository root from %s", path)
	}
	root := strings.TrimSpace(string(out))
	if root == "" {
		return "", fmt.Errorf("cannot find git repository root from %s", path)
	}
	return filepath.Clean(root), nil
}

func verifyGitHead(root string) error {
	if err := exec.Command("git", "-C", root, "rev-parse", "--verify", "HEAD").Run(); err != nil { //nolint:gosec
		return fmt.Errorf("git HEAD is not available for %s", root)
	}
	return nil
}

func gitShowHeadFile(root, rel string) (string, bool, error) {
	out, err := exec.Command("git", "-C", root, "show", "HEAD:"+filepath.ToSlash(rel)).Output() //nolint:gosec
	if err == nil {
		return string(out), true, nil
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		return "", false, nil
	}
	return "", false, fmt.Errorf("failed to read %s from git HEAD: %w", rel, err)
}
