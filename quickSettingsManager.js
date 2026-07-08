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

// EXPERIMENTAL: Main.panel.statusArea.quickSettings.addExternalIndicator() is
// not part of the documented extension API and its availability/signature
// could not be verified against a live GNOME Shell in this environment (no
// js/ui/quickSettings.js source was accessible here). Everything in this
// module is feature-detected and purely additive -- it mirrors a small,
// independent icon into the Quick Settings menu alongside (never instead of)
// an indicator's normal panel placement, and silently no-ops (after a single
// warning) if the API isn't there. Verify this live before relying on it.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as AppIndicator from './appIndicator.js';
import * as IndicatorStatusIcon from './indicatorStatusIcon.js';
import * as SettingsManager from './settingsManager.js';
import * as Util from './util.js';

let warnedUnsupported = false;

function getQuickSettingsMenu() {
    return Main.panel.statusArea.quickSettings ?? null;
}

function isSupported() {
    const quickSettings = getQuickSettingsMenu();
    return !!quickSettings && typeof quickSettings.addExternalIndicator === 'function';
}

let quickSettingsManager;

export class QuickSettingsManager {
    static initialize() {
        if (!quickSettingsManager)
            quickSettingsManager = new QuickSettingsManager();
        return quickSettingsManager;
    }

    static destroy() {
        if (quickSettingsManager) {
            quickSettingsManager.destroy();
            quickSettingsManager = null;
        }
    }

    static getDefault() {
        return quickSettingsManager;
    }

    constructor() {
        this._mirrors = new Map();
    }

    get enabled() {
        return SettingsManager.getDefaultGSettings().get_boolean('quick-settings-enabled');
    }

    mirrorIndicator(indicator) {
        if (!this.enabled || this._mirrors.has(indicator.uniqueId))
            return;

        if (!isSupported()) {
            if (!warnedUnsupported) {
                warnedUnsupported = true;
                Util.Logger.warn(
                    'Quick Settings mirroring is not supported on this Shell version; skipping');
            }
            return;
        }

        const iconActor = new AppIndicator.IconActor(indicator,
            IndicatorStatusIcon.DEFAULT_ICON_SIZE);
        iconActor.add_style_class_name('quick-settings-system-indicator');

        Util.connectSmart(indicator, 'destroy', this,
            () => this.unmirrorIndicator(indicator.uniqueId));

        getQuickSettingsMenu().addExternalIndicator(iconActor);
        this._mirrors.set(indicator.uniqueId, iconActor);
    }

    unmirrorIndicator(uniqueId) {
        const iconActor = this._mirrors.get(uniqueId);
        if (!iconActor)
            return;

        iconActor.destroy();
        this._mirrors.delete(uniqueId);
    }

    destroy() {
        this._mirrors.forEach(iconActor => iconActor.destroy());
        this._mirrors.clear();
    }
}
