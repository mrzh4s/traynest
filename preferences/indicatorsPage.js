/* exported  IndicatorsPage*/

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {getIndicatorDisplayName} from './displayNames.js';

const IndicatorOverrideData = GObject.registerClass({
    GTypeName: 'IndicatorOverrideData',
    Properties: {
        'id': GObject.ParamSpec.string(
            'id', 'Id', 'A read and write string property',
            GObject.ParamFlags.READWRITE, ''),
        'hidden': GObject.ParamSpec.boolean(
            'hidden', 'Hidden', 'A read and write boolean property',
            GObject.ParamFlags.READWRITE, false),
        'force-menu': GObject.ParamSpec.boolean(
            'force-menu', 'Force Menu', 'A read and write boolean property',
            GObject.ParamFlags.READWRITE, false),
    },
}, class IndicatorOverrideData extends GObject.Object {
    constructor(props = {}) {
        super(props);
    }

    get id() {
        if (this._id === 'undefined')
            this._id = null;
        return this._id;
    }

    set id(value) {
        if (this.id === value)
            return;

        this._id = value;
        this.notify('id');
    }

    get hidden() {
        return !!this._hidden;
    }

    set hidden(value) {
        if (this.hidden === value)
            return;

        this._hidden = value;
        this.notify('hidden');
    }

    get forceMenu() {
        return !!this._forceMenu;
    }

    set forceMenu(value) {
        if (this.forceMenu === value)
            return;

        this._forceMenu = value;
        this.notify('force-menu');
    }
});

export var IndicatorsPage = GObject.registerClass(
class AppIndicatorIndicatorsPage extends Adw.PreferencesPage {
    _init(settings, settingsKey) {
        super._init({
            title: _('Indicators'),
            icon_name: 'view-list-symbolic',
            name: 'Indicators Page',
        });
        this._settings = settings;
        this._settingsKey = settingsKey;

        this.group = new Adw.PreferencesGroup({
            title: _('Per-indicator overrides'),
            description: _('Hide specific indicators, force them to always open ' +
                'their menu on left-click, or reorder them. Indicator IDs are ' +
                'filled in automatically the first time an indicator appears; ' +
                'you can also add one manually.'),
        });
        this.add(this.group);

        this.container = new Gtk.Box({
            halign: Gtk.Align.FILL,
            hexpand: true,
            orientation: Gtk.Orientation.VERTICAL,
        });
        this.group.add(this.container);

        this._buildColumnView();
        this._rebuild();
    }

    _buildColumnView() {
        this.listStore = new Gio.ListStore({item_type: IndicatorOverrideData});
        this.selectionModel = new Gtk.SingleSelection({model: this.listStore});
        this.columnView = new Gtk.ColumnView({
            hexpand: true,
            model: this.selectionModel,
            reorderable: false,
        });

        const nameColumn = new Gtk.ColumnViewColumn({title: _('Name'), expand: true});
        const idColumn = new Gtk.ColumnViewColumn({title: _('Indicator ID'), expand: true});
        const hiddenColumn = new Gtk.ColumnViewColumn({title: _('Hidden')});
        const forceMenuColumn = new Gtk.ColumnViewColumn({title: _('Force Menu on Click')});
        const orderColumn = new Gtk.ColumnViewColumn({title: _('Order')});

        const factoryName = new Gtk.SignalListItemFactory();
        factoryName.connect('setup', (_widget, item) => {
            const label = new Gtk.Label({xalign: 0});
            item.set_child(label);
        });
        factoryName.connect('bind', (_widget, item) => {
            const label = item.get_child();
            const data = item.get_item();

            const updateName = () => {
                label.set_text(getIndicatorDisplayName(this._settings, this._settingsKey, data.id));
            };
            updateName();
            label._idChangedId = data.connect('notify::id', updateName);
        });
        factoryName.connect('unbind', (_widget, item) => {
            const label = item.get_child();
            const data = item.get_item();
            if (label._idChangedId) {
                data.disconnect(label._idChangedId);
                delete label._idChangedId;
            }
        });

        const factoryId = new Gtk.SignalListItemFactory();
        factoryId.connect('setup', (_widget, item) => {
            const label = new Gtk.EditableLabel({text: ''});
            item.set_child(label);
        });
        factoryId.connect('bind', (_widget, item) => {
            const label = item.get_child();
            const data = item.get_item();
            label.set_text(data.id);
            label.bind_property('text', data, 'id', GObject.BindingFlags.SYNC_CREATE);
            label.connect('changed', () => this._autoSave(item));
        });

        const factoryHidden = new Gtk.SignalListItemFactory();
        factoryHidden.connect('setup', (_widget, item) => {
            const toggle = new Gtk.CheckButton();
            item.set_child(toggle);
        });
        factoryHidden.connect('bind', (_widget, item) => {
            const toggle = item.get_child();
            const data = item.get_item();
            toggle.set_active(data.hidden);
            toggle.bind_property('active', data, 'hidden', GObject.BindingFlags.SYNC_CREATE);
            toggle.connect('notify::active', () => this._autoSave(item));
        });

        const factoryForceMenu = new Gtk.SignalListItemFactory();
        factoryForceMenu.connect('setup', (_widget, item) => {
            const toggle = new Gtk.CheckButton();
            item.set_child(toggle);
        });
        factoryForceMenu.connect('bind', (_widget, item) => {
            const toggle = item.get_child();
            const data = item.get_item();
            toggle.set_active(data.forceMenu);
            toggle.bind_property('active', data, 'force-menu', GObject.BindingFlags.SYNC_CREATE);
            toggle.connect('notify::active', () => this._autoSave(item));
        });

        const factoryOrder = new Gtk.SignalListItemFactory();
        factoryOrder.connect('setup', (_widget, item) => {
            const box = new Gtk.Box({spacing: 4});
            box._upButton = new Gtk.Button({icon_name: 'go-up-symbolic', css_classes: ['flat']});
            box._downButton = new Gtk.Button({icon_name: 'go-down-symbolic', css_classes: ['flat']});
            box._removeButton = new Gtk.Button({icon_name: 'user-trash-symbolic', css_classes: ['flat']});
            box.append(box._upButton);
            box.append(box._downButton);
            box.append(box._removeButton);
            item.set_child(box);
        });
        factoryOrder.connect('bind', (_widget, item) => {
            const box = item.get_child();
            const data = item.get_item();

            box._upId = box._upButton.connect('clicked', () => this._move(data.id, -1));
            box._downId = box._downButton.connect('clicked', () => this._move(data.id, 1));
            box._removeId = box._removeButton.connect('clicked', () => this._removeIndicator(data.id));

            const isBlankRow = !data.id;
            box._upButton.sensitive = !isBlankRow;
            box._downButton.sensitive = !isBlankRow;
            box._removeButton.sensitive = !isBlankRow;
        });
        factoryOrder.connect('unbind', (_widget, item) => {
            const box = item.get_child();
            box._upButton.disconnect(box._upId);
            box._downButton.disconnect(box._downId);
            box._removeButton.disconnect(box._removeId);
        });

        nameColumn.set_factory(factoryName);
        idColumn.set_factory(factoryId);
        hiddenColumn.set_factory(factoryHidden);
        forceMenuColumn.set_factory(factoryForceMenu);
        orderColumn.set_factory(factoryOrder);

        this.columnView.append_column(nameColumn);
        this.columnView.append_column(idColumn);
        this.columnView.append_column(hiddenColumn);
        this.columnView.append_column(forceMenuColumn);
        this.columnView.append_column(orderColumn);

        this.container.append(this.columnView);
    }

    _knownIds() {
        const hiddenIds = new Set(this._settings.get_strv(this._settingsKey.HIDDEN_INDICATORS));
        const overrides = this._settings.get_value(this._settingsKey.CLICK_OVERRIDES).deep_unpack();
        const forceMenuIds = new Set(overrides.filter(([, force]) => force).map(([id]) => id));
        const orderedIds = this._settings.get_strv(this._settingsKey.INDICATOR_ORDER);

        return [...new Set([...orderedIds, ...hiddenIds, ...forceMenuIds])];
    }

    _rebuild() {
        this.listStore.remove_all();

        const hiddenIds = new Set(this._settings.get_strv(this._settingsKey.HIDDEN_INDICATORS));
        const overrides = this._settings.get_value(this._settingsKey.CLICK_OVERRIDES).deep_unpack();
        const forceMenuIds = new Set(overrides.filter(([, force]) => force).map(([id]) => id));

        this._knownIds().forEach(id => {
            this.listStore.append(new IndicatorOverrideData({
                id,
                hidden: hiddenIds.has(id),
                forceMenu: forceMenuIds.has(id),
            }));
        });

        this.listStore.append(new IndicatorOverrideData({id: '', hidden: false, forceMenu: false}));
    }

    _move(id, direction) {
        const order = this._settings.get_strv(this._settingsKey.INDICATOR_ORDER);
        const index = order.indexOf(id);
        if (index === -1)
            return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= order.length)
            return;

        [order[index], order[newIndex]] = [order[newIndex], order[index]];
        this._settings.set_strv(this._settingsKey.INDICATOR_ORDER, order);
        this._rebuild();
    }

    _removeIndicator(id) {
        const order = this._settings.get_strv(this._settingsKey.INDICATOR_ORDER).filter(i => i !== id);
        this._settings.set_strv(this._settingsKey.INDICATOR_ORDER, order);

        const hidden = this._settings.get_strv(this._settingsKey.HIDDEN_INDICATORS).filter(i => i !== id);
        this._settings.set_strv(this._settingsKey.HIDDEN_INDICATORS, hidden);

        const overrides = this._settings.get_value(this._settingsKey.CLICK_OVERRIDES).deep_unpack()
            .filter(([entryId]) => entryId !== id);
        this._settings.set_value(this._settingsKey.CLICK_OVERRIDES, new GLib.Variant('a(sb)', overrides));

        this._rebuild();
    }

    _autoSave(item) {
        const storeLength = this.listStore.get_n_items();
        const hidden = [];
        const forceMenuOverrides = [];

        for (let i = 0; i < storeLength; i++) {
            const row = this.listStore.get_item(i);
            if (!row.id)
                continue;

            if (row.hidden)
                hidden.push(row.id);

            if (row.forceMenu)
                forceMenuOverrides.push([row.id, true]);
        }

        this._settings.set_strv(this._settingsKey.HIDDEN_INDICATORS, hidden);
        this._settings.set_value(this._settingsKey.CLICK_OVERRIDES,
            new GLib.Variant('a(sb)', forceMenuOverrides));

        const {id} = item.get_item();

        // Register manually-typed ids into indicator-order too, so their
        // reorder/remove buttons work next time this page is opened (not
        // rebuilding the list here, to avoid disrupting an in-progress edit).
        if (id) {
            const order = this._settings.get_strv(this._settingsKey.INDICATOR_ORDER);
            if (!order.includes(id))
                this._settings.set_strv(this._settingsKey.INDICATOR_ORDER, [...order, id]);
        }

        /* dynamic new entry*/
        if (storeLength === 1 && id)
            this.listStore.append(new IndicatorOverrideData({id: '', hidden: false, forceMenu: false}));

        if (storeLength > 1) {
            if (id && item.get_position() >= storeLength - 1)
                this.listStore.append(new IndicatorOverrideData({id: '', hidden: false, forceMenu: false}));
        }
    }
});
