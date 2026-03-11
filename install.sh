#!/usr/bin/env sh

set -eu

REPO_OWNER="juancarestre"
REPO_NAME="rfaf"
REPO_SLUG="${REPO_OWNER}/${REPO_NAME}"
GITHUB_RELEASES_URL="https://github.com/${REPO_SLUG}/releases"
GITHUB_API_URL="https://api.github.com/repos/${REPO_SLUG}"

log() {
  printf "%s\n" "$1"
}

fail() {
  printf "[rfaf installer] %s\n" "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

resolve_tag() {
  if [ "${1:-}" != "" ]; then
    printf "%s\n" "$1"
    return
  fi

  if [ "${RFAF_TAG:-}" != "" ]; then
    printf "%s\n" "$RFAF_TAG"
    return
  fi

  latest_json=$(curl -fsSL "${GITHUB_API_URL}/releases/latest")
  latest_tag=$(printf "%s\n" "$latest_json" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)

  if [ "$latest_tag" = "" ]; then
    fail "Unable to resolve latest release tag"
  fi

  printf "%s\n" "$latest_tag"
}

resolve_target() {
  os_name=$(uname -s)
  arch_name=$(uname -m)

  case "$os_name" in
    Darwin)
      case "$arch_name" in
        arm64|aarch64)
          printf "bun-darwin-arm64\n"
          ;;
        x86_64)
          printf "bun-darwin-x64\n"
          ;;
        *)
          fail "Unsupported macOS architecture: ${arch_name}"
          ;;
      esac
      ;;
    Linux)
      case "$arch_name" in
        arm64|aarch64)
          printf "bun-linux-arm64\n"
          ;;
        x86_64)
          printf "bun-linux-x64-baseline\n"
          ;;
        *)
          fail "Unsupported Linux architecture: ${arch_name}"
          ;;
      esac
      ;;
    *)
      fail "Unsupported operating system: ${os_name}"
      ;;
  esac
}

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
    return
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return
  fi

  fail "Missing shasum/sha256sum for checksum verification"
}

resolve_install_dir() {
  if [ "${RFAF_INSTALL_DIR:-}" != "" ]; then
    mkdir -p "$RFAF_INSTALL_DIR"
    printf "%s\n" "$RFAF_INSTALL_DIR"
    return
  fi

  default_dir="/usr/local/bin"
  if mkdir -p "$default_dir" 2>/dev/null && [ -w "$default_dir" ]; then
    printf "%s\n" "$default_dir"
    return
  fi

  fallback_dir="${HOME}/.local/bin"
  mkdir -p "$fallback_dir"
  printf "%s\n" "$fallback_dir"
}

need_cmd curl
need_cmd tar
need_cmd sed
need_cmd awk
need_cmd uname
need_cmd mktemp

TAG=$(resolve_tag "${1:-}")
TARGET=$(resolve_target)
ARTIFACT_BASENAME="rfaf-${TAG}-${TARGET}"
ARCHIVE_NAME="${ARTIFACT_BASENAME}.tar.gz"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

ARCHIVE_PATH="${TMP_DIR}/${ARCHIVE_NAME}"
SUMS_PATH="${TMP_DIR}/SHA256SUMS"
EXTRACT_DIR="${TMP_DIR}/extract"

mkdir -p "$EXTRACT_DIR"

log "[rfaf installer] downloading ${ARCHIVE_NAME}"
curl -fsSL -o "$ARCHIVE_PATH" "${GITHUB_RELEASES_URL}/download/${TAG}/${ARCHIVE_NAME}"

log "[rfaf installer] downloading SHA256SUMS"
curl -fsSL -o "$SUMS_PATH" "${GITHUB_RELEASES_URL}/download/${TAG}/SHA256SUMS"

tar -xzf "$ARCHIVE_PATH" -C "$EXTRACT_DIR"

EXTRACTED_BIN="${EXTRACT_DIR}/rfaf"
if [ ! -f "$EXTRACTED_BIN" ]; then
  fail "Extracted archive does not contain expected rfaf binary"
fi

EXPECTED_SHA=$(awk -v file="$ARTIFACT_BASENAME" '$2 == file { print $1; exit }' "$SUMS_PATH")
if [ "$EXPECTED_SHA" = "" ]; then
  fail "Unable to find checksum entry for ${ARTIFACT_BASENAME} in SHA256SUMS"
fi

ACTUAL_SHA=$(sha256_file "$EXTRACTED_BIN")
if [ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]; then
  fail "Checksum mismatch for ${ARTIFACT_BASENAME}"
fi

INSTALL_DIR=$(resolve_install_dir)
INSTALL_PATH="${INSTALL_DIR}/rfaf"

cp "$EXTRACTED_BIN" "$INSTALL_PATH"
chmod +x "$INSTALL_PATH"

if [ "$(uname -s)" = "Darwin" ] && command -v xattr >/dev/null 2>&1; then
  xattr -d com.apple.quarantine "$INSTALL_PATH" >/dev/null 2>&1 || true
fi

log "[rfaf installer] installed ${TAG} to ${INSTALL_PATH}"

if [ "$INSTALL_DIR" = "${HOME}/.local/bin" ]; then
  log "[rfaf installer] add to PATH: export PATH=\"${HOME}/.local/bin:\$PATH\""
fi

log "[rfaf installer] run: rfaf --help"
