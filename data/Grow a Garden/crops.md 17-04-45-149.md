# Grow a Garden crops data notes

This folder contains the local Grow a Garden catalog datasets used for wiki and catalog work.

## Primary sources

- `https://growagarden.fandom.com/wiki/Crops`
- `https://grow-a-garden.farm/fruits`
- `https://www.growagardencalculator.codes/value-list`
- `https://growagardencalc.com/grow-a-garden-crop-value-list`

## Notes

- `crops.json` is intentionally broader than the calculator dataset and includes crop names surfaced by the current wiki navigation tables even when the value tables do not expose a full numeric row for that crop.
- When the upstream wiki omits a value row, the crop remains in the dataset with `N/A` placeholders so catalog coverage stays complete.
- Local crop image paths are preferred when a matching file exists under `public/Grow a Garden/Crops/`; otherwise the dataset keeps a `wikiImageUrl` fallback for future image work.
