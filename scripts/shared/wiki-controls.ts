const DEVICE_CONTROL_KEYS = new Set([
  "desktop",
  "pc",
  "computer",
  "keyboard",
  "keyboard_mouse",
  "keyboardMouse",
  "mobile",
  "phone",
  "tablet",
  "console",
  "controller",
  "xbox",
  "playstation",
  "vr",
  "virtual_reality",
  "virtualReality"
]);

function hasControlValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(hasControlValue);
  if (value && typeof value === "object") return Object.values(value).some(hasControlValue);
  return false;
}

export function validateWikiControlsJson(value: unknown, label = "controls_json") {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array. Use [] when no controls are verified.`);
  }

  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${label}[${index}] must be an object with action and device-specific control keys.`);
    }

    const record = entry as Record<string, unknown>;
    if (typeof record.action !== "string" || !record.action.trim()) {
      throw new Error(`${label}[${index}] must include a non-empty action.`);
    }

    const hasDeviceControl = Object.entries(record).some(([key, controlValue]) => {
      return DEVICE_CONTROL_KEYS.has(key) && hasControlValue(controlValue);
    });
    if (!hasDeviceControl) {
      throw new Error(`${label}[${index}] must include at least one verified device control, such as desktop, mobile, tablet, console, or vr.`);
    }
  });
}
