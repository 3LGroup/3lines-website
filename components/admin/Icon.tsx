/**
 * The admin's icon set.
 *
 * Hand-inlined rather than a dependency. `lucide-react` would be ~1,500 icons
 * and a package to keep current for the eight glyphs this uses, and the public
 * layout already inlines its one SVG the same way (app/[locale]/layout.tsx).
 * Paths are from Lucide (ISC licence), redrawn on the same 24-unit grid and
 * stroke weight so they read as one family.
 *
 * Consistency here is load-bearing: mixed stroke weights or grid sizes are one
 * of the fastest ways an interface starts looking assembled rather than
 * designed.
 */

const PATHS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  pages: 'M4 3h10l6 6v12H4zM14 3v6h6',
  companies: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01',
  services: 'M12 2l2.4 5.2 5.6.7-4.2 3.9 1.1 5.6L12 14.8l-4.9 2.6 1.1-5.6L4 7.9l5.6-.7z',
  news: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',
  media: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6M8.5 9.5h.01',
  /* Partners had to borrow `media`, which left the two sidebar entries that
     mean the least alike wearing the same glyph. Two figures: the section is
     about who the company works with, not about the logo files. */
  partners: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H1a2 2 0 110-4h.1A1.6 1.6 0 002.6 7a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H7a1.6 1.6 0 001-1.5V1a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V7a1.6 1.6 0 001.5 1H23a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  theme: 'M12 3a9 9 0 109 9 7 7 0 01-9-9z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  check: 'M20 6L9 17l-5-5',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
  /* Lucide trash-2, on the same 24 grid and stroke weight as the rest. */
  trash: 'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6',
} as const;

export type IconName = keyof typeof PATHS;

/**
 * `size` is applied as width/height attributes, and defaults.
 *
 * An <svg> with only a viewBox has no intrinsic size, so it stretches to its
 * container — in a flex row that means it eats whatever space is going. The
 * first version of this relied on a `.adm-x svg { inline-size: … }` rule per
 * context, which worked everywhere a rule existed and rendered a 250px padlock
 * in the one place it did not. Sizing here means the component is correct on its
 * own and CSS only overrides it.
 */
export default function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flex: 'none' }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
