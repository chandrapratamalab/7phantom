/**
 * Shared shape for Server Action results.
 *
 * Lives outside `src/actions/*` because a `"use server"` module may only export
 * async functions — everything else (types are erased, but constants are not)
 * must be imported from a regular module.
 */

export type AuthActionState = {
  status: "idle" | "error" | "success";
  /** Human-readable, already-translated summary message. */
  message?: string;
  /** Per-field messages, keyed by input `name`. */
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialAuthActionState: AuthActionState = { status: "idle" };
