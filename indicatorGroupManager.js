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

import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as AppIndicator from './appIndicator.js';
import * as DBusMenu from './dbusMenu.js';
import * as IndicatorStatusIcon from './indicatorStatusIcon.js';
import * as SettingsManager from './settingsManager.js';
import * as Util from './util.js';

const GROUP_STATUS_AREA_ID = 'appindicator-group-overflow';

// One row per grouped indicator: a live icon (an independent IconActor
// instance bound to the same AppIndicator, since multiple icon actors can
// safely observe one indicator) plus its own DBusMenu.Client attached to the
// PopupSubMenuMenuItem's own inline submenu. Unlike a real IndicatorStatusIcon
// this row is never a separate floating popup, so there's no BoxPointer
// positioning to get right: the submenu just expands inline inside the
// group button's own (correctly anchored) menu.
export const IndicatorGroupIcon = GObject.registerClass(
class AppIndicatorGroupIcon extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Other Indicators');

        this._rows = new Map();

        this.add_style_class_name('appindicator-icon');
        this.add_style_class_name('appindicator-group-icon');

        this._icon = new St.Icon({style_class: 'system-status-icon'});
        this.add_child(this._icon);

        const settings = SettingsManager.getDefaultGSettings();
        this._trayPosChangedId = settings.connect('changed::tray-pos',
            () => this._updateChevronIcon());
        this._updateChevronIcon();

        this.visible = false;

        this.connect('destroy', () => this._onDestroy());
    }

    // A chevron pointing toward where the rest of the tray sits, so it reads
    // as "more icons this way" rather than an unrelated generic glyph.
    // pan-start/pan-end are direction-aware (RTL-safe); tray-pos: 'left'
    // means this box's icons grow rightward as more appear, so the overflow
    // button (always placed last) points further right, and vice versa for
    // 'right'. 'center' has no single natural horizontal direction.
    _updateChevronIcon() {
        const trayPos = SettingsManager.getDefaultGSettings().get_string('tray-pos');
        const iconName = {
            left: 'pan-end-symbolic',
            right: 'pan-start-symbolic',
            center: 'pan-down-symbolic',
        }[trayPos] ?? 'pan-down-symbolic';

        this._icon.icon_name = iconName;
    }

    _onDestroy() {
        SettingsManager.getDefaultGSettings().disconnect(this._trayPosChangedId);
        this._rows.forEach(row => this._destroyRow(row));
        this._rows.clear();
    }

    _destroyRow(row) {
        if (row.menuClient)
            row.menuClient.destroy();
        if (row.iconActor)
            row.iconActor.destroy();
        if (row.item)
            row.item.destroy();
    }

    hasIndicator(uniqueId) {
        return this._rows.has(uniqueId);
    }

    addIndicator(indicator) {
        if (this._rows.has(indicator.uniqueId))
            return;

        const item = new PopupMenu.PopupSubMenuMenuItem(
            indicator.title || indicator.id || indicator.uniqueId);

        const iconActor = new AppIndicator.IconActor(indicator,
            IndicatorStatusIcon.DEFAULT_ICON_SIZE);
        item.insert_child_below(iconActor, item.label);

        const row = {item, iconActor, menuClient: null};
        this._rows.set(indicator.uniqueId, row);

        const attachMenu = () => {
            if (row.menuClient) {
                row.menuClient.destroy();
                row.menuClient = null;
                item.menu.removeAll();
            }

            if (!indicator.menuPath)
                return;

            row.menuClient = new DBusMenu.Client(indicator.busName,
                indicator.menuPath, indicator);

            if (row.menuClient.isReady)
                row.menuClient.attachToMenu(item.menu);

            Util.connectSmart(row.menuClient, 'ready-changed', this, () => {
                if (row.menuClient.isReady)
                    row.menuClient.attachToMenu(item.menu);
            });
        };

        attachMenu();
        Util.connectSmart(indicator, 'menu', this, attachMenu);
        Util.connectSmart(indicator, 'destroy', this,
            () => this.removeIndicator(indicator.uniqueId));

        this.menu.addMenuItem(item);
        this._updateVisibility();
    }

    removeIndicator(uniqueId) {
        const row = this._rows.get(uniqueId);
        if (!row)
            return;

        this._destroyRow(row);
        this._rows.delete(uniqueId);
        this._updateVisibility();
    }

    _updateVisibility() {
        this.visible = this._rows.size > 0;
    }
});

let indicatorGroupManager;

export class IndicatorGroupManager {
    static initialize() {
        if (!indicatorGroupManager)
            indicatorGroupManager = new IndicatorGroupManager();
        return indicatorGroupManager;
    }

    static destroy() {
        if (indicatorGroupManager) {
            indicatorGroupManager.destroy();
            indicatorGroupManager = null;
        }
    }

    static getDefault() {
        return indicatorGroupManager;
    }

    get _settings() {
        return SettingsManager.getDefaultGSettings();
    }

    get enabled() {
        return this._settings.get_boolean('group-overflow-enabled');
    }

    get threshold() {
        return this._settings.get_int('group-overflow-threshold');
    }

    // Decided once, at registration time: indicators already beyond the
    // stored-order threshold are grouped from the start. Toggling the
    // setting or threshold later only affects indicators registered from
    // then on (no retroactive promotion/demotion of already-placed icons).
    shouldGroup(orderIndex) {
        return this.enabled && orderIndex >= this.threshold;
    }

    _ensureGroupIcon() {
        if (this._groupIcon)
            return this._groupIcon;

        this._groupIcon = new IndicatorGroupIcon();
        Main.panel.addToStatusArea(GROUP_STATUS_AREA_ID, this._groupIcon,
            999999, this._settings.get_string('tray-pos'));
        this._groupIcon.connect('destroy', () => {
            this._groupIcon = null;
        });

        return this._groupIcon;
    }

    addIndicator(indicator) {
        this._ensureGroupIcon().addIndicator(indicator);
    }

    destroy() {
        if (this._groupIcon)
            this._groupIcon.destroy();
        this._groupIcon = null;
    }
}
