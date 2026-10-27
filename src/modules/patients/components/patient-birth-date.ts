import { patientBirthDateSchema } from "../schemas/patient-input";

export const birthDateFormatError = "Ingresá una fecha válida en formato DD/MM/AAAA.";

export function formatBirthDateInput(value: string, isDeleting = false): string {
  if (isDeleting || !/^[\d/]+$/.test(value)) return value;
  if (/^\d{2}\/\d{2}$/.test(value)) return `${value}/`;
  if (/^\d{2}\/\d{3,6}$/.test(value)) return `${value.slice(0, 5)}/${value.slice(5)}`;
  if (value.includes("/")) return value;
  const digits = value.replace(/\//g, "");
  if (digits.length > 8) return value;
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4);
  return `${day}${digits.length >= 2 ? "/" : ""}${month}${digits.length >= 4 ? "/" : ""}${year}`;
}

export function birthDateToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  if (Number(year) < 1) return null;
  const iso = `${year}-${month}-${day}`;
  return patientBirthDateSchema.safeParse(iso).success ? iso : null;
}

export function isFutureBirthDate(iso: string, timezone: string, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return iso > `${get("year")}-${get("month")}-${get("day")}`;
}
