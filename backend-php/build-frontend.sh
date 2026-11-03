#!/usr/bin/env bash
# Builds the Angular frontend and copies it into backend-php/public/
# so one PHP server hosts both the app and the /api.
#   Usage: ./build-frontend.sh            (build + copy)
#          ./build-frontend.sh --no-build (copy the existing dist only)
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$BACKEND_DIR/../frontend"
DIST_DIR="$FRONTEND_DIR/dist/ledgerly-frontend/browser"
PUBLIC_DIR="$BACKEND_DIR/public"
MANIFEST="$PUBLIC_DIR/.frontend-files"

# Backend files in public/ that must never be deleted.
KEEP=(index.php .htaccess robots.txt .frontend-files)

if [[ "${1:-}" != "--no-build" ]]; then
  echo "==> Building frontend"
  (cd "$FRONTEND_DIR" && npm run build)
fi

[[ -f "$DIST_DIR/index.html" ]] || { echo "Build output not found: $DIST_DIR" >&2; exit 1; }

# Remove the previous build (only the files it copied last time).
if [[ -f "$MANIFEST" ]]; then
  echo "==> Removing previous frontend build"
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    for k in "${KEEP[@]}"; do [[ "$f" == "$k" ]] && continue 2; done
    rm -rf -- "$PUBLIC_DIR/$f"
  done < "$MANIFEST"
fi

echo "==> Copying build into public/"
cp -r "$DIST_DIR"/. "$PUBLIC_DIR"/
(cd "$DIST_DIR" && ls -A) > "$MANIFEST"

echo "==> Done. Test with: php spark serve  ->  http://localhost:8080"
