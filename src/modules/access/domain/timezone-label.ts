import { timezoneCountryCodes } from "./timezone-country-codes";

const countryNames = new Intl.DisplayNames("es-AR", { type: "region" });
const timezoneAliasCountryCodes: Record<string, string> = {
  "Africa/Asmera": "ER",
  "America/Buenos_Aires": "AR",
  "America/Catamarca": "AR",
  "America/Coral_Harbour": "CA",
  "America/Cordoba": "AR",
  "America/Godthab": "GL",
  "America/Indianapolis": "US",
  "America/Jujuy": "AR",
  "America/Louisville": "US",
  "America/Mendoza": "AR",
  "Asia/Calcutta": "IN",
  "Asia/Katmandu": "NP",
  "Asia/Rangoon": "MM",
  "Asia/Saigon": "VN",
  "Atlantic/Faeroe": "FO",
  "Europe/Kiev": "UA",
  "Pacific/Enderbury": "KI",
  "Pacific/Ponape": "FM",
  "Pacific/Truk": "FM",
};
const countryCodeByCity = new Map<string, string | null>();
for (const [zone, code] of Object.entries(timezoneCountryCodes)) {
  const city = zone.split("/").at(-1)!;
  const previous = countryCodeByCity.get(city);
  countryCodeByCity.set(city, previous === undefined || previous === code ? code : null);
}

function countryForTimezone(zone: string) {
  const code =
    timezoneCountryCodes[zone] ??
    timezoneAliasCountryCodes[zone] ??
    countryCodeByCity.get(zone.split("/").at(-1)!) ??
    null;
  return code ? countryNames.of(code) : null;
}

export function timezoneLabel(zone: string, at = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    });
    const offset = formatter.formatToParts(at).find((part) => part.type === "timeZoneName")?.value;
    if (zone.startsWith("Etc/")) return offset === "GMT" ? "GMT+0" : (offset ?? zone);
    const displayZone = countryForTimezone(zone) ? zone : formatter.resolvedOptions().timeZone;
    const city = displayZone.split("/").at(-1)!.replaceAll("_", " ");
    const country = countryForTimezone(displayZone);
    return `${city}${country ? `, ${country}` : ""} (${offset === "GMT" ? "GMT+0" : offset})`;
  } catch {
    return zone;
  }
}

export function timezoneMatchesQuery(zone: string, query: string, label: string) {
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es-AR");
  const normalizedQuery = normalize(query.trim());
  return normalize(zone).includes(normalizedQuery) || normalize(label).includes(normalizedQuery);
}
