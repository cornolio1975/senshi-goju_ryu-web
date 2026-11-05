#!/bin/sh
set -e
BASE="/home/u286655953/domains/spsportdatasolution.org"
TARGET="$BASE/public_html/clubs/senshi_goju-ryu"
DATA="$BASE/.senshi-goju-ryu"
BK="$DATA/backup_20261105"
TMP="$DATA/tmp_deploy"

mkdir -p "$BK"
if [ ! -f "$BK/content.sqlite.bak" ] && [ -f "$DATA/content.sqlite" ]; then
  cp -a "$DATA/content.sqlite" "$BK/content.sqlite.bak"
fi
if [ ! -d "$BK/web_files" ] && [ -d "$TARGET" ]; then
  cp -a "$TARGET" "$BK/web_files"
fi

rm -rf "$TMP"
git clone --depth 1 --branch deploy/hostinger-dist https://github.com/cornolio1975/senshi-goju_ryu-web.git "$TMP"

for f in index.html admin.html app.js styles.css api.php .htaccess club_logo.png; do
  if [ -f "$TMP/$f" ]; then
    cp -f "$TMP/$f" "$TARGET/$f"
    chmod 0644 "$TARGET/$f"
  fi
done

rm -rf "$TMP"
echo "Deployed Senshi Goju-Ryu v9 successfully at $(date -u)" > "$DATA/last_deploy.log"

