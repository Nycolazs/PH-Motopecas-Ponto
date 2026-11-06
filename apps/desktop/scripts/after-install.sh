#!/bin/bash
set -e

# electron-builder fills in the install directory and executable for each brand.
APP_DIR='/opt/${sanitizedProductName}'

if [ -f "$APP_DIR/chrome-sandbox" ]; then
  chmod 4755 "$APP_DIR/chrome-sandbox" || true
fi

if [ -f "$APP_DIR/${executable}" ]; then
  chmod +x "$APP_DIR/${executable}" || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi
