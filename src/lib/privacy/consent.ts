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

function readUpperHeader(headers: HeaderReader, ...names: string[]) {
  for (const name of names) {
    const value = headers.get(name)?.trim().toUpperCase();
    if (value) {
      return value;
    }
  }

  return "";
}

export function resolveRequestCountry(headers: HeaderReader, geoCountry?: string | null) {
  return (
    readUpperHeader(headers, "cf-ipcountry", "x-country-code", "x-forwarded-country", "x-geo-country") ||
    headers.get("x-vercel-ip-country")?.trim().toUpperCase() ||
    geoCountry?.toUpperCase() ||
    ""
  );
}

export function requiresConsentForCountry(country: string) {
  return GDPR_COUNTRIES.has(country.trim().toUpperCase());
}

export function resolveRequiresConsent(headers: HeaderReader, geoCountry?: string | null) {
  return requiresConsentForCountry(resolveRequestCountry(headers, geoCountry));
}
