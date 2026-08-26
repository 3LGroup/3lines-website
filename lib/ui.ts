import type { Locale } from './blocks';
import { getUiStrings } from './content';

/**
 * Authored UI micro-copy.
 *
 * Every string with a CMS home arrives as data — that is the whole point of the
 * content pipeline. These are the chrome strings the source never carried in
 * *either* language: the mega menu's close button, the theme toggle, the 404
 * page, and a handful of aria labels invented by the clone.
 *
 * They are CMS-owned now: the ui_strings table is edited under "Interface
 * text" and exported to content/{locale}/ui.json, which is overlaid onto the
 * literals below at render. The literals stay as the fallback for a content
 * tree that predates a given key — a missing translation degrades to the
 * shipped wording, never to a blank button.
 */
export interface UiStrings {
  /** aria-label on the burger that opens the mega menu. */
  openMenu: string;
  /** aria-label on the mega menu dialog itself. */
  mainMenu: string;
  /** Visible label on the mega menu's close button. */
  close: string;
  /** aria-label on the breadcrumb nav landmark. */
  breadcrumb: string;
  /** aria-label on the colour-scheme toggle. */
  themeToggle: string;
  /** Visible toggle label offering the dark theme. */
  themeDark: string;
  /** Visible toggle label offering the light theme. */
  themeLight: string;
  /** Label for the contact form's honeypot field. */
  honeypot: string;
  /** Visible call-to-action on tile cards. */
  discover: string;
  /** 404 page heading. */
  notFoundTitle: string;
  /** 404 page explanation line. */
  notFoundBody: string;
  /** 404 page lead-in above the suggested links. */
  notFoundBrowse: string;
  /** Accessible name of the WhatsApp item the social strip derives from Site info. */
  whatsapp: string;
}

const FALLBACK: Record<Locale, UiStrings> = {
  en: {
    openMenu: 'Open main menu',
    mainMenu: 'Main menu',
    close: 'Close',
    breadcrumb: 'Breadcrumb',
    themeToggle: 'Toggle colour scheme',
    themeDark: 'Dark',
    themeLight: 'Light',
    honeypot: 'Leave this field empty',
    discover: 'Discover',
    notFoundTitle: 'This page could not be found.',
    notFoundBody: 'The address may be out of date, or the page may have moved.',
    notFoundBrowse: 'Try one of these pages:',
    whatsapp: 'WhatsApp',
  },
  ar: {
    openMenu: 'فتح القائمة الرئيسية',
    mainMenu: 'القائمة الرئيسية',
    close: 'إغلاق',
    breadcrumb: 'مسار التنقل',
    themeToggle: 'تبديل نمط الألوان',
    themeDark: 'داكن',
    themeLight: 'فاتح',
    honeypot: 'اترك هذا الحقل فارغًا',
    discover: 'اكتشف',
    notFoundTitle: 'تعذر العثور على هذه الصفحة.',
    notFoundBody: 'قد يكون العنوان قديمًا، أو ربما تم نقل الصفحة.',
    notFoundBrowse: 'جرّب إحدى هذه الصفحات:',
    whatsapp: 'واتساب',
  },
};

export function ui(locale: Locale): UiStrings {
  const stored = getUiStrings(locale);
  const out = { ...FALLBACK[locale] };
  for (const key of Object.keys(out) as (keyof UiStrings)[]) {
    const v = stored[key];
    if (typeof v === 'string' && v.trim()) out[key] = v;
  }
  return out;
}
