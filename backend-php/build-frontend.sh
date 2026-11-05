#!/usr/bin/env bash
# Builds the Angular frontend into backend-php/public/angular/
# so one PHP server hosts both the app and the /api.
# Everything the frontend needs (index.html, js, css, fonts, images, favicons) lives in
# public/angular/, so a frontend-only release just means replacing that one folder.
#   Usage: ./build-frontend.sh            (build + copy)
#          ./build-frontend.sh --no-build (copy the existing dist only)
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$BACKEND_DIR/../frontend"
DIST_DIR="$FRONTEND_DIR/dist/ledgerly-frontend/browser"
PUBLIC_DIR="$BACKEND_DIR/public"
TARGET_DIR="$PUBLIC_DIR/angular"
OLD_MANIFEST="$PUBLIC_DIR/.frontend-files"

# Backend files in public/ that must never be deleted.
KEEP=(index.php .htaccess robots.txt favicon.ico angular .frontend-files)

if [[ "${1:-}" != "--no-build" ]]; then
  echo "==> Building frontend"
  # 'php' adds deployUrl "angular/", so index.html loads its js/css from /angular/.
  (cd "$FRONTEND_DIR" && npx ng build --configuration production,php)
fi

[[ -f "$DIST_DIR/index.html" ]] || { echo "Build output not found: $DIST_DIR" >&2; exit 1; }
grep -q 'src="angular/main-' "$DIST_DIR/index.html" || {
  echo "Build in $DIST_DIR wasn't made with --configuration production,php; run without --no-build" >&2; exit 1; }

# Old layout: the build was copied straight into public/. Remove those files once.
if [[ -f "$OLD_MANIFEST" ]]; then
  echo "==> Removing old frontend files from public/"
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    for k in "${KEEP[@]}"; do [[ "$f" == "$k" ]] && continue 2; done
    rm -rf -- "$PUBLIC_DIR/$f"
  done < "$OLD_MANIFEST"
  rm -f -- "$OLD_MANIFEST"
fi

echo "==> Copying build into public/angular/"
rm -rf -- "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
# The build puts assets (fonts, images, favicons) in its own angular/ subfolder; merge them in.
(cd "$DIST_DIR" && find . -mindepth 1 -maxdepth 1 ! -name angular -exec cp -r {} "$TARGET_DIR"/ \;)
[[ -d "$DIST_DIR/angular" ]] && cp -r "$DIST_DIR/angular"/. "$TARGET_DIR"/

echo "==> Done. Test with: php spark serve  ->  http://localhost:8080"
