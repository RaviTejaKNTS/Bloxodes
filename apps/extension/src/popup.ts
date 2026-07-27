export {};

type BloxodesWidgetSettings = {
  showCodes: boolean;
  showHistory: boolean;
};

const SETTINGS_KEY = "widgetSettings";
const DEFAULT_SETTINGS: BloxodesWidgetSettings = {
  showCodes: true,
  showHistory: true
};

const codesToggle = document.querySelector<HTMLInputElement>("#show-codes");
const historyToggle = document.querySelector<HTMLInputElement>("#show-history");
const saveStatus = document.querySelector<HTMLElement>("#save-status");

function normalizeSettings(value: unknown): BloxodesWidgetSettings {
  const settings =
    value && typeof value === "object"
      ? (value as Partial<BloxodesWidgetSettings>)
      : {};
  return {
    showCodes:
      typeof settings.showCodes === "boolean"
        ? settings.showCodes
        : DEFAULT_SETTINGS.showCodes,
    showHistory:
      typeof settings.showHistory === "boolean"
        ? settings.showHistory
        : DEFAULT_SETTINGS.showHistory
  };
}

function readSettings(): Promise<BloxodesWidgetSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(SETTINGS_KEY, (items) => {
      if (chrome.runtime.lastError) {
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }
      resolve(normalizeSettings(items[SETTINGS_KEY]));
    });
  });
}

function writeSettings(settings: BloxodesWidgetSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [SETTINGS_KEY]: settings }, resolve);
  });
}

async function save(): Promise<void> {
  if (!codesToggle || !historyToggle) return;
  if (saveStatus) saveStatus.textContent = "Saving…";
  await writeSettings({
    showCodes: codesToggle.checked,
    showHistory: historyToggle.checked
  });
  if (saveStatus) saveStatus.textContent = "Changes applied.";
}

async function start(): Promise<void> {
  const settings = await readSettings();
  if (codesToggle) {
    codesToggle.checked = settings.showCodes;
    codesToggle.addEventListener("change", () => void save());
  }
  if (historyToggle) {
    historyToggle.checked = settings.showHistory;
    historyToggle.addEventListener("change", () => void save());
  }
}

void start();
