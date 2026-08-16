/**
 * Which props are localized and which are structural.
 *
 * This split is the whole migration. Get it wrong in one direction and Arabic
 * text lands in a shared column where it can never be translated; wrong in the
 * other and a structural value like `columns` becomes per-locale, which is
 * exactly how the two trees drift apart.
 *
 * Classification is by KEY NAME rather than by full path, because in this schema
 * a given key means the same thing wherever it appears — `label` is always a
 * localized caption, `href` is always a locale-less route id. The exceptions are
 * enumerated below rather than hidden in a heuristic.
 *
 * IMPORTANT: none of this is trusted. `splitProps` is paired with `mergeProps`,
 * and the importer asserts that merging the two halves reproduces the original
 * object exactly, per locale, for all 184 blocks. A misclassification is a hard
 * failure that names the path, not a silent content change.
 */

/**
 * Keys whose values are human-readable copy.
 *
 * Derived from a parallel EN/AR walk of content/: every key whose value differs
 * between locales in at least one instance, plus keys that are conceptually copy
 * even where the two happen to match today (media alt text, company names) —
 * because "identical" and "not translatable" are different claims, and 185
 * strings currently match. Treating a matching value as structural would make
 * it permanently untranslatable.
 */
export const LOCALIZED_KEYS = new Set([
  // page level
  'title',
  'description',
  'keywords',
  // headings and copy
  'heading',
  'headingLines',
  'kicker',
  'lede',
  'body',
  'text',
  'sub',
  'tagline',
  'caption',
  'label',
  'rotate',
  'note',
  // lists
  'glance',
  'glanceTitle',
  'paragraphs',
  'items',
  'checklist',
  'crumbs',
  'meta',
  // media
  'alt',
  // map
  'placeName',
  'address',
  'ctaLabel',
  // form
  'submit',
  'placeholder',
  // entity descriptors that read as copy
  'name',
  'type',
  'country',
  'status',

  /*
   * Leaves reached by descending THROUGH a localized container.
   *
   * `meta` and `status` are in this set already, but they hold objects rather
   * than scalars, so the walk descends into them and their inner keys are
   * classified on their own. Without these four entries the Arabic
   * "30 مارس 2029" (defs meta value) and the four Arabic form status messages
   * were classified structural — locale-varying copy frozen into a column that
   * has no locale. Both were caught by asserting that the shared half of EN
   * deep-equals the shared half of AR, which is the only check that
   * distinguishes a lossless split from a useful one.
   */
  'value', // DefCard.meta[].value
  'sending', // FormBody.status.*
  'ok',
  'bad',
  'err',
]);

/**
 * Paths where the key-name rule is wrong, as `parentKey.key`.
 *
 * `fields[].name` and `fields[].type` are a form field's identifier and input
 * type — renaming either breaks app/api/contact/route.ts, which hardcodes
 * name/email/message. `status` on a FormBody is the localized status-message
 * object, but on a form field it is not present at all; the collision is with
 * CompanyCard.status ("Soon!"), which IS localized.
 */
export const SHARED_OVERRIDES = new Set([
  'fields.name',
  'fields.type',
  'fields.required',
  'fields.placeholder_shared', // not real; placeholder here is localized
]);

/** Keys that are always structural, listed for documentation as much as logic. */
export const SHARED_KEYS = new Set([
  'kind',
  'tone',
  'layout',
  'columns',
  'variant',
  'limit',
  'total',
  'href',
  'src',
  'invert',
  'imgVar',
  'art',
  'icon',
  'network',
  'flag',
  'external',
  'count',
  'prefix',
  'suffix',
  'lat',
  'lng',
  'zoom',
  'action',
  'honeypot',
  'id',
  'required',
]);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Marks a slot in `shared` whose value lives in `localized`.
 *
 * `shared` deliberately keeps the FULL shape and key order of the original,
 * with localized leaves replaced by this sentinel. That is what makes the export
 * byte-identical: JSON.stringify follows insertion order, so reconstructing from
 * two disjoint objects would emit `{tone, bodies, type}` where the source had
 * `{type, tone, bodies}` — 286 of 368 blocks differed on exactly that and
 * nothing else.
 *
 * A sentinel rather than null, because null is a legitimate stored value here:
 * `art` and `icon` are `SvgNode | null` and are null at all 318 sites in the
 * shipped content. Using null as the marker would make "no artwork" and "text
 * lives elsewhere" indistinguishable.
 */
export const L10N = '\u0000__l10n__';

/**
 * Split one props object into { shared, localized }.
 *
 * Containers are walked rather than classified: an `items` array holds both a
 * localized `title` and a shared `href`, so it is split element-wise and both
 * halves keep the same length and indices.
 */
export function splitProps(value, key = null, parentKey = null) {
  const path = parentKey ? `${parentKey}.${key}` : key;
  const localizedHere = key !== null && LOCALIZED_KEYS.has(key) && !SHARED_OVERRIDES.has(path);

  if (Array.isArray(value)) {
    // An array of scalars under a localized key (glance[], rotate[],
    // headingLines[]) is copy in its entirety.
    if (value.every((v) => !isObj(v) && !Array.isArray(v))) {
      return localizedHere ? { shared: L10N, localized: value } : { shared: value, localized: null };
    }
    const shared = [];
    const localized = [];
    for (const item of value) {
      const r = splitProps(item, key, parentKey);
      shared.push(r.shared);
      localized.push(r.localized);
    }
    return { shared, localized };
  }

  if (isObj(value)) {
    const shared = {};
    const localized = {};
    // Object.entries preserves insertion order, and so does this loop — which is
    // the whole point.
    for (const [k, v] of Object.entries(value)) {
      const r = splitProps(v, k, key);
      shared[k] = r.shared;
      if (r.localized !== null) localized[k] = r.localized;
    }
    return { shared, localized: Object.keys(localized).length ? localized : null };
  }

  return localizedHere ? { shared: L10N, localized: value } : { shared: value, localized: null };
}

/**
 * Reassemble. The exact inverse of splitProps — the importer asserts it over all
 * 368 blocks in both locales and fails naming the path if it ever is not.
 *
 * Iteration is driven by `shared`, so the original key order is restored
 * verbatim.
 */
export function mergeProps(shared, localized) {
  if (shared === L10N) return localized;

  if (Array.isArray(shared)) {
    return shared.map((s, i) => mergeProps(s, Array.isArray(localized) ? localized[i] : null));
  }

  if (isObj(shared)) {
    const out = {};
    for (const k of Object.keys(shared)) {
      out[k] = mergeProps(shared[k], isObj(localized) ? localized[k] : null);
    }
    return out;
  }

  return shared;
}
