/**
 * Types for lib/localization.mjs.
 *
 * The implementation stays .mjs so the migration scripts (plain node, outside
 * tsconfig) and the admin (TypeScript, compiled by Next) run the SAME code. A
 * second TypeScript copy would be two implementations of the one function that
 * decides which strings are translatable, and those drifting apart is precisely
 * how Arabic text goes missing.
 */

/** Marks a slot in `shared` whose value lives in `localized`. */
export declare const L10N: string;

export declare const LOCALIZED_KEYS: Set<string>;
export declare const SHARED_OVERRIDES: Set<string>;
export declare const SHARED_KEYS: Set<string>;

/** Anything JSON-representable. */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/**
 * Split props into a locale-free half and a copy half.
 *
 * `shared` keeps the FULL shape and key order of the input with localized leaves
 * replaced by {@link L10N}, which is what makes reassembly byte-identical.
 */
export declare function splitProps(
  value: Json,
  key?: string | null,
  parentKey?: string | null
): { shared: Json; localized: Json };

/** The exact inverse of {@link splitProps}. */
export declare function mergeProps(shared: Json, localized: Json): Json;
