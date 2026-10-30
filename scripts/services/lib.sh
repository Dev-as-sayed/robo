#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCAL_DIR="${ROOT}/.local"
RUN_DIR="${LOCAL_DIR}/run"
LOG_DIR="${LOCAL_DIR}/logs"

mkdir -p "$RUN_DIR" "$LOG_DIR"

load_env_defaults() {
  local file="$1"
  [ -f "$file" ] || return 0

  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    line="${line#export }"

    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      if [ -z "${!key+x}" ]; then
        if [[ "$value" == \"*\" && "$value" == *\" ]]; then
          value="${value:1:${#value}-2}"
        elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
          value="${value:1:${#value}-2}"
        fi
        export "$key=$value"
      fi
    fi
  done < "$file"
}

load_env_defaults "${ROBO_ENV_FILE:-$ROOT/apps/server/.env}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    echo "$2" >&2
    exit 1
  fi
}

requirements_hash() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

ensure_venv() {
  local venv="$1"
  local requirements="$2"

  if [ ! -x "$venv/bin/python" ]; then
    if command -v uv >/dev/null 2>&1; then
      uv venv --python "${PYTHON_VERSION:-3.11}" "$venv"
    else
      "${PYTHON_BIN:-python3}" -c 'import sys; raise SystemExit(0 if (3, 10) <= sys.version_info[:2] < (3, 13) else 1)' || {
        echo "Install uv or Python 3.11/3.12, then retry." >&2
        exit 1
      }
      "${PYTHON_BIN:-python3}" -m venv "$venv"
    fi
  fi

  local hash
  hash="$(requirements_hash "$requirements")"
  local marker="$venv/.requirements.sha256"

  if [ ! -f "$marker" ] || [ "$(cat "$marker")" != "$hash" ]; then
    if command -v uv >/dev/null 2>&1; then
      uv pip install --python "$venv/bin/python" -r "$requirements"
    else
      "$venv/bin/python" -m pip install --upgrade pip
      "$venv/bin/python" -m pip install -r "$requirements"
    fi
    printf '%s\n' "$hash" > "$marker"
  fi
}
