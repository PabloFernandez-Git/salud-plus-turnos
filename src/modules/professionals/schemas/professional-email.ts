import { z } from "zod";

const localPartPattern = /^[a-z0-9_+.'-]+$/;
const domainLabelPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const topLevelDomainPattern = /^[a-z]{2,}$/;

export function normalizeProfessionalEmail(value: string): string {
  return value.replace(/^ +| +$/g, "").toLowerCase();
}

export function isValidProfessionalEmail(value: string): boolean {
  const email = normalizeProfessionalEmail(value);
  if (email.length > 320 || /\s/.test(email)) return false;

  const separator = email.indexOf("@");
  if (separator <= 0 || separator !== email.lastIndexOf("@")) return false;

  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  if (
    local.length > 64 ||
    domain.length === 0 ||
    domain.length > 255 ||
    !localPartPattern.test(local) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.endsWith("'") ||
    local.includes("..") ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    return false;
  }

  const labels = domain.split(".");
  return (
    labels.length >= 2 &&
    labels.every((label) => label.length <= 63 && domainLabelPattern.test(label)) &&
    topLevelDomainPattern.test(labels.at(-1) ?? "")
  );
}

export const professionalEmailSchema = z
  .string()
  .transform(normalizeProfessionalEmail)
  .refine((value) => isValidProfessionalEmail(value), "Invalid professional email");
