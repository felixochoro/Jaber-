#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "Setting up environment..."

# Install dependencies based on what is present in the project
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Node.js / npm
if [ -f "$PROJECT_DIR/package.json" ]; then
  echo "Installing Node.js dependencies..."
  npm install --prefix "$PROJECT_DIR"
fi

# Python / pip
if [ -f "$PROJECT_DIR/requirements.txt" ]; then
  echo "Installing Python dependencies (requirements.txt)..."
  pip install -r "$PROJECT_DIR/requirements.txt" --quiet
fi

if [ -f "$PROJECT_DIR/pyproject.toml" ]; then
  echo "Installing Python dependencies (pyproject.toml)..."
  pip install -e "$PROJECT_DIR" --quiet 2>/dev/null || pip install "$PROJECT_DIR" --quiet
fi

# Poetry
if [ -f "$PROJECT_DIR/poetry.lock" ]; then
  echo "Installing Poetry dependencies..."
  poetry install --no-interaction 2>/dev/null || true
fi

# Go
if [ -f "$PROJECT_DIR/go.mod" ]; then
  echo "Installing Go dependencies..."
  go mod download
fi

# Rust / Cargo
if [ -f "$PROJECT_DIR/Cargo.toml" ]; then
  echo "Building Cargo dependencies..."
  cargo fetch
fi

# Ruby / Bundler
if [ -f "$PROJECT_DIR/Gemfile" ]; then
  echo "Installing Ruby dependencies..."
  bundle install --quiet
fi

echo "Environment setup complete."
