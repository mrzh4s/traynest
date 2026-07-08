/* exported  GeneralPage*/

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {createPercentSliderRow} from './sliderRow.js';
import {createSpinRow} from './spinRow.js';

export var GeneralPage = GObject.registerClass(
class AppIndicatorGeneralPage extends Adw.PreferencesPage {
    _init(settings, settingsKey) {
        super._init({
            title: _('General'),
            icon_name: 'general-preferences-symbolic',
            name: 'General Page',
        });

        this._settings = settings;
        this._settingsKey = settingsKey;

        this._addBehaviorGroup();
        this._addDefaultAppearanceGroup();
    }

    _addSwitch(group, {title, subtitle, settingsKey}) {
        const row = new Adw.SwitchRow({
            title,
            subtitle,
            active: this._settings.get_boolean(settingsKey),
        });
        row.connect('notify::active', widget =>
            this._settings.set_boolean(settingsKey, widget.get_active()));
        group.add(row);
        return row;
    }

    // Global behavior: what the extension does, independent of how icons look.
    _addBehaviorGroup() {
        const group = new Adw.PreferencesGroup({
            title: _('Behavior'),
            description: _('Applies to the whole tray, not any single indicator'),
        });
        this.add(group);

        this._addSwitch(group, {
            title: _('Enable Legacy Tray Icons Support'),
            subtitle: _('Add X11 legacy tray icons to the panel area'),
            settingsKey: this._settingsKey.LEGACY_TRAY_ENABLED,
        });

        this._addSwitch(group, {
            title: _('Compact Mode'),
            subtitle: _('Puts tray indicators closer together'),
            settingsKey: this._settingsKey.COMPACT_MODE_ENABLED,
        });

        const groupOverflowSwitch = this._addSwitch(group, {
            title: _('Group Overflow Indicators'),
            subtitle: _('Collapse indicators beyond the threshold below into one panel menu'),
            settingsKey: this._settingsKey.GROUP_OVERFLOW_ENABLED,
        });

        const {row: thresholdRow} = createSpinRow({
            title: _('Overflow Threshold'),
            subtitle: _('Number of indicators to show directly before grouping the rest'),
            min: 1,
            max: 30,
            initialValue: this._settings.get_int(this._settingsKey.GROUP_OVERFLOW_THRESHOLD),
            onChange: value => this._settings.set_int(this._settingsKey.GROUP_OVERFLOW_THRESHOLD, value),
        });
        thresholdRow.sensitive = groupOverflowSwitch.active;
        groupOverflowSwitch.connect('notify::active', () =>
            (thresholdRow.sensitive = groupOverflowSwitch.active));
        group.add(thresholdRow);

        this._addSwitch(group, {
            title: _('Mirror Indicators into Quick Settings (Experimental)'),
            subtitle: _('Also show a small icon for each indicator inside the Quick ' +
                'Settings menu. Has no effect if unsupported on this Shell version'),
            settingsKey: this._settingsKey.QUICK_SETTINGS_ENABLED,
        });

        const alignmentList = new Gtk.StringList();
        const comboItems = [
            {pos: 'center', label: _('Center')},
            {pos: 'left', label: _('Left')},
            {pos: 'right', label: _('Right')},
        ];
        comboItems.forEach(item => alignmentList.append(item.label));

        const combo = new Adw.ComboRow({
            title: _('Tray Horizontal Alignment'),
            model: alignmentList,
        });
        const trayPos = this._settings.get_string(this._settingsKey.TRAY_POS);
        combo.set_selected(comboItems.findIndex(item => trayPos === item.pos));
        combo.connect('notify::selected', widget => this._settings.set_string(
            this._settingsKey.TRAY_POS, comboItems[widget.get_selected()].pos));
        group.add(combo);
    }

    // Global appearance defaults: applied to every indicator unless it has
    // its own override set on the Appearance page.
    _addDefaultAppearanceGroup() {
        const group = new Adw.PreferencesGroup({
            title: _('Default Appearance'),
            description: _('Applied to every indicator that doesn’t have its own ' +
                'override on the Appearance page'),
        });
        this.add(group);

        this._addSwitch(group, {
            title: _('Auto-Recolor for Panel Contrast'),
            subtitle: _('Automatically tint indicators without a manual color override ' +
                'for contrast against the current panel background'),
            settingsKey: this._settingsKey.AUTO_RECOLOR_ENABLED,
        });

        group.add(createPercentSliderRow({
            title: _('Opacity'),
            min: 0,
            max: 100,
            initialValue: this._settings.get_int(this._settingsKey.ICON_OPACITY),
            toPercent: raw => Math.round(raw / 255 * 100),
            fromPercent: pct => Math.round(pct / 100 * 255),
            onChange: value => this._settings.set_int(this._settingsKey.ICON_OPACITY, value),
        }).row);

        group.add(createPercentSliderRow({
            title: _('Desaturation'),
            min: 0,
            max: 100,
            initialValue: this._settings.get_double(this._settingsKey.ICON_SATURATION),
            toPercent: raw => Math.round(raw * 100),
            fromPercent: pct => pct / 100,
            onChange: value => this._settings.set_double(this._settingsKey.ICON_SATURATION, value),
        }).row);

        group.add(createPercentSliderRow({
            title: _('Brightness'),
            min: -100,
            max: 100,
            initialValue: this._settings.get_double(this._settingsKey.ICON_BRIGHTNESS),
            toPercent: raw => Math.round(raw * 100),
            fromPercent: pct => pct / 100,
            onChange: value => this._settings.set_double(this._settingsKey.ICON_BRIGHTNESS, value),
        }).row);

        group.add(createPercentSliderRow({
            title: _('Contrast'),
            min: -100,
            max: 100,
            initialValue: this._settings.get_double(this._settingsKey.ICON_CONTRAST),
            toPercent: raw => Math.round(raw * 100),
            fromPercent: pct => pct / 100,
            onChange: value => this._settings.set_double(this._settingsKey.ICON_CONTRAST, value),
        }).row);

        group.add(createSpinRow({
            title: _('Icon Size (px)'),
            subtitle: _('0 uses the panel’s default size'),
            min: 0,
            max: 96,
            step: 2,
            initialValue: this._settings.get_int(this._settingsKey.ICON_SIZE),
            onChange: value => this._settings.set_int(this._settingsKey.ICON_SIZE, value),
        }).row);
    }
});
