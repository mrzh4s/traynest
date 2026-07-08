// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

/* exported init, buildPrefsWidget */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';  // will be removed
import Gdk from 'gi://Gdk';
import * as GeneralPreferences from './preferences/generalPage.js';
import * as IndicatorsPreferences from './preferences/indicatorsPage.js';
import * as AppearancePreferences from './preferences/appearancePage.js';

import {
    ExtensionPreferences,
    gettext as _
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SettingsKey = {
    LEGACY_TRAY_ENABLED: 'legacy-tray-enabled',
    COMPACT_MODE_ENABLED: 'compact-mode-enabled',
    ICON_SIZE: 'icon-size',
    ICON_OPACITY: 'icon-opacity',
    ICON_SATURATION: 'icon-saturation',
    ICON_BRIGHTNESS: 'icon-brightness',
    ICON_CONTRAST: 'icon-contrast',
    TRAY_POS: 'tray-pos',
    CUSTOM_ICONS: 'custom-icons',
    HIDDEN_INDICATORS: 'hidden-indicators',
    INDICATOR_ORDER: 'indicator-order',
    CLICK_OVERRIDES: 'click-overrides',
    GROUP_OVERFLOW_ENABLED: 'group-overflow-enabled',
    GROUP_OVERFLOW_THRESHOLD: 'group-overflow-threshold',
    QUICK_SETTINGS_ENABLED: 'quick-settings-enabled',
    ICON_COLOR_OVERRIDES: 'icon-color-overrides',
    ICON_OPACITY_OVERRIDES: 'icon-opacity-overrides',
    ICON_SIZE_OVERRIDES: 'icon-size-overrides',
    ICON_SATURATION_OVERRIDES: 'icon-saturation-overrides',
    ICON_BRIGHTNESS_OVERRIDES: 'icon-brightness-overrides',
    ICON_CONTRAST_OVERRIDES: 'icon-contrast-overrides',
    AUTO_RECOLOR_ENABLED: 'auto-recolor-enabled',
    INDICATOR_NAMES: 'indicator-names',
};

// Adw.PreferencesPage wraps its content in ScrolledWindow > Viewport > Clamp,
// and that Clamp caps the content width regardless of how wide the window
// is -- standard GNOME HIG behavior. Adjusted here to a fixed, narrower
// reading width than Adwaita's own default.
function widenClamp(page) {
    const clamp = page.get_first_child()?.get_first_child()?.get_first_child();
    if (clamp instanceof Adw.Clamp) {
        clamp.maximum_size = 520;
        clamp.tightening_threshold = 400;
    }
}

export default class DockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        if (!iconTheme.get_search_path().includes(`${this.path}/icons`))
            iconTheme.add_search_path(`${this.path}/icons`);


        // No explicit default size: Adw.PreferencesWindow's own built-in
        // default (640x576) is well-proportioned against the 520px content
        // clamp below, rather than us guessing a "best fit" size ourselves.
        window.search_enabled = true;

        const settings = this.getSettings();
        const generalPage = new GeneralPreferences.GeneralPage(settings, SettingsKey);
        const indicatorsPage = new IndicatorsPreferences.IndicatorsPage(settings, SettingsKey);
        const appearancePage = new AppearancePreferences.AppearancePage(settings, SettingsKey, this.path);

        [generalPage, indicatorsPage, appearancePage].forEach(page => {
            window.add(page);
            widenClamp(page);
        });

        window.connect('close-request', () => {
            window.destroy();
        });
    }
}
