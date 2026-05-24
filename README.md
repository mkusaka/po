<p align="center">
<br><br><br>
<img src="https://github.com/mkusaka/po/raw/main/images/logo.svg" width="120" alt="po">
<br><br><br>
</p>

# po

[![build](https://github.com/mkusaka/po/actions/workflows/ci.yml/badge.svg)](https://github.com/mkusaka/po/actions/workflows/ci.yml) ![Coverage](https://raw.githubusercontent.com/k1LoW/octocovs/main/badges/mkusaka/po/coverage.svg) ![Code to Test Ratio](https://raw.githubusercontent.com/k1LoW/octocovs/main/badges/mkusaka/po/ratio.svg) ![Test Execution Time](https://raw.githubusercontent.com/k1LoW/octocovs/main/badges/mkusaka/po/time.svg)

`po` is a Markdown viewer that opens `.md` files in a browser.

## Features

- GitHub-flavored Markdown (tables, task lists, footnotes, etc.)
- Syntax highlighting ([Shiki](https://shiki.style/))
- [Mermaid](https://mermaid.js.org/) diagram rendering
- LaTeX math rendering ([KaTeX](https://katex.org/))
- [GitHub Alerts](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts) (admonitions)
- Fullscreen zoom modal for images and Mermaid diagrams
- <img src="images/icons/theme-light.svg" width="16" height="16" alt="dark theme"> Dark / <img src="images/icons/theme-dark.svg" width="16" height="16" alt="light theme"> light theme
- <img src="images/icons/group.svg" width="16" height="16" alt="group"> File grouping
- <img src="images/icons/toc.svg" width="16" height="16" alt="toc"> Table of contents panel
- <img src="images/icons/view-flat.svg" width="16" height="16" alt="flat view"> Flat / <img src="images/icons/view-tree.svg" width="16" height="16" alt="tree view"> tree sidebar view with drag-and-drop reorder
- <img src="images/icons/title-filename.svg" width="16" height="16" alt="file name"> File name / <img src="images/icons/title-heading.svg" width="16" height="16" alt="heading title"> heading title sidebar display toggle (per-group)
- <img src="images/icons/search.svg" width="16" height="16" alt="search"> Full-text search across file names and content
- YAML frontmatter display (collapsible metadata block)
- MDX file support (renders as Markdown, strips `import`/`export`, escapes JSX tags)
- <img src="images/icons/font-size.svg" width="16" height="16" alt="font size"> Content font size toggle (small / medium / large / extra large)
- <img src="images/icons/width-expand.svg" width="16" height="16" alt="wide view"> Wide / <img src="images/icons/width-compress.svg" width="16" height="16" alt="narrow view"> narrow content width toggle
- <img src="images/icons/raw.svg" width="16" height="16" alt="raw"> Raw markdown view
- <img src="images/icons/copy.svg" width="16" height="16" alt="copy"> Copy content (Markdown / Text / HTML)
- <img src="images/icons/restart.svg" width="16" height="16" alt="restart"> Server restart with session preservation
- Auto session backup and restore
- Drag-and-drop file addition from the OS file manager (content is loaded in-memory; live-reload is not supported for dropped files)
- Stdin pipe support (`cat file.md | po`)
- Live-reload on save (for files opened via CLI)

## Install

**homebrew tap:**

```console
$ brew install k1LoW/tap/po
```

**manually:**

Download binary from [releases page](https://github.com/mkusaka/po/releases)

## Usage

``` console
$ po README.md                          # Open a single file
$ po README.md CHANGELOG.md docs/*.md   # Open multiple files
$ po docs/                              # Open all .md files in a directory
$ po spec.md --target design            # Open in a named group
$ po --repo                             # Open all repo Markdown files
$ po --repo README.md                   # Use /repo-name?file=relative/path URLs
$ cat notes.md | po                     # Read Markdown from stdin
```

`po` opens Markdown files in a browser with live-reload. When you save a file, the browser automatically reflects the changes.

### Reading from stdin

When no positional arguments are given and stdin is redirected (not a terminal), `po` reads Markdown content from stdin.

``` console
$ cat notes.md | po
$ some-command | po --target output
$ po < notes.md
```

The content is loaded in-memory with a generated name (`stdin-<hash>.md`). Piping the same content again reuses the existing entry (deduplicated by content hash).

### Single server, multiple files

By default, `po` runs a single server on port `6275`. If a server is already running on the same port, subsequent `po` invocations add files to the existing session instead of starting a new one.

``` console
$ po README.md          # Starts a po server in the background
$ po CHANGELOG.md       # Adds the file to the running po server
```

To run a completely separate session, use a different port:

``` console
$ po draft.md -p 6276
```

![Multiple files with sidebar](images/multiple-files.png)

### Repository-scoped URLs

Use `--repo` when you want links to be scoped to the current Git repository instead of exposing file URLs as machine-local entries. `po` detects the repository root, uses the repository name as the URL path, and addresses files by path relative to that root.

With no file arguments, `po --repo` opens all Markdown files in the repository. It respects `.gitignore` by default, including tracked files and untracked files that are not ignored. Use `--no-ignore` to include ignored Markdown files too.

``` console
$ po --repo
# http://localhost:6275/po

$ po --repo README.md
# http://localhost:6275/po?file=README.md

$ po --repo docs/guide.md
# http://localhost:6275/po?file=docs/guide.md

$ po --repo --no-ignore
```

Pass a path to use a specific repository:

``` console
$ po --repo=/path/to/repo /path/to/repo/docs/guide.md
```

### Groups

Files can be organized into named groups using the `--target` (`-t`) flag. Each group gets its own URL path and sidebar.

``` console
$ po spec.md --target design      # Opens at http://localhost:6275/design
$ po api.md --target design       # Adds to the "design" group
$ po notes.md --target notes      # Opens at http://localhost:6275/notes
```

![Group view](images/groups.png)

### Watch mode and glob patterns

`--watch` (`-w`) turns on watch mode. Directory and glob positional arguments are registered as watch patterns, matching files are opened, and new matching files are picked up automatically.

``` console
$ po -w '**/*.md'                              # Watch and open all .md files recursively
$ po -w 'docs/**/*.md' --target docs           # Watch docs/ tree in "docs" group
$ po -w '*.md' 'docs/**/*.md'                  # Multiple patterns (positional)
$ po -w docs/                                  # Watch docs/*.md
```

Combine with `--recursive` (`-R`) to descend into subdirectories. Short flags can be combined:

``` console
$ po -w -R docs/                               # Watch docs/**/*.md
$ po -wR docs/                                 # Same, short-combined
```

Without `--watch`, globs are expanded once and directory arguments open matching files without live-watching new additions:

``` console
$ po docs/                                     # Open every .md directly in docs/
$ po -R docs/                                  # Open every .md under docs/ (recursive)
$ po 'docs/*.md'                               # Expand and open matching .md files
```

#### Removing watch patterns

`--unwatch` removes previously registered patterns. Pass glob patterns or directories as positional arguments to specify which patterns to remove. Regular file paths are not accepted (use `--close` to remove individual files from the sidebar). Files already added by a pattern remain in the sidebar.

``` console
$ po --unwatch '**/*.md'                              # Stop watching a pattern (default group)
$ po --unwatch docs/                                  # Stop watching docs/*.md
$ po --unwatch 'docs/**/*.md' --target docs            # Stop watching in a specific group
```

With `-R`, a directory argument removes **all** registered patterns under that directory at once. For example, if `docs/*.md`, `docs/sub/*.md`, and `docs/**/*.md` are all registered, a single command removes them all:

``` console
$ po --unwatch -R docs/                               # Removes docs/*.md, docs/sub/*.md, docs/**/*.md, etc.
```

Patterns are resolved to absolute paths before matching, so you can specify either a relative glob or the full path shown by `--status`.

### Sidebar view modes

The sidebar uses tree view by default and can be switched to flat view. Tree view displays the directory hierarchy, while flat view shows file names only and supports drag-and-drop reorder.

| <img src="images/icons/view-flat.svg" height="16"> Flat | <img src="images/icons/view-tree.svg" height="16"> Tree |
|------|------|
| ![Flat view](images/sidebar-flat.png) | ![Tree view](images/sidebar-tree.png) |

### Starting and stopping

`po` runs in the background by default — the command returns immediately, leaving the shell free for other work. This makes it easy to incorporate into scripts, tool chains, or LLM-driven workflows.

``` console
$ po README.md
po: serving at http://localhost:6275 (pid 12345)
$ # shell is available immediately
```

Use `--status` to check all running po servers, and `--shutdown` to stop one:

``` console
$ po --status              # Show all running po servers
http://localhost:6275 (pid 12345, v0.12.0)
  default: 5 file(s)
    watching: /Users/you/project/src/**/*.md, /Users/you/project/*.md
  docs: 2 file(s)
    watching: /Users/you/project/docs/**/*.md

$ po --shutdown            # Shut down the po server on the default port
$ po --shutdown -p 6276    # Shut down the po server on a specific port
$ po --restart             # Restart the po server on the default port
```

If you need the po server to run in the foreground (e.g. for debugging), use `--foreground`:

``` console
$ po --foreground README.md
```

### Server restart

Click the <img src="images/icons/restart.svg" width="16" height="16" alt="restart"> restart button (bottom-right corner) or run `po --restart` to restart the `po` server process. The current session — all open files and groups — is preserved across the restart. This is useful when you have updated the `po` binary and want to pick up the new version without re-opening your files.

### Session backup and restore

`po` automatically saves session state (open files and watch patterns per group) when files are added or removed. When starting a new server, the previous session is automatically restored and merged with any files specified on the command line. Restored session entries appear first, followed by newly specified files.

``` console
$ po README.md CHANGELOG.md       # Start with two files
$ po --shutdown                   # Shut down the server
$ po                              # Restores README.md and CHANGELOG.md
$ po TODO.md                      # Restores previous session + adds TODO.md
```

Use `--close` to remove specific files from the running server:

``` console
$ po --close README.md            # Close a file from the default group
$ po --close docs/*.md -t docs    # Close files from the "docs" group
```

Use `--clear` to remove a saved session. If a server is running, it is automatically restarted with an empty state:

``` console
$ po --clear                      # Clear saved session for the default port
$ po --clear -p 6276              # Clear saved session for a specific port
```

### JSON output

Use `--json` to get structured JSON output on stdout, useful for scripting and integration with other tools.

``` console
$ po --json README.md
{
  "url": "http://localhost:6275",
  "files": [
    {
      "url": "http://localhost:6275/?file=a1b2c3d4",
      "name": "README.md",
      "path": "/Users/you/project/README.md"
    }
  ]
}
```

`--status` also supports `--json`:

``` console
$ po --status --json
[
  {
    "url": "http://localhost:6275",
    "status": "running",
    "pid": 12345,
    "version": "0.15.0",
    "revision": "abc1234",
    "groups": [
      {
        "name": "default",
        "files": 3,
        "patterns": ["**/*.md"]
      }
    ]
  }
]
```

### Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--target` | `-t` | `default` | Group name |
| `--port` | `-p` | `6275` | Server port |
| `--bind` | `-b` | `localhost` | Bind address (e.g. `0.0.0.0`) |
| `--open` | | | Always open browser |
| `--no-open` | | | Never open browser |
| `--status` | | | Show all running po servers |
| `--watch` | `-w` | `false` | Treat directory and glob arguments as watch patterns |
| `--unwatch` | | `false` | Remove watched patterns for the given directory or glob arguments |
| `--recursive` | `-R` | `false` | Recurse into subdirectories when a directory is given |
| `--close` | | | Close files instead of opening them |
| `--shutdown` | | | Shut down the running po server |
| `--restart` | | | Restart the running po server |
| `--clear` | | | Clear saved session (restarts server if running) |
| `--foreground` | | | Run po server in foreground |
| `--json` | | | Output structured data as JSON to stdout |
| `--dangerously-allow-remote-access` | | | Allow remote access without authentication (trusted networks only) |

> [!WARNING]
> Binding to a non-localhost address exposes po to the network **without any authentication**. Remote clients can read any file accessible by the user, browse the filesystem via glob patterns, and shut down the server. A confirmation prompt is shown when `--bind` is set to a non-loopback address.

## Build

Requires Go and [pnpm](https://pnpm.io/).

``` console
$ make build
```

## References

- [yusukebe/gh-markdown-preview](https://github.com/yusukebe/gh-markdown-preview): GitHub CLI extension to preview Markdown looks like GitHub.

## License

- [MIT License](LICENSE)
    - Include logo as well as source code.
    - Only logo license can be selected [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
    - Also, if there is no alteration to the logo and it is used for technical information about po, I would not say anything if the copyright notice is omitted.
