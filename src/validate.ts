/**
 * Request-body validation for the write endpoints.
 *
 * Previously every route passed req.body values straight to slugify() or the
 * mysql2 driver, so a missing field, a non-string, or an over-length string
 * surfaced as a 500 ("Failed to create project") instead of a 400. Objects were
 * worse: they were silently coerced and stored as "[object Object]".
 *
 * These helpers reject at the boundary and throw ValidationError, which the
 * app-level error handler renders as a 400.
 *
 * Length rules mirror the schema exactly:
 *   - VARCHAR(n) counts CHARACTERS, so we count code points ([...s].length),
 *     not s.length — a surrogate-pair emoji is one character to MySQL but two
 *     UTF-16 units to JS.
 *   - TEXT holds 65,535 BYTES, so we measure with Buffer.byteLength — a 4-byte
 *     emoji costs four of them. This is why 20k emoji used to 500.
 */

export class ValidationError extends Error {
	readonly status = 400;

	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

/** MySQL TEXT column capacity, in bytes. */
export const TEXT_MAX_BYTES = 65535;

function asString(value: unknown, field: string): string {
	if (typeof value !== "string") {
		throw new ValidationError(`${field} must be a string`);
	}
	return value;
}

function checkVarcharLength(value: string, field: string, max: number): void {
	if ([...value].length > max) {
		throw new ValidationError(`${field} must be ${max} characters or fewer`);
	}
}

function checkTextLength(value: string, field: string): void {
	if (Buffer.byteLength(value, "utf8") > TEXT_MAX_BYTES) {
		throw new ValidationError(
			`${field} is too long (limit ${TEXT_MAX_BYTES} bytes)`
		);
	}
}

/** Required VARCHAR(max): must be a string with non-whitespace content. */
export function requiredVarchar(value: unknown, field: string, max: number): string {
	if (value === undefined || value === null) {
		throw new ValidationError(`${field} is required`);
	}
	const trimmed = asString(value, field).trim();
	if (!trimmed) throw new ValidationError(`${field} is required`);
	checkVarcharLength(trimmed, field, max);
	return trimmed;
}

/** Optional VARCHAR(max). Absent, null, or blank all collapse to null. */
export function optionalVarchar(
	value: unknown,
	field: string,
	max: number
): string | null {
	if (value === undefined || value === null) return null;
	const trimmed = asString(value, field).trim();
	if (!trimmed) return null;
	checkVarcharLength(trimmed, field, max);
	return trimmed;
}

/** Required TEXT column. */
export function requiredText(value: unknown, field: string): string {
	if (value === undefined || value === null) {
		throw new ValidationError(`${field} is required`);
	}
	const trimmed = asString(value, field).trim();
	if (!trimmed) throw new ValidationError(`${field} is required`);
	checkTextLength(trimmed, field);
	return trimmed;
}

/** Optional TEXT column. Absent, null, or blank all collapse to null. */
export function optionalText(value: unknown, field: string): string | null {
	if (value === undefined || value === null) return null;
	const trimmed = asString(value, field).trim();
	if (!trimmed) return null;
	checkTextLength(trimmed, field);
	return trimmed;
}

/** Required integer (e.g. a foreign key from the request body). */
export function requiredInt(value: unknown, field: string): number {
	if (value === undefined || value === null || value === "") {
		throw new ValidationError(`${field} is required`);
	}
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isInteger(n)) {
		throw new ValidationError(`${field} must be an integer`);
	}
	return n;
}

/** Optional integer (e.g. sort_order). Rejects non-numeric input. */
export function optionalInt(
	value: unknown,
	field: string,
	fallback: number
): number {
	if (value === undefined || value === null || value === "") return fallback;
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isInteger(n)) {
		throw new ValidationError(`${field} must be an integer`);
	}
	return n;
}

/** Value must be one of `allowed`. */
export function oneOf<T extends string>(
	value: unknown,
	field: string,
	allowed: readonly T[]
): T {
	const s = asString(value, field).trim();
	if (!allowed.includes(s as T)) {
		throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`);
	}
	return s as T;
}

// --- Pagination ----------------------------------------------------------

/**
 * Upper bound on OFFSET. `parseInt("999999999999999999999")` yields 1e21, which
 * is a finite JS number but overflows MySQL's BIGINT and made the query throw a
 * 500. Nothing legitimate pages this deep.
 */
const MAX_OFFSET = 1_000_000;

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
	// Arrays arrive here when a client sends `?limit[]=1&limit[]=2`; Number()
	// on anything non-scalar yields NaN, which falls back rather than throwing.
	if (typeof raw !== "string" && typeof raw !== "number") return fallback;
	if (raw === "") return fallback;
	const n = Number(raw);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function parsePagination(
	rawOffset: unknown,
	rawLimit: unknown,
	defaultLimit = 20,
	maxLimit = 100
): { offset: number; limit: number } {
	return {
		offset: clampInt(rawOffset, 0, MAX_OFFSET, 0),
		limit: clampInt(rawLimit, 1, maxLimit, defaultLimit),
	};
}

/** A query-string value that must be a plain scalar string, or absent. */
export function optionalQueryString(raw: unknown): string | null {
	return typeof raw === "string" && raw !== "" ? raw : null;
}

// --- Control-character hygiene -------------------------------------------
//
// Stored values used to keep raw CR/LF and NUL. Harmless while they only go
// into HTML, but the moment a value is interpolated into an email header
// (the planned Resend work) a CRLF becomes header injection. Strip on write so
// stored rows are clean rather than relying on every future consumer to escape.

const CONTROL_CHARS_ALL = /[\u0000-\u001F\u007F-\u009F]/g;
const CONTROL_CHARS_KEEP_NEWLINES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/** Collapse to a single line: removes every control char, including CR/LF. */
export function singleLine(value: string): string {
	return value.replace(CONTROL_CHARS_ALL, "").trim();
}

/** Preserve paragraphs but drop stray control chars; normalises CRLF to LF. */
export function multiLine(value: string): string {
	return value
		.replace(/\r\n?/g, "\n")
		.replace(CONTROL_CHARS_KEEP_NEWLINES, "")
		.trim();
}
