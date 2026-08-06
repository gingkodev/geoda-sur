import type { Response } from "express";
import { ValidationError } from "./validate.js";
import { isDuplicateEntry } from "./slugs.js";

/**
 * Uniform catch-block handling for the write routes.
 *
 * Every handler used to end in `catch { res.status(500) }`, so bad client input
 * — a missing field, a wrong type, a duplicate name — was reported as a server
 * fault. That made real 500s indistinguishable from user error in logs and gave
 * the CMS nothing useful to show. This maps the cases we can classify and keeps
 * `fallback` for genuinely unexpected failures.
 */
export function handleRouteError(
	err: unknown,
	res: Response,
	fallback: string
): Response {
	if (err instanceof ValidationError) {
		return res.status(err.status).json({ error: err.message });
	}

	// Slug allocation narrows this to a genuine race, but the UNIQUE index is
	// still the final arbiter — surface it as a conflict, not a crash.
	if (isDuplicateEntry(err)) {
		return res
			.status(409)
			.json({ error: "Ya existe un registro con ese nombre" });
	}

	console.error(err);
	return res.status(500).json({ error: fallback });
}
