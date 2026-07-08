/* exported  AppearancePage*/

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {getIndicatorDisplayName} from './displayNames.js';
import {createPercentSliderRow} from './sliderRow.js';
import {createSpinRow} from './spinRow.js';

Gio._promisify(Gtk.FileDialog.prototype, 'open', 'open_finish');

// Bundled icon collection shipped with the extension (icons/hicolor/scalable/actions/).
// Referenced by absolute installed path when picked, reusing the same leading-'/'
// file-path handling appIndicator.js's _getIconData() already has for custom icons.
// Labels here are untranslated keys: gettext() only works when called
// synchronously during _init() (it inspects the call stack to find "which
// extension" is asking). Every string used by a later, GTK-dispatched
// callback (factory setup, button clicks, popover construction) must be
// translated once up front in _init() and referenced as a plain string
// afterwards -- calling _() from inside those callbacks throws
// "gettext can only be called from extensions".
const BUNDLED_ICONS = [
    ['dot', 'Dot'],
    ['star', 'Star'],
    ['heart', 'Heart'],
    ['bell', 'Bell'],
    ['flag', 'Flag'],
    ['bookmark', 'Bookmark'],
    ['chat', 'Chat'],
    ['gear', 'Gear'],
    ['shield', 'Shield'],
    ['bolt', 'Bolt'],
];

function toHexColor(rgba) {
    const toByte = c => Math.round(c * 255).toString(16).padStart(2, '0');
    return `#${toByte(rgba.red)}${toByte(rgba.green)}${toByte(rgba.blue)}`;
}

function getOverride(settings, settingsKey, id) {
    const overrides = settings.get_value(settingsKey).deep_unpack();
    const entry = overrides.find(([entryId]) => entryId === id);
    return entry ? entry[1] : null;
}

function setOverride(settings, settingsKey, variantType, id, value) {
    const overrides = settings.get_value(settingsKey).deep_unpack()
        .filter(([entryId]) => entryId !== id);

    if (value !== null)
        overrides.push([id, value]);

    settings.set_value(settingsKey, new GLib.Variant(variantType, overrides));
}

function getCustomIconEntry(settings, settingsKey, id) {
    const entries = settings.get_value(settingsKey.CUSTOM_ICONS).deep_unpack();
    const entry = entries.find(([entryId]) => entryId === id);
    return entry ? {name: entry[1], atName: entry[2]} : {name: '', atName: ''};
}

function setCustomIconEntry(settings, settingsKey, id, {name, atName}) {
    const entries = settings.get_value(settingsKey.CUSTOM_ICONS).deep_unpack()
        .filter(([entryId]) => entryId !== id);

    if (name)
        entries.push([id, name, atName || '']);

    settings.set_value(settingsKey.CUSTOM_ICONS, new GLib.Variant('a(sss)', entries));
}

function addResetButton(row, onReset) {
    const resetButton = new Gtk.Button({
        icon_name: 'edit-clear-symbolic',
        valign: Gtk.Align.CENTER,
        css_classes: ['flat'],
        tooltip_text: _('Remove override'),
    });
    resetButton.connect('clicked', onReset);
    row.add_suffix(resetButton);
}

export var AppearancePage = GObject.registerClass(
class AppIndicatorAppearancePage extends Adw.PreferencesPage {
    _init(settings, settingsKey, extensionPath) {
        super._init({
            title: _('Appearance'),
            icon_name: 'applications-graphics-symbolic',
            name: 'Appearance Page',
        });
        this._settings = settings;
        this._settingsKey = settingsKey;
        this._extensionPath = extensionPath;

        // Pre-translated once, here, since gettext() cannot be called later
        // from GTK-dispatched callbacks (factory setup/bind, button clicks).
        this._browseLabel = _('Browse…');
        this._galleryLabel = _('Gallery…');
        this._chooseIconTitle = _('Choose an Icon Image');
        this._bundledIconLabels = new Map(
            BUNDLED_ICONS.map(([id, label]) => [id, _(label)]));

        this.group = new Adw.PreferencesGroup({
            title: _('Per-indicator appearance'),
            description: _('Override color, icon, opacity, size, saturation, brightness ' +
                'or contrast for specific indicators. Indicator IDs are filled in ' +
                'automatically the first time they appear in the panel.'),
        });
        this.add(this.group);

        const knownIds = this._settings.get_strv(this._settingsKey.INDICATOR_ORDER);
        knownIds.forEach(id => this.group.add(this._createIndicatorRow(id)));
    }

    _createIndicatorRow(id) {
        const displayName = getIndicatorDisplayName(this._settings, this._settingsKey, id);
        const row = new Adw.ExpanderRow({
            title: displayName,
            subtitle: displayName === id ? null : id,
        });

        this._createCustomIconRows(id).forEach(r => row.add_row(r));
        row.add_row(this._createColorRow(id));
        row.add_row(this._createPercentRow(id, {
            title: _('Opacity'),
            settingsKey: this._settingsKey.ICON_OPACITY_OVERRIDES,
            variantType: 'a(si)',
            min: 0,
            max: 100,
            toPercent: raw => Math.round(raw / 255 * 100),
            fromPercent: pct => Math.round(pct / 100 * 255),
        }));
        row.add_row(this._createSpinOverrideRow(id, {
            title: _('Icon Size (px)'),
            settingsKey: this._settingsKey.ICON_SIZE_OVERRIDES,
            variantType: 'a(si)',
            min: 0,
            max: 96,
            step: 2,
        }));
        row.add_row(this._createPercentRow(id, {
            title: _('Desaturation'),
            settingsKey: this._settingsKey.ICON_SATURATION_OVERRIDES,
            variantType: 'a(sd)',
            min: 0,
            max: 100,
            toPercent: raw => Math.round(raw * 100),
            fromPercent: pct => pct / 100,
        }));
        row.add_row(this._createPercentRow(id, {
            title: _('Brightness'),
            settingsKey: this._settingsKey.ICON_BRIGHTNESS_OVERRIDES,
            variantType: 'a(sd)',
            min: -100,
            max: 100,
            toPercent: raw => Math.round(raw * 100),
            fromPercent: pct => pct / 100,
        }));
        row.add_row(this._createPercentRow(id, {
            title: _('Contrast'),
            settingsKey: this._settingsKey.ICON_CONTRAST_OVERRIDES,
            variantType: 'a(sd)',
            min: -100,
            max: 100,
            toPercent: raw => Math.round(raw * 100),
            fromPercent: pct => pct / 100,
        }));

        return row;
    }

    _createCustomIconRows(id) {
        const entry = getCustomIconEntry(this._settings, this._settingsKey, id);

        const nameEntry = new Gtk.Entry({text: entry.name, valign: Gtk.Align.CENTER, hexpand: true});
        const atNameEntry = new Gtk.Entry({text: entry.atName, valign: Gtk.Align.CENTER, hexpand: true});

        const save = () => setCustomIconEntry(this._settings, this._settingsKey, id, {
            name: nameEntry.get_text(),
            atName: atNameEntry.get_text(),
        });
        nameEntry.connect('changed', save);
        atNameEntry.connect('changed', save);

        const browseButton = new Gtk.Button({label: this._browseLabel, valign: Gtk.Align.CENTER});
        browseButton.connect('clicked', async () => {
            const dialog = new Gtk.FileDialog({title: this._chooseIconTitle});
            try {
                const file = await dialog.open(this.get_root(), null);
                nameEntry.set_text(file.get_path());
            } catch (e) {
                // dismissed or failed to pick a file, nothing to do
            }
        });

        const galleryButton = new Gtk.Button({label: this._galleryLabel, valign: Gtk.Align.CENTER});
        galleryButton.connect('clicked', () => this._openIconGallery(galleryButton, nameEntry));

        const nameRow = new Adw.ActionRow({title: _('Icon Name or File')});
        nameRow.add_suffix(nameEntry);
        nameRow.add_suffix(browseButton);
        nameRow.add_suffix(galleryButton);

        const atNameRow = new Adw.ActionRow({title: _('Attention Icon Name')});
        atNameRow.add_suffix(atNameEntry);

        return [nameRow, atNameRow];
    }

    _openIconGallery(parentWidget, targetEntry) {
        const flowBox = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            max_children_per_line: 5,
            row_spacing: 4,
            column_spacing: 4,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8,
        });

        const popover = new Gtk.Popover({child: flowBox});

        BUNDLED_ICONS.forEach(([id]) => {
            const path = `${this._extensionPath}/icons/hicolor/scalable/actions/traynest-${id}-symbolic.svg`;

            const button = new Gtk.Button({
                child: new Gtk.Image({file: path, pixel_size: 24}),
                tooltip_text: this._bundledIconLabels.get(id),
                css_classes: ['flat'],
            });
            button.connect('clicked', () => {
                targetEntry.set_text(path);
                popover.popdown();
            });

            flowBox.append(button);
        });

        popover.set_parent(parentWidget);
        popover.popup();
        popover.connect('closed', () => popover.unparent());
    }

    _createColorRow(id) {
        const settingsKey = this._settingsKey.ICON_COLOR_OVERRIDES;
        const row = new Adw.ActionRow({title: _('Color Tint')});

        const initialHex = getOverride(this._settings, settingsKey, id);
        const initialRgba = new Gdk.RGBA();
        initialRgba.parse(initialHex || '#ffffff');

        let suppressSave = false;

        const colorButton = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({title: _('Pick a Tint Color')}),
            rgba: initialRgba,
            valign: Gtk.Align.CENTER,
        });
        colorButton.connect('notify::rgba', () => {
            if (!suppressSave)
                setOverride(this._settings, settingsKey, 'a(ss)', id, toHexColor(colorButton.rgba));
        });

        row.add_suffix(colorButton);
        addResetButton(row, () => {
            suppressSave = true;
            colorButton.rgba = initialRgba;
            suppressSave = false;
            setOverride(this._settings, settingsKey, 'a(ss)', id, null);
        });

        return row;
    }

    _createPercentRow(id, {title, settingsKey, variantType, min, max, toPercent, fromPercent}) {
        const override = getOverride(this._settings, settingsKey, id);
        const {row, setValueSilently} = createPercentSliderRow({
            title,
            min,
            max,
            initialValue: override !== null ? override : 0,
            toPercent,
            fromPercent,
            onChange: value => setOverride(this._settings, settingsKey, variantType, id, value),
        });

        addResetButton(row, () => {
            setValueSilently(0);
            setOverride(this._settings, settingsKey, variantType, id, null);
        });

        return row;
    }

    _createSpinOverrideRow(id, {title, settingsKey, variantType, min, max, step}) {
        const override = getOverride(this._settings, settingsKey, id);
        const {row, setValueSilently} = createSpinRow({
            title,
            min,
            max,
            step,
            initialValue: override !== null ? override : min,
            onChange: value => setOverride(this._settings, settingsKey, variantType, id, value),
        });

        addResetButton(row, () => {
            setValueSilently(min);
            setOverride(this._settings, settingsKey, variantType, id, null);
        });

        return row;
    }
});
