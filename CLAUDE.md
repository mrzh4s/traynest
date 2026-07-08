# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A GNOME Shell extension (`appindicatorsupport@rgcjonas.gmail.com`) that adds support for Ubuntu
AppIndicators, KDE StatusNotifierItems (KSNI), and legacy XEmbed tray icons to the GNOME Shell panel.
Supports GNOME Shell versions 45-50 (see `metadata.json`). Plain GJS/ESM JavaScript — no build
transpilation step, no npm package.

## Build, test, install

Uses meson/ninja, not npm/node:

```bash
meson setup _build
meson test -C _build -v --print-errorlogs   # runs eslint as a meson test target
ninja -C _build install                      # installs to ~/.local/share/gnome-shell/extensions/... (local_install auto-detects non-root)
ninja -C _build zip-file                     # produces the extensions.gnome.org-ready zip (local installs only)
```

After installing, reload the extension:
- X11: <kbd>Alt</kbd>+<kbd>F2</kbd>, `r`, <kbd>Enter</kbd>
- Wayland: log out and back in
- Or: `gnome-extensions disable appindicatorsupport@rgcjonas.gmail.com && gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com`

Linting (also what CI runs, `eslint@8.57.0` installed globally via npm):

```bash
eslint . -f tap --ext .js,.jsx,.ts,.tsx
```

Config chain: `.eslintrc.yml` extends `lint/eslintrc-gjs.yml` and `lint/eslintrc-shell.yml` (GJS/GNOME
Shell-specific globals and rules layered on a legacy base in `lint/eslintrc-legacy.yml`). Notable local
rules: 110-char max line length, `prefer-const`, `guard-for-in` as errors.

GSettings schema must be compiled when changed:
```bash
glib-compile-schemas schemas
```

There is no unit test suite. Manual testing tools live in `indicator-test-tool/`:
- `testTool.js` — a GJS/Gtk3 script that spins up a fake AppIndicator exercising all common menu item
  types (requires `libappindicator3` GObject introspection data). Run with `gjs indicator-test-tool/testTool.js`.
- `ksni.py` — a legacy Python2/PyQt4/PyKDE4 KStatusNotifierItem test tool (for KDE-side protocol testing).
- `tools/busAnalyzer.js` — installed alongside the extension, used for debugging D-Bus traffic to/from indicators.

CI (`.github/workflows/`) runs `eslint.yaml` (lint only) and `dist-check-and-ego-upload.yaml` (meson
dist check + zip build on every push/PR, plus upload to extensions.gnome.org on tag push).

## Architecture

Entry point is `extension.js` (`enable()`/`disable()`). On enable, it doesn't unconditionally create a
`StatusNotifierWatcher` — it first checks (via `Util.NameWatcher`) whether `org.kde.StatusNotifierWatcher`
is already owned on the session bus (e.g. by another DE or a previous instance), and only instantiates its
own watcher if not. This watchdog is deliberately kept alive across `disable()`/re-`enable()` cycles (with
a documented hack to avoid leaking it across extension *reloads* specifically — see the
`global['--appindicator-extension-on-reload']` dance in `extension.js`). There's a known unresolved race
(see FIXME in `extension.js`) around rapid enable/disable during lock-screen transitions.

Data flow, roughly: an application registers a `StatusNotifierItem` with the watcher → the watcher notifies
us → we create an `AppIndicator` wrapping a D-Bus proxy to that item → an `IndicatorStatusIcon` (a
`PanelMenu.Button`) is added to the panel to display it → clicking it opens a menu built by `dbusMenu.js`
from the app's `com.canonical.dbusmenu` D-Bus interface.

Key modules:
- **statusNotifierWatcher.js** — implements the `org.kde.StatusNotifierWatcher` D-Bus service that apps
  register indicators with.
- **appIndicator.js** (largest file) — `AppIndicatorProxy` (GObject D-Bus proxy to
  `org.kde.StatusNotifierItem`), `AppIndicator` (event-emitter around the proxy), `IconActor` (icon
  rendering, including pixmap fallback and theme icon lookup).
- **dbusMenu.js** — client for the `com.canonical.dbusmenu` protocol (`DBusClient`, `Client`,
  `DbusMenuItem`); translates remote menu structures into GNOME Shell `PopupMenu` items.
- **indicatorStatusIcon.js** — `PanelMenu.Button` subclasses (`IndicatorStatusIcon`,
  `IndicatorStatusTrayIcon`) that place icons in the top panel.
- **trayIconsManager.js** — legacy XEmbed system tray icon support (separate from AppIndicator/KSNI).
- **iconCache.js** — icon caching with GC every 100s, 120s icon lifetime.
- **pixmapsUtils.js** — raw ARGB→RGBA pixmap conversion for indicators that supply raw icon data instead
  of theme icon names.
- **dbusProxy.js**, **dbusUtils.js**, **interfaces.js**, **interfaces-xml/*.xml** — D-Bus proxy base class,
  bus introspection helpers, and the interface XML for `StatusNotifierItem`, `StatusNotifierWatcher`,
  `DBusMenu`.
- **promiseUtils.js** — cancellable Promise variants (`CancellablePromise`, `GSourcePromise`,
  `TimeoutPromise`, `IdlePromise`, `MetaLaterPromise`) built for GLib main-loop-friendly async/cancellation
  patterns; prefer these over raw `Promise`/`setTimeout` when adding async code that needs to be
  cancellable on extension disable.
- **util.js** — `NameWatcher` (D-Bus name ownership watching), `connectSmart`/`disconnectSmart` signal
  helpers, `CancellableChild` (a `Gio.Cancellable` that also gets cancelled when its parent is), settings-
  version checks.
- **settingsManager.js** / **schemas/org.gnome.shell.extensions.appindicator.gschema.xml** — GSettings
  wrapper and schema.
- **prefs.js** + **preferences/generalPage.js**, **preferences/customIconPage.js** — the extension's
  preferences window (general settings, per-indicator icon overrides).
- **locale/** — gettext translations (~20 languages); `POTFILES.in` lists translatable source files.

## Conventions worth knowing

- ES modules throughout (`import`/`export`), targeting GJS's ESM support — not CommonJS, no bundler.
- GObject classes are defined via `GObject.registerClass(...)`, following standard GJS/GNOME Shell
  extension conventions (see any `class ... extends St.Icon`/`PanelMenu.Button` for the pattern).
- Event emitters use the Shell's `Signals.EventEmitter` mixin (not Node's `EventEmitter`).
- Async D-Bus/GIO work should be cancellable — thread a `Gio.Cancellable` (or `CancellableChild`) through
  and prefer `promiseUtils.js` wrappers, since indicators/menus can disappear mid-request and everything
  must clean up on `disable()`.
