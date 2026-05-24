package server

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mkusaka/po/version"
)

const defaultAgenticSearchTimeout = 3 * time.Minute

// AgenticSearchJob describes a read-only Codex app-server search request.
type AgenticSearchJob struct {
	Query     string
	RepoRoot  string
	RepoName  string
	Group     string
	FilePaths []string
	History   []AgenticSearchHistoryMessage
}

// AgenticSearchHistoryMessage carries prior chat context for follow-up searches.
type AgenticSearchHistoryMessage struct {
	Role    string
	Content string
}

// AgenticSearchResult is returned by an agentic search runner.
type AgenticSearchResult struct {
	Answer string
}

const (
	AgenticSearchEventOutputDelta   = "output_delta"
	AgenticSearchEventThinkingDelta = "thinking_delta"
	AgenticSearchEventProgress      = "progress"
)

// AgenticSearchEvent is emitted by an agentic search runner while it is running.
type AgenticSearchEvent struct {
	Type    string `json:"type"`
	Delta   string `json:"delta,omitempty"`
	Message string `json:"message,omitempty"`
}

// AgenticSearchEventWriter forwards runner events to the caller.
type AgenticSearchEventWriter func(AgenticSearchEvent) error

// AgenticSearchRunner runs an agentic search against a repository.
type AgenticSearchRunner func(context.Context, AgenticSearchJob, AgenticSearchEventWriter) (AgenticSearchResult, error)

type agenticSearchConfig struct {
	enabled bool
	timeout time.Duration
	runner  AgenticSearchRunner
}

func defaultAgenticSearchConfig() agenticSearchConfig {
	return agenticSearchConfig{
		timeout: defaultAgenticSearchTimeout,
		runner:  runCodexAgenticSearch,
	}
}

func (s *State) EnableAgenticSearch(timeout time.Duration) {
	if timeout <= 0 {
		timeout = defaultAgenticSearchTimeout
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.agenticSearch.runner == nil {
		s.agenticSearch.runner = runCodexAgenticSearch
	}
	s.agenticSearch.enabled = true
	s.agenticSearch.timeout = timeout
}

func (s *State) SetAgenticSearchRunner(runner AgenticSearchRunner) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.agenticSearch.runner = runner
}

func (s *State) AgenticSearchEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.agenticSearch.enabled
}

func (s *State) agenticSearchSnapshot() agenticSearchConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cfg := s.agenticSearch
	if cfg.timeout <= 0 {
		cfg.timeout = defaultAgenticSearchTimeout
	}
	if cfg.runner == nil {
		cfg.runner = runCodexAgenticSearch
	}
	return cfg
}

type appServerClient struct {
	cmd         *exec.Cmd
	stdin       io.WriteCloser
	stdout      *bufio.Scanner
	stderr      bytes.Buffer
	stderrMu    sync.Mutex
	nextRequest atomic.Int64
}

func newAppServerClient(ctx context.Context, cwd string) (*appServerClient, error) {
	cmd := exec.CommandContext(ctx, "codex", "app-server", "--listen", "stdio://") //nolint:gosec
	cmd.Dir = cwd

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	client := &appServerClient{
		cmd:    cmd,
		stdin:  stdin,
		stdout: bufio.NewScanner(stdout),
	}
	client.stdout.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	go func() {
		var buf bytes.Buffer
		if _, err := io.Copy(&buf, stderr); err != nil {
			slog.Warn("failed to read codex app-server stderr", "error", err)
		}
		client.stderrMu.Lock()
		defer client.stderrMu.Unlock()
		if _, err := client.stderr.Write(buf.Bytes()); err != nil {
			slog.Warn("failed to store codex app-server stderr", "error", err)
		}
	}()

	return client, nil
}

func (c *appServerClient) close() {
	if c.stdin != nil {
		if err := c.stdin.Close(); err != nil {
			slog.Warn("failed to close codex app-server stdin", "error", err)
		}
	}
	if c.cmd != nil && c.cmd.Process != nil {
		if err := c.cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
			slog.Warn("failed to kill codex app-server", "error", err)
		}
		if err := c.cmd.Wait(); err != nil {
			var exitErr *exec.ExitError
			if !errors.As(err, &exitErr) {
				slog.Warn("failed to wait for codex app-server", "error", err)
			}
		}
	}
}

func (c *appServerClient) call(method string, params any, onNotification func(map[string]any) bool) (map[string]any, error) {
	id := fmt.Sprintf("%d", c.nextRequest.Add(1))
	msg := map[string]any{
		"id":     id,
		"method": method,
	}
	if params != nil {
		msg["params"] = params
	}
	if err := c.write(msg); err != nil {
		return nil, err
	}

	for c.stdout.Scan() {
		line := c.stdout.Bytes()
		var resp map[string]any
		if err := json.Unmarshal(line, &resp); err != nil {
			return nil, fmt.Errorf("invalid codex app-server response: %w", err)
		}
		if respID, ok := resp["id"].(string); ok && respID == id {
			if rawErr, ok := resp["error"].(map[string]any); ok {
				return nil, formatAppServerError(rawErr)
			}
			result, ok := resp["result"].(map[string]any)
			if !ok {
				return nil, fmt.Errorf("codex app-server %s response did not include an object result", method)
			}
			return result, nil
		}
		if _, hasMethod := resp["method"]; hasMethod {
			if _, hasID := resp["id"]; hasID {
				if err := c.write(map[string]any{
					"id":     resp["id"],
					"result": appServerServerRequestResult(resp),
				}); err != nil {
					return nil, err
				}
				continue
			}
			if onNotification != nil && onNotification(resp) {
				return nil, nil
			}
		}
	}
	if err := c.stdout.Err(); err != nil {
		return nil, err
	}
	return nil, fmt.Errorf("codex app-server closed stdout: %s", truncateForError(c.stderrString()))
}

func (c *appServerClient) notify(method string, params any) error {
	msg := map[string]any{"method": method}
	if params != nil {
		msg["params"] = params
	}
	return c.write(msg)
}

func (c *appServerClient) write(msg map[string]any) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	_, err = c.stdin.Write(append(data, '\n'))
	return err
}

func runCodexAgenticSearch(ctx context.Context, job AgenticSearchJob, emit AgenticSearchEventWriter) (AgenticSearchResult, error) {
	client, err := newAppServerClient(ctx, job.RepoRoot)
	if err != nil {
		return AgenticSearchResult{}, fmt.Errorf("failed to start codex app-server: %w", err)
	}
	defer client.close()

	_, err = client.call("initialize", map[string]any{
		"clientInfo": map[string]any{
			"name":    "po_agentic_search",
			"title":   "po Agentic Search",
			"version": version.Version,
		},
		"capabilities": map[string]any{
			"experimentalApi": true,
		},
	}, nil)
	if err != nil {
		return AgenticSearchResult{}, err
	}
	if err := client.notify("initialized", nil); err != nil {
		return AgenticSearchResult{}, err
	}

	threadResp, err := client.call("thread/start", map[string]any{
		"cwd":                   job.RepoRoot,
		"ephemeral":             true,
		"approvalPolicy":        "never",
		"sandbox":               "read-only",
		"runtimeWorkspaceRoots": []string{job.RepoRoot},
		"developerInstructions": agenticSearchDeveloperInstructions(),
		"serviceName":           "po_agentic_search",
	}, nil)
	if err != nil {
		return AgenticSearchResult{}, err
	}
	threadID, err := extractThreadID(threadResp)
	if err != nil {
		return AgenticSearchResult{}, err
	}

	prompt := buildAgenticSearchPrompt(job)
	turnResp, err := client.call("turn/start", map[string]any{
		"threadId": threadID,
		"input": []map[string]any{
			{
				"type": "text",
				"text": prompt,
			},
		},
		"cwd":                   job.RepoRoot,
		"approvalPolicy":        "never",
		"runtimeWorkspaceRoots": []string{job.RepoRoot},
		"sandboxPolicy": map[string]any{
			"type":          "readOnly",
			"networkAccess": false,
		},
	}, nil)
	if err != nil {
		return AgenticSearchResult{}, err
	}
	turnID, err := extractTurnID(turnResp)
	if err != nil {
		return AgenticSearchResult{}, err
	}

	var answer strings.Builder
	var completed map[string]any
	for completed == nil {
		err := client.readNotification(func(msg map[string]any) (bool, error) {
			method, _ := msg["method"].(string)
			params, _ := msg["params"].(map[string]any)
			if params == nil {
				params = map[string]any{}
			}
			if event, ok := agenticSearchEventFromNotification(method, params, threadID, turnID); ok {
				if err := emitAgenticSearchEvent(emit, event); err != nil {
					return true, err
				}
			}
			switch method {
			case "item/agentMessage/delta":
				if params["turnId"] == turnID {
					if delta, ok := params["delta"].(string); ok {
						answer.WriteString(delta)
					}
				}
			case "turn/completed":
				if params["threadId"] == threadID {
					if turn, ok := params["turn"].(map[string]any); ok && turn["id"] == turnID {
						completed = turn
						return true, nil
					}
				}
			case "error":
				if message, ok := params["message"].(string); ok {
					completed = map[string]any{
						"status": "failed",
						"error": map[string]any{
							"message": message,
						},
					}
					return true, nil
				}
			}
			return false, nil
		})
		if err != nil {
			return AgenticSearchResult{}, err
		}
	}

	if status, _ := completed["status"].(string); status == "failed" {
		return AgenticSearchResult{}, extractTurnError(completed)
	}
	result := strings.TrimSpace(answer.String())
	if result == "" {
		result = strings.TrimSpace(extractFinalAgentMessage(completed))
	}
	if result == "" {
		return AgenticSearchResult{}, errors.New("codex app-server completed without an answer")
	}
	return AgenticSearchResult{Answer: result}, nil
}

func emitAgenticSearchEvent(emit AgenticSearchEventWriter, event AgenticSearchEvent) error {
	if emit == nil || event.Type == "" {
		return nil
	}
	return emit(event)
}

func agenticSearchEventFromNotification(method string, params map[string]any, threadID, turnID string) (AgenticSearchEvent, bool) {
	if !notificationMatchesTurn(params, threadID, turnID) {
		return AgenticSearchEvent{}, false
	}
	switch method {
	case "item/agentMessage/delta":
		return agenticSearchDeltaEvent(AgenticSearchEventOutputDelta, params)
	case "item/reasoning/summaryTextDelta", "item/plan/delta":
		return agenticSearchDeltaEvent(AgenticSearchEventThinkingDelta, params)
	case "item/started":
		return agenticSearchItemStartedEvent(params)
	}
	return AgenticSearchEvent{}, false
}

func notificationMatchesTurn(params map[string]any, threadID, turnID string) bool {
	if params == nil {
		return false
	}
	return params["threadId"] == threadID && params["turnId"] == turnID
}

func agenticSearchDeltaEvent(eventType string, params map[string]any) (AgenticSearchEvent, bool) {
	delta, _ := params["delta"].(string)
	if delta == "" {
		return AgenticSearchEvent{}, false
	}
	return AgenticSearchEvent{Type: eventType, Delta: delta}, true
}

func agenticSearchItemStartedEvent(params map[string]any) (AgenticSearchEvent, bool) {
	item, _ := params["item"].(map[string]any)
	itemType, _ := item["type"].(string)
	switch itemType {
	case "commandExecution":
		command, _ := item["command"].(string)
		if command == "" {
			return AgenticSearchEvent{}, false
		}
		return AgenticSearchEvent{Type: AgenticSearchEventProgress, Message: "$ " + command}, true
	case "mcpToolCall":
		name, _ := item["name"].(string)
		if name == "" {
			return AgenticSearchEvent{}, false
		}
		return AgenticSearchEvent{Type: AgenticSearchEventProgress, Message: name}, true
	default:
		return AgenticSearchEvent{}, false
	}
}

func (c *appServerClient) readNotification(onNotification func(map[string]any) (bool, error)) error {
	for c.stdout.Scan() {
		line := c.stdout.Bytes()
		var msg map[string]any
		if err := json.Unmarshal(line, &msg); err != nil {
			return fmt.Errorf("invalid codex app-server notification: %w", err)
		}
		if _, hasMethod := msg["method"]; hasMethod {
			if _, hasID := msg["id"]; hasID {
				if err := c.write(map[string]any{
					"id":     msg["id"],
					"result": appServerServerRequestResult(msg),
				}); err != nil {
					return err
				}
				continue
			}
			if onNotification != nil {
				done, err := onNotification(msg)
				if err != nil {
					return err
				}
				if done {
					return nil
				}
			}
		}
	}
	if err := c.stdout.Err(); err != nil {
		return err
	}
	return fmt.Errorf("codex app-server closed stdout: %s", truncateForError(c.stderrString()))
}

func (c *appServerClient) stderrString() string {
	c.stderrMu.Lock()
	defer c.stderrMu.Unlock()
	return c.stderr.String()
}

func agenticSearchDeveloperInstructions() string {
	return strings.Join([]string{
		"You are serving a read-only search request from po, a local Markdown repository viewer.",
		"Answer only from files under the provided repository root.",
		"Do not edit files, do not create files, and do not use network or web sources.",
		"Use shell commands only for read-only repository inspection such as rg, find, git grep, sed, or cat.",
		"Return a concise Markdown answer. Include repo-relative file paths and line numbers when they support the answer.",
	}, "\n")
}

func buildAgenticSearchPrompt(job AgenticSearchJob) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Repository: %s\n", job.RepoName)
	fmt.Fprintf(&b, "Repository root: %s\n", job.RepoRoot)
	if job.Group != "" {
		fmt.Fprintf(&b, "Current po group: %s\n", job.Group)
	}
	if len(job.FilePaths) > 0 {
		b.WriteString("\nMarkdown files currently opened in po:\n")
		for i, path := range job.FilePaths {
			if i >= 200 {
				fmt.Fprintf(&b, "- ... and %d more\n", len(job.FilePaths)-i)
				break
			}
			fmt.Fprintf(&b, "- %s\n", filepath.ToSlash(path))
		}
	}
	if len(job.History) > 0 {
		b.WriteString("\nPrevious chat messages in this po search session (oldest to newest):\n")
		for _, msg := range job.History {
			fmt.Fprintf(&b, "%s: %s\n", msg.Role, msg.Content)
		}
		b.WriteString("Use this history to resolve follow-up references, but verify repository facts again.\n")
	}
	b.WriteString("\nSearch request:\n")
	b.WriteString(job.Query)
	b.WriteString("\n")
	return b.String()
}

func extractThreadID(resp map[string]any) (string, error) {
	thread, ok := resp["thread"].(map[string]any)
	if !ok {
		return "", errors.New("thread/start response did not include thread")
	}
	id, ok := thread["id"].(string)
	if !ok || id == "" {
		return "", errors.New("thread/start response did not include thread.id")
	}
	return id, nil
}

func extractTurnID(resp map[string]any) (string, error) {
	turn, ok := resp["turn"].(map[string]any)
	if !ok {
		return "", errors.New("turn/start response did not include turn")
	}
	id, ok := turn["id"].(string)
	if !ok || id == "" {
		return "", errors.New("turn/start response did not include turn.id")
	}
	return id, nil
}

func extractTurnError(turn map[string]any) error {
	if rawErr, ok := turn["error"].(map[string]any); ok {
		if msg, ok := rawErr["message"].(string); ok && msg != "" {
			return errors.New(msg)
		}
	}
	return errors.New("codex app-server turn failed")
}

func extractFinalAgentMessage(turn map[string]any) string {
	items, ok := turn["items"].([]any)
	if !ok {
		return ""
	}
	for _, rawItem := range slices.Backward(items) {
		item, ok := rawItem.(map[string]any)
		if !ok || item["type"] != "agentMessage" {
			continue
		}
		if text, ok := item["text"].(string); ok {
			return text
		}
	}
	return ""
}

func formatAppServerError(rawErr map[string]any) error {
	msg, _ := rawErr["message"].(string)
	if msg == "" {
		msg = "codex app-server request failed"
	}
	if code, ok := rawErr["code"].(float64); ok {
		return fmt.Errorf("codex app-server error %.0f: %s", code, msg)
	}
	return errors.New(msg)
}

func appServerServerRequestResult(msg map[string]any) map[string]any {
	method, _ := msg["method"].(string)
	switch method {
	case "item/commandExecution/requestApproval":
		return map[string]any{"decision": "decline"}
	case "item/fileChange/requestApproval":
		return map[string]any{"decision": "decline"}
	default:
		return map[string]any{}
	}
}

func truncateForError(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 2000 {
		return s[:2000] + "..."
	}
	return s
}

func sortedRepoRelativeFilePaths(files []*FileEntry, repoRoot string) []string {
	paths := make([]string, 0, len(files))
	for _, f := range files {
		if f == nil || f.Uploaded {
			continue
		}
		if f.RelativePath != "" {
			paths = append(paths, f.RelativePath)
			continue
		}
		rel, err := filepath.Rel(repoRoot, f.Path)
		if err == nil && rel != "." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel) {
			paths = append(paths, rel)
		}
	}
	sort.Strings(paths)
	return paths
}

func logAgenticSearchError(err error) {
	if err != nil {
		slog.Warn("agentic search failed", "error", err)
	}
}
