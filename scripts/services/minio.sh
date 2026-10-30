#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

BIN_DIR="${LOCAL_DIR}/bin"
DATA_DIR="${MINIO_DATA_DIR:-$LOCAL_DIR/minio}"
MINIO_BIN="${MINIO_BIN:-$BIN_DIR/minio}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-${S3_ACCESS_KEY:-minioadmin}}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-${S3_SECRET_KEY:-minioadmin}}"
MINIO_ADDRESS="${MINIO_ADDRESS:-127.0.0.1:${MINIO_PORT:-9000}}"
MINIO_CONSOLE_ADDRESS="${MINIO_CONSOLE_ADDRESS:-127.0.0.1:${MINIO_CONSOLE_PORT:-9001}}"
MINIO_RELEASE="${MINIO_RELEASE:-RELEASE.2025-09-07T16-13-09Z}"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    return 1
  fi
}

mkdir -p "$BIN_DIR" "$DATA_DIR"

if [ ! -x "$MINIO_BIN" ]; then
  require_command curl "Install curl to download the MinIO binary, or set MINIO_BIN to an existing binary."

  case "$(uname -s)" in
    Linux) OS="linux" ;;
    Darwin) OS="darwin" ;;
    *)
      echo "Unsupported operating system for automatic MinIO download." >&2
      exit 1
      ;;
  esac

  case "$(uname -m)" in
    x86_64 | amd64) ARCH="amd64" ;;
    aarch64 | arm64) ARCH="arm64" ;;
    *)
      echo "Unsupported CPU architecture for automatic MinIO download." >&2
      exit 1
      ;;
  esac

  ASSET="minio.${OS}-${ARCH}.${MINIO_RELEASE}"
  RELEASE_URL="https://github.com/minio/minio/releases/download/${MINIO_RELEASE}"
  URL="${MINIO_BINARY_URL:-$RELEASE_URL/$ASSET}"
  CHECKSUM_URL="${MINIO_CHECKSUM_URL:-$RELEASE_URL/$ASSET.sha256sum}"
  TMP_BIN="$(mktemp "${BIN_DIR}/minio.XXXXXX")"
  trap 'rm -f "$TMP_BIN" "${TMP_BIN}.sha256sum"' EXIT

  echo "Downloading MinIO ${MINIO_RELEASE} from ${URL}" >&2
  curl -fsSL "$URL" -o "$TMP_BIN"

  if curl -fsSL "$CHECKSUM_URL" -o "${TMP_BIN}.sha256sum" 2>/dev/null; then
    expected="$(awk '{print $1}' "${TMP_BIN}.sha256sum" | head -n 1)"
    actual="$(sha256_file "$TMP_BIN" || true)"
    if [ -z "$actual" ] || [ "$expected" != "$actual" ]; then
      echo "MinIO checksum verification failed." >&2
      rm -f "$TMP_BIN" "${TMP_BIN}.sha256sum"
      exit 1
    fi
    rm -f "${TMP_BIN}.sha256sum"
  else
    echo "Warning: could not download the MinIO checksum; continuing without verification." >&2
  fi

  chmod +x "$TMP_BIN"
  mv "$TMP_BIN" "$MINIO_BIN"
fi

export MINIO_ROOT_USER
export MINIO_ROOT_PASSWORD

exec "$MINIO_BIN" server "$DATA_DIR" \
  --address "$MINIO_ADDRESS" \
  --console-address "$MINIO_CONSOLE_ADDRESS"
