#!/usr/bin/env bash
# Publica únicamente la referencia de versión usando un worktree limpio.
# Evita "cannot pull with rebase: You have unstaged changes" después de
# reconstruir el acervo, y no rebaja una versión más reciente.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
VERSION="$(node -p "require('./backend/acervo-datos/manifiesto.json').version")"
if [[ ! "$VERSION" =~ ^[A-Za-z0-9_-]{6,70}$ ]]; then
  echo "::error::Versión de acervo no válida"
  exit 1
fi

for intento in 1 2 3; do
  git -C "$ROOT" fetch --no-tags origin main acervo
  PUBLICADA="$(git -C "$ROOT" show origin/acervo:manifiesto.json | node -e "let s='';process.stdin.on('data',x=>s+=x).on('end',()=>console.log(JSON.parse(s).version))")"
  if [ "$PUBLICADA" != "$VERSION" ]; then
    echo "::error::El acervo fue reemplazado por una publicación más reciente ($PUBLICADA); no se modifica main con una versión obsoleta ($VERSION)"
    exit 1
  fi
  TMP="$(mktemp -d)"
  git -C "$ROOT" worktree add --detach "$TMP" origin/main
  git -C "$TMP" config user.name 'github-actions[bot]'
  git -C "$TMP" config user.email '41898282+github-actions[bot]@users.noreply.github.com'
  printf '%s\n' "$VERSION" > "$TMP/backend/acervo-version.txt"
  git -C "$TMP" add backend/acervo-version.txt
  if git -C "$TMP" diff --cached --quiet; then
    echo "La versión $VERSION ya está registrada en main"
    git -C "$ROOT" worktree remove --force "$TMP"
    exit 0
  fi
  git -C "$TMP" commit -m "Publicar versión verificable del acervo $VERSION"
  if git -C "$TMP" push origin HEAD:main; then
    echo "Versión publicada en main: $VERSION"
    git -C "$ROOT" worktree remove --force "$TMP"
    exit 0
  fi
  git -C "$ROOT" worktree remove --force "$TMP"
  echo "::warning::main avanzó durante la publicación. Reintento $intento/3"
  sleep 2
done
echo "::error::No se pudo actualizar main sin alterar datos locales"
exit 1
