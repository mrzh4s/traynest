/* exported createPercentSliderRow */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

function buildRow(title, subtitle) {
    // Adw.ActionRow's constructor rejects an explicit `subtitle: undefined`
    // (GJS object initializers only accept a real value or omission), so
    // callers that don't pass one must not have it end up in the props object.
    return subtitle ? new Adw.ActionRow({title, subtitle}) : new Adw.ActionRow({title});
}

function buildScale(min, max, formatValueFunc) {
    const scale = new Gtk.Scale({
        orientation: Gtk.Orientation.HORIZONTAL,
        adjustment: new Gtk.Adjustment({
            lower: min,
            upper: max,
            step_increment: 1,
            page_increment: Math.max(1, Math.round((max - min) / 10)),
        }),
        draw_value: true,
        hexpand: true,
        valign: Gtk.Align.CENTER,
    });
    scale.set_format_value_func(formatValueFunc);
    return scale;
}

// A slider whose displayed value is a rounded percentage, while the actual
// stored value can be in any underlying unit (0-255 opacity, 0.0-1.0
// saturation, -1.0..1.0 brightness/contrast, ...) -- toPercent/fromPercent
// convert between the two. min/max are in PERCENT (e.g. -100..100).
export function createPercentSliderRow({
    title, subtitle, min = 0, max = 100, initialValue, toPercent, fromPercent, onChange, suffixWidget,
}) {
    const row = buildRow(title, subtitle);
    const scale = buildScale(min, max, (_scale, value) => `${Math.round(value)}%`);

    let suppressChange = false;
    scale.set_value(toPercent(initialValue));
    scale.connect('value-changed', () => {
        if (!suppressChange)
            onChange(fromPercent(scale.get_value()));
    });

    row.add_suffix(scale);
    row.activatable_widget = scale;
    if (suffixWidget)
        row.add_suffix(suffixWidget);

    return {
        row,
        scale,
        setValueSilently(rawValue) {
            suppressChange = true;
            scale.set_value(toPercent(rawValue));
            suppressChange = false;
        },
    };
}
