---
name: electron-desktop
description: Implement, secure, package, and test the PH-Ponto Electron application, preload bridge, OS-backed token storage, CSP, navigation controls, and Windows installer. Use for Electron main/preload work, IPC, desktop lifecycle, packaging, or Windows builds.
---

# PH-Ponto Electron Desktop

1. Read `/AGENTS.md`, `/PROJECT_PROGRESS.md`, and `/docs/architecture.md`.
2. Maintain separate `main`, `preload`, and `renderer` boundaries with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
3. Expose narrow, typed, purpose-specific preload methods. Validate IPC senders and payloads in main; never expose raw `ipcRenderer`, filesystem, shell, or process APIs.
4. Store refresh credentials through OS-backed encryption when available. Keep access credentials in memory and never use renderer `localStorage` for secrets.
5. Serve the packaged renderer from the privileged exact origin `ph-ponto://app` and development only from its configured Vite origin; never allow `Origin: null`.
6. Apply a restrictive CSP, deny unexpected navigation and window creation, allowlist external `https` links, and never load arbitrary remote application content.
7. Keep development URLs separate from packaged local assets. Fail safely when the API is unavailable.
8. Configure product name `PH-Ponto`, Windows x64 NSIS, per-user installation, shortcuts, uninstall support, and artifact `PH-Ponto-Setup-${version}.exe`.
9. Test preload contracts, security preferences, navigation denial, packaged builds, and the Windows workflow before release.

Do not invent an application icon from the missing logo; package final branded artifacts only after the approved asset exists.
