type HeaderReader = Pick<Headers, "get">;

export const CONSENT_HEADER = "x-require-consent";

const GDPR_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "GI",
  "AX",
  "IC",
  "EA",
  "GF",
  "GP",
  "MQ",
  "RE",
  "YT",
  "MF",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "CH",
  "GB"
]);

export function serializeConsentRequirement(requiresConsent: boolean) {
  return requiresConsent ? "1" : "0";
}

export function resolveRequestCountry(headers: HeaderReader, geoCountry?: string | null) {
  return (
    headers.get("x-vercel-ip-country")?.toUpperCase() ||
    headers.get("x-vercel-ip-country-region")?.toUpperCase() ||
    geoCountry?.toUpperCase() ||
    headers.get("cf-ipcountry")?.toUpperCase() ||
    ""
  );
}

export function requiresConsentForCountry(country: string) {
  return GDPR_COUNTRIES.has(country.trim().toUpperCase());
}

export function resolveRequiresConsent(headers: HeaderReader, geoCountry?: string | null) {
  return requiresConsentForCountry(resolveRequestCountry(headers, geoCountry));
}
