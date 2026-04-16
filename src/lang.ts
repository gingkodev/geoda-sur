import type { Request } from "express";
import type { RowDataPacket } from "mysql2";

export type Lang = "es" | "en";

const VALID_LANGS = new Set(["es", "en"]);

export function getLang(req: Request): Lang | null {
  const raw = req.query.lang as string | undefined;
  if (!raw) return null;
  return VALID_LANGS.has(raw) ? (raw as Lang) : null;
}

/**
 * Resolve language on a row: when lang is 'en', swap `_en` fields into base
 * fields (with fallback to Spanish). When lang is 'es', strip `_en` fields.
 * When lang is null (admin), return everything as-is.
 */
export function resolveRow(
  row: RowDataPacket,
  lang: Lang | null,
  fields: string[],
): RowDataPacket {
  if (lang === null) return row;

  for (const f of fields) {
    const enKey = `${f}_en`;
    if (lang === "en" && row[enKey] != null) {
      row[f] = row[enKey];
    }
    delete row[enKey];
  }
  return row;
}

export function resolveRows(
  rows: RowDataPacket[],
  lang: Lang | null,
  fields: string[],
): RowDataPacket[] {
  for (const row of rows) resolveRow(row, lang, fields);
  return rows;
}

export function cacheHeaders(lang: Lang | null): Record<string, string> {
  if (lang === null) return {};
  return { "Cache-Control": "public, max-age=300" };
}
