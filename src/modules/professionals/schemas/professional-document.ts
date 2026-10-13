import { z } from "zod";

// Mirrors private.normalize_document() for input validation only. PostgreSQL remains
// the authority for canonical identity and deduplication.
export function normalizeDocumentForValidation(document: string) {
  return document
    .trim()
    .toUpperCase()
    .replace(/[\s.]/g, "")
    .replace(/[-\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, "");
}

export const professionalDocumentSchema = z
  .string()
  .trim()
  .refine((document) => normalizeDocumentForValidation(document).length > 0, {
    message: "Ingresá un documento válido.",
  });
