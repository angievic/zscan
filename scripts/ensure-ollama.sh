#!/usr/bin/env bash
# Garantiza Ollama en :11434: instala si falta (macOS/Linux), luego arranca serve si hace falta.
# Uso: bash scripts/ensure-ollama.sh [--no-install]
#      npm run ollama:ensure
#
# --no-install / ZSCAN_OLLAMA_NO_INSTALL=1 → no descarga ni brew; falla si no hay `ollama`.
set -euo pipefail

TAGS_URL="http://127.0.0.1:11434/api/tags"
LOG="${TMPDIR:-/tmp}/zscan-ollama-serve.log"
NO_INSTALL=false

for arg in "$@"; do
  case "$arg" in
    --no-install) NO_INSTALL=true ;;
  esac
done

if [[ "${ZSCAN_OLLAMA_NO_INSTALL:-}" == "1" ]]; then
  NO_INSTALL=true
fi

tags_up() {
  curl -sf --max-time "${1:-1}" "$TAGS_URL" >/dev/null 2>&1
}

install_ollama() {
  local os
  os="$(uname -s)"
  case "$os" in
    Darwin)
      if ! command -v brew >/dev/null 2>&1; then
        echo "error: no hay \`ollama\` ni Homebrew en PATH." >&2
        echo "  Instala Ollama: https://ollama.com/download/mac" >&2
        exit 1
      fi
      echo "Instalando Ollama con Homebrew (puede tardar varios minutos)…"
      brew install ollama
      ;;
    Linux)
      if ! command -v curl >/dev/null 2>&1; then
        echo "error: en Linux hace falta \`curl\` para instalar Ollama." >&2
        exit 1
      fi
      echo "Instalando Ollama con el script oficial (puede pedir contraseña sudo)…"
      curl -fsSL https://ollama.com/install.sh | sh
      ;;
    *)
      echo "error: instala Ollama manualmente: https://ollama.com/download (sistema: $os)" >&2
      exit 1
      ;;
  esac
}

ensure_ollama_cli() {
  if command -v ollama >/dev/null 2>&1; then
    return 0
  fi
  if [[ "$NO_INSTALL" == "true" ]]; then
    echo "error: \`ollama\` no está en PATH. Quita --no-install o instala desde https://ollama.com" >&2
    exit 1
  fi
  install_ollama
  hash -r 2>/dev/null || true
  if ! command -v ollama >/dev/null 2>&1; then
    echo "error: tras instalar, \`ollama\` sigue sin estar en PATH. Abre una terminal nueva o revisa la instalación." >&2
    exit 1
  fi
  echo "Ollama instalado: $(command -v ollama)"
}

if tags_up 1; then
  echo "Ollama ya escucha en http://127.0.0.1:11434"
  exit 0
fi

ensure_ollama_cli

if tags_up 2; then
  echo "Ollama ya responde en http://127.0.0.1:11434 (servicio iniciado por la instalación o en segundo plano)."
  exit 0
fi

echo "Iniciando ollama serve en segundo plano…"
echo "  log: $LOG"
nohup ollama serve >>"$LOG" 2>&1 &
OLLAMA_PID=$!
echo "  pid: $OLLAMA_PID"

for _ in $(seq 1 60); do
  if tags_up 1; then
    echo "Ollama listo."
    exit 0
  fi
  sleep 0.5
done

echo "error: timeout esperando Ollama en :11434 (revisa $LOG)" >&2
kill "$OLLAMA_PID" 2>/dev/null || true
exit 1
