/* exported getIndicatorDisplayName */

// Shared by the Indicators/Order/Appearance preference pages: looks up the
// human-readable name the running extension recorded for uniqueId (see
// indicatorStatusIcon.js's registerIndicatorName()), falling back to the raw
// id itself if no name has been recorded yet (e.g. manually-typed entries).
export function getIndicatorDisplayName(settings, settingsKey, uniqueId) {
    const names = settings.get_value(settingsKey.INDICATOR_NAMES).deep_unpack();
    const entry = names.find(([id]) => id === uniqueId);
    return entry ? entry[1] : uniqueId;
}
