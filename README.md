# Tray Nest

Tray Nest adds AppIndicator, KStatusNotifierItem (KDE's systray successor) and
legacy X11 tray icon support to the GNOME Shell panel — a friendly fork of
[gnome-shell-extension-appindicator](https://github.com/ubuntu/gnome-shell-extension-appindicator)
with a set of quality-of-life features layered on top.

## Features

Inherited from upstream:
* Show indicator icons in the panel, reveal their menus on click.
* Double-click activates the application window, if the indicator supports it.
* Legacy X11 tray icon support.
* Middle-click sends a `SecondaryActivate` event (needs app-side support).

Added by Tray Nest:
* **Icon grouping** — collapse indicators beyond a configurable threshold into
  a single overflow button with an expandable submenu, instead of the panel
  filling up with icons.
* **Per-indicator visibility, ordering and click behavior** — hide specific
  indicators, reorder them, or force an indicator to always open its menu on
  left-click (for apps with broken/absent activation support).
* **Per-indicator appearance** — override color tint, opacity, size,
  saturation, brightness or contrast for individual indicators, on top of
  global defaults. Includes an auto-recolor mode that tints indicators for
  contrast against the current panel background.
* **Custom icons** — replace any indicator's icon by theme name, by picking an
  image file, or from a small bundled icon gallery.
* **Modern/legacy dedup** — if an application registers both a legacy tray
  icon and a modern AppIndicator/KStatusNotifierItem for itself, only the
  modern one is shown.
* **Quick Settings mirroring** *(experimental)* — optionally mirror a small
  copy of each indicator's icon into the Quick Settings menu. Not part of the
  documented extension API; it no-ops safely if unsupported on your Shell
  version.

## Installation

This fork isn't published on extensions.gnome.org — install it from source:

```bash
git clone <this-repository-url>
cd tray-nest
meson setup _build
ninja -C _build install
gnome-extensions enable traynest@local
```

Under X11, restart GNOME Shell afterwards (<kbd>Alt</kbd>+<kbd>F2</kbd>,
<kbd>r</kbd>, <kbd>⏎</kbd>). Under Wayland, log out and back in — this is also
required after pulling any update to the extension's runtime code, since
GNOME Shell caches JS modules for the lifetime of the session.

### Applications dependencies

Many applications support indicators via
[libappindicator](https://launchpad.net/libappindicator) (often dynamically
loaded, as in Electron apps), so without that library installed no icon will
be shown for them.

## Preferences

Three tabs:
* **General** — global behavior (legacy tray, compact mode, grouping,
  Quick Settings mirroring, tray position) and default appearance sliders.
* **Indicators** — per-indicator hide/force-menu/reorder table.
* **Appearance** — per-indicator color/opacity/size/saturation/brightness/
  contrast overrides and custom icon picker, one expandable row per indicator.

## Known limitations

* Grouping/regrouping decisions are made once, when an indicator first
  registers — toggling the grouping setting or threshold doesn't retroactively
  move already-placed icons until they re-register.
* Quick Settings mirroring relies on Shell internals that aren't part of the
  documented extension API and may not work on every Shell version.
* Indicators that register with an ephemeral D-Bus connection name (rather
  than a well-known service name) get a new identity every time the app
  restarts, so per-indicator settings for them won't carry over across
  restarts.

## Credits

Tray Nest is based on
[gnome-shell-extension-appindicator](https://github.com/ubuntu/gnome-shell-extension-appindicator),
itself based on
[patches made by Giovanni Campagna](https://bugzilla.gnome.org/show_bug.cgi?id=652122).
See [AUTHORS.md](AUTHORS.md) for the original project's contributors.

## License

GPL-2.0-or-later — see [LICENSE](LICENSE).
