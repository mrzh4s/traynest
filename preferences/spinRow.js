/* exported createSpinRow */

import Adw from 'gi://Adw';

// A plain dial-style spin row (up/down stepper) for discrete integer values
// where a percentage/slider doesn't make sense -- pixel sizes, item counts.
// For continuous/perceptual values (brightness, saturation, contrast,
// opacity) use sliderRow.js's createPercentSliderRow instead.
export function createSpinRow({title, subtitle, min, max, step = 1, initialValue, onChange, suffixWidget}) {
    const row = Adw.SpinRow.new_with_range(min, max, step);
    row.title = title;
    if (subtitle)
        row.subtitle = subtitle;

    let suppressChange = false;
    row.set_value(initialValue);

    const save = () => {
        if (!suppressChange)
            onChange(parseInt(row.get_value(), 10));
        return false;
    };
    row.connect('input', save);
    row.connect('output', save);

    if (suffixWidget)
        row.add_suffix(suffixWidget);

    return {
        row,
        setValueSilently(value) {
            suppressChange = true;
            row.set_value(value);
            suppressChange = false;
        },
    };
}
