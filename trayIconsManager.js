// This file is part of the AppIndicator/KStatusNotifierItem GNOME Shell extension
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Signals from 'resource:///org/gnome/shell/misc/signals.js';

import * as IndicatorStatusIcon from './indicatorStatusIcon.js';
import * as Util from './util.js';
import * as SettingsManager from './settingsManager.js';

// Resolves the running GNOME-tracked app (its .desktop id) that owns pid, so
// a legacy XEmbed tray icon can be matched against a modern AppIndicator
// belonging to the same actual application. Returns null for apps
// Shell.WindowTracker can't match to a mapped window (common for
// tray-icon-only apps with no main window), which is exactly why
// legacyMatches() below also falls back to name-based matching.
function resolveAppId(pid) {
    return Shell.WindowTracker.get_default().get_app_from_pid(pid)?.get_id() ?? null;
}

// matchDescriptor: {appId, matchName} describing a modern AppIndicator (see
// IndicatorStatusIcon.appId/matchName). Matches by resolved app id first
// (reliable when available), falling back to a case-insensitive comparison
// of the legacy icon's wm_class against the indicator's own reported id/title.
function legacyMatches(icon, {appId, matchName}) {
    if (appId && resolveAppId(icon.pid) === appId)
        return true;

    const legacyName = icon.wm_class?.toLowerCase();
    return !!legacyName && !!matchName && legacyName === matchName;
}

let trayIconsManager;

export class TrayIconsManager extends Signals.EventEmitter {
    static initialize() {
        if (!trayIconsManager)
            trayIconsManager = new TrayIconsManager();
        return trayIconsManager;
    }

    static destroy() {
        trayIconsManager.destroy();
    }

    // Called whenever a modern AppIndicator's identity becomes known (both
    // right at registration, when only matchName is available, and again
    // later if/when appId resolves): if a legacy tray icon for the same app
    // is already showing, remove it now that the modern one is confirmed
    // (handles legacy-registers-first).
    static removeLegacyCounterpart(matchDescriptor) {
        if (trayIconsManager)
            trayIconsManager._removeLegacyCounterpart(matchDescriptor);
    }

    constructor() {
        super();

        if (trayIconsManager)
            throw new Error('TrayIconsManager is already constructed');

        this._changedId = SettingsManager.getDefaultGSettings().connect(
            'changed::legacy-tray-enabled', () => this._toggle());

        this._toggle();
    }

    _toggle() {
        if (SettingsManager.getDefaultGSettings().get_boolean('legacy-tray-enabled'))
            this._enable();
        else
            this._disable();
    }

    _getPanelBgColor() {
        return Main.panel?.get_parent()
            ? Main.panel.get_theme_node()?.get_background_color() : null;
    }

    _enable() {
        if (this._tray)
            return;

        this._tray = new Shell.TrayManager({bgColor: this._getPanelBgColor()});
        Util.connectSmart(this._tray, 'tray-icon-added', this, this.onTrayIconAdded);
        Util.connectSmart(this._tray, 'tray-icon-removed', this, this.onTrayIconRemoved);

        this._tray.manage_screen(Main.panel);
    }

    _disable() {
        if (!this._tray)
            return;

        IndicatorStatusIcon.getTrayIcons().forEach(i => i.destroy());
        this._tray.unmanage_screen();
        this._tray = null;
    }

    onTrayIconAdded(_tray, icon) {
        // Modern-only dedup: if this legacy XEmbed icon belongs to the same
        // running app as an already-registered AppIndicator, skip it --
        // showing both would just duplicate the same app's tray icon.
        const hasModernCounterpart = IndicatorStatusIcon.getAppIndicatorIcons().some(i =>
            legacyMatches(icon, {appId: i.appId, matchName: i.matchName}));

        if (hasModernCounterpart) {
            Util.Logger.debug(
                `Skipping legacy tray icon for ${icon.wm_class}: modern indicator already present`);
            return;
        }

        const trayIcon = new IndicatorStatusIcon.IndicatorStatusTrayIcon(icon);
        IndicatorStatusIcon.addIconToPanel(trayIcon);
    }

    _removeLegacyCounterpart(matchDescriptor) {
        if (!matchDescriptor.appId && !matchDescriptor.matchName)
            return;

        IndicatorStatusIcon.getTrayIcons().forEach(trayIcon => {
            if (trayIcon.icon && legacyMatches(trayIcon.icon, matchDescriptor)) {
                Util.Logger.debug(
                    `Removing legacy tray icon for ${trayIcon.icon.wm_class}: ` +
                    'modern indicator now available');
                trayIcon.destroy();
            }
        });
    }

    onTrayIconRemoved(_tray, icon) {
        try {
            const [trayIcon] = IndicatorStatusIcon.getTrayIcons().filter(i => i.icon === icon);
            trayIcon.destroy();
        } catch (e) {
            Util.Logger.warning(`No icon container found for ${icon.title} (${icon})`);
        }
    }

    destroy() {
        this.emit('destroy');
        SettingsManager.getDefaultGSettings().disconnect(this._changedId);
        this._disable();
        trayIconsManager = null;
    }
}
