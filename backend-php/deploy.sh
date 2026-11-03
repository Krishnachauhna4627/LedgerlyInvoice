#!/usr/bin/env bash
# Deploys backend-php + the Angular frontend (built into public/) as ONE app.
#
#   ./deploy.sh               build, package, then upload via rsync (if DEPLOY_HOST is set in deploy.env)
#                             or create a zip for manual upload (cPanel File Manager / FTP)
#   ./deploy.sh --zip         always create a zip, even if DEPLOY_HOST is set
#   ./deploy.sh --skip-build  reuse the frontend build already in public/
#   ./deploy.sh -y            don't ask for confirmation before uploading
#
# Server settings live in deploy.env (copy deploy.env.example). Never uploaded: .env, writable/ contents.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE="$BACKEND_DIR/build/stage"
cd "$BACKEND_DIR"

MODE=auto SKIP_BUILD=no ASSUME_YES=no
for arg in "$@"; do
  case "$arg" in
    --zip) MODE=zip ;;
    --skip-build) SKIP_BUILD=yes ;;
    -y|--yes) ASSUME_YES=yes ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

DEPLOY_HOST="" DEPLOY_USER="" DEPLOY_PORT=22 DEPLOY_PATH="" REMOTE_PHP=php RUN_MIGRATIONS=yes
[[ -f deploy.env ]] && source deploy.env
if [[ "$MODE" == auto ]]; then
  [[ -n "$DEPLOY_HOST" ]] && MODE=rsync || MODE=zip
fi

step() { echo; echo "==> $*"; }

# 1. Warn about uncommitted work (deploy still uses the files on disk).
if [[ -n "$(git status --porcelain -- . 2>/dev/null)" ]]; then
  echo "WARNING: backend-php has uncommitted changes; they WILL be deployed."
fi

# 2. Frontend build -> public/
if [[ "$SKIP_BUILD" == yes ]]; then
  [[ -f public/index.html ]] || { echo "public/index.html missing; run without --skip-build" >&2; exit 1; }
else
  step "Building frontend"
  ./build-frontend.sh
fi

# 3. Stage a clean copy: tracked + new (non-ignored) files, the frontend build, production vendor/.
step "Staging files in build/stage"
rm -rf "$STAGE" && mkdir -p "$STAGE"
git ls-files -z --cached --others --exclude-standard -- . \
  | grep -zvE '^(tests/|phpunit\.xml\.dist$|CLAUDE\.md$|README\.md$|builds$|deploy\.sh$|deploy\.env|build-frontend\.sh$|\.gitignore$)' \
  | rsync -a --from0 --files-from=- --ignore-missing-args ./ "$STAGE/"
rsync -a --exclude '.frontend-files' public/ "$STAGE/public/"
rsync -a vendor/ "$STAGE/vendor/"

step "Installing production dependencies (no dev packages)"
(cd "$STAGE" && composer install --no-dev --optimize-autoloader --no-interaction --quiet)

# 4a. Zip mode: package for manual upload.
if [[ "$MODE" == zip ]]; then
  ZIP="$BACKEND_DIR/build/ledgerly-$(date +%Y%m%d-%H%M).zip"
  step "Creating $ZIP"
  (cd "$STAGE" && zip -qr "$ZIP" .)
  cat <<EOF

Done. Upload and extract it over the backend folder on your server:
  $ZIP
  - Keep the server's own .env (the zip doesn't contain one).
  - Point the domain's document root at the folder's public/ directory.
  - Database changes: run 'php spark migrate' (SSH/cron), or import database/schema.sql on a NEW install.
EOF
  exit 0
fi

# 4b. Rsync mode: upload straight to the server.
[[ -n "$DEPLOY_USER" && -n "$DEPLOY_PATH" ]] || { echo "Set DEPLOY_USER and DEPLOY_PATH in deploy.env" >&2; exit 1; }
REMOTE="$DEPLOY_USER@$DEPLOY_HOST"
SSH=(ssh -p "$DEPLOY_PORT" "$REMOTE")

# Safety: --delete must only ever run on a CodeIgniter folder (or an empty/new one).
step "Checking $REMOTE:$DEPLOY_PATH"
"${SSH[@]}" "p='$DEPLOY_PATH'; [ ! -e \"\$p\" ] || [ -f \"\$p/spark\" ] || [ -z \"\$(ls -A \"\$p\")\" ]" \
  || { echo "ABORT: $DEPLOY_PATH exists but is not a CodeIgniter app (no spark file)." >&2; exit 1; }
"${SSH[@]}" "[ -f '$DEPLOY_PATH/.env' ]" \
  || echo "NOTE: no .env on the server yet; create $DEPLOY_PATH/.env (see .env.example) before using the app."

if [[ "$ASSUME_YES" != yes ]]; then
  read -r -p "Upload to $REMOTE:$DEPLOY_PATH ? [y/N] " ok
  [[ "$ok" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 1; }
fi

step "Uploading"
"${SSH[@]}" "mkdir -p '$DEPLOY_PATH'"
# Code: mirror exactly (old frontend chunks are removed), but never touch .env or runtime data.
rsync -az --delete -e "ssh -p $DEPLOY_PORT" \
  --exclude '/.env' --exclude '/writable/' \
  "$STAGE/" "$REMOTE:$DEPLOY_PATH/"
# writable/: only create the skeleton (index.html, .htaccess); keep logs, sessions, uploads.
rsync -az --ignore-existing -e "ssh -p $DEPLOY_PORT" "$STAGE/writable/" "$REMOTE:$DEPLOY_PATH/writable/"
"${SSH[@]}" "chmod -R u+rwX '$DEPLOY_PATH/writable'"

if [[ "$RUN_MIGRATIONS" == yes ]]; then
  step "Running database migrations"
  "${SSH[@]}" "cd '$DEPLOY_PATH' && $REMOTE_PHP spark migrate --all"
fi

step "Deployed to $REMOTE:$DEPLOY_PATH"
