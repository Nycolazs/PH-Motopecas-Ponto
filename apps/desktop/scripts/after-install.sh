#!/bin/bash
set -e

if [ -f /opt/PH-Ponto/chrome-sandbox ]; then
  chmod 4755 /opt/PH-Ponto/chrome-sandbox || true
fi

if [ -f /opt/PH-Ponto/ph-ponto ]; then
  chmod +x /opt/PH-Ponto/ph-ponto || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi
