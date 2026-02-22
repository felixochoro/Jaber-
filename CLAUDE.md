# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

This is the **Jaber-** project repository. Update this section with a description of your project once it is initialized.

## Repository Structure

```
.
├── CLAUDE.md                  # Claude Code guidance (this file)
└── .claude/
    ├── settings.json          # Claude Code settings and hooks
    └── hooks/
        └── session-start.sh   # Startup hook for remote sessions
```

## Development Setup

### Prerequisites

List your project's prerequisites here. For example:
- Node.js >= 18
- Python >= 3.10
- Go >= 1.21

### Installation

```bash
# Add your dependency installation commands here
# e.g., npm install, pip install -r requirements.txt, etc.
```

## Common Commands

### Build

```bash
# Add your build command here
# e.g., npm run build
```

### Test

```bash
# Add your test command here
# e.g., npm test, pytest, go test ./...
```

### Lint

```bash
# Add your lint command here
# e.g., npm run lint, flake8 ., golangci-lint run
```

### Format

```bash
# Add your format command here
# e.g., prettier --write ., black ., gofmt -w .
```

## Environment Variables

Document any required environment variables here:

| Variable | Description | Required |
|----------|-------------|----------|
| `EXAMPLE_VAR` | Description of variable | Yes/No |

## Code Style Guidelines

- Follow the existing patterns and conventions in the codebase.
- Write clear, descriptive commit messages.
- Keep functions small and focused on a single responsibility.
- Add tests for new functionality.

## Branching Strategy

- `main` / `master` — production-ready code
- `feature/*` — new features
- `fix/*` — bug fixes
- `claude/*` — Claude Code automated branches

## Notes for Claude

- Always read files before modifying them.
- Run tests before and after making changes to verify correctness.
- Prefer editing existing files over creating new ones.
- Do not commit secrets, API keys, or sensitive data.
- Follow the project's existing code style and conventions.
