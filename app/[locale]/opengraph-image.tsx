import { ImageResponse } from 'next/og';
import { LOCALES } from '@/lib/i18n';
import { getPage } from '@/lib/content';
import { siteName } from '@/lib/seo';

/**
 * Share card.
 *
 * Links to this site previously unfurled bare — no image — anywhere a preview is
 * rendered, which for a defence contractor whose traffic arrives through
 * LinkedIn is most of the first impression.
 *
 * Drawn rather than photographed, for two reasons: there is no 1200x630 asset in
 * the repo to crop without wrecking the composition, and a generated card stays
 * correct when the brand palette moves, since it reads the same tokens the site
 * does. Both locales share one Latin card on purpose — Satori needs an embedded
 * font per script, and the Arabic face here is shipped as .woff2, which it
 * cannot parse. The company name is Latin in both trees anyway.
 */

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
/* The English name deliberately: the card itself is Latin-only (see below). */
export const alt = siteName('en');

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/* The one place the band colour is not tokenised — Satori cannot read the
   stylesheet, so these are kept in step with --navy in style.css by hand. Both
   stops sit in the logo's blue family: the deep band colour ramping to the mark's
   own #2271AA. The old pair ran #00005C -> #0816A1, two Thales colours unrelated
   to the logo and to each other. */
const NAVY = '#123E5E';
const LOGO_BLUE = '#2271AA';
const CYAN = '#87EDFF';

/** Cut at a word boundary and strip the punctuation the cut left dangling. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s.,;:—-]+$/, '')}…`;
}

export default async function Image() {
  /* Always the English strapline, including on /ar. The card is Latin (see
     above) and Satori cannot shape the Arabic face — feeding it the Arabic
     document's description throws
     "lookupType: 5 - substFormat: 3 is not yet supported" and the route 500s,
     which is a broken image on every Arabic share rather than a fallback. */
  const tagline = clamp(getPage('en', '/')?.description ?? '', 160);

  /* Brand lines from Site info: "3Lines Advanced Technologies" renders as a
     bold first word over the cyan remainder — the same split the reference
     lockup draws. Editing the site name in the CMS re-draws every share card. */
  const [brandFirst, ...brandRest] = siteName('en').split(' ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: `linear-gradient(135deg, ${NAVY} 0%, ${LOGO_BLUE} 100%)`,
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Three lines. The mark is the name. */}
        <div style={{ display: 'flex', gap: '18px' }}>
          {[220, 150, 90].map((w) => (
            <div key={w} style={{ width: w, height: 10, background: CYAN, borderRadius: 5 }} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 82, fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            {brandFirst}
          </div>
          <div style={{ fontSize: 44, fontWeight: 400, color: CYAN, marginTop: 8 }}>
            {brandRest.join(' ')}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 26,
            lineHeight: 1.4,
            color: 'rgba(255,255,255,0.82)',
            maxWidth: 900,
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    size
  );
}
