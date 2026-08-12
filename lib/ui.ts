import type { Locale } from './blocks';

/**
 * Authored UI micro-copy.
 *
 * Every string with a CMS home arrives as data — that is the whole point of the
 * content pipeline. These are the few chrome strings the source never carried in
 * *either* language: the mega menu's close button, the theme toggle, and a
 * handful of aria labels invented by the clone.
 *
 * They used to be hardcoded English literals in the components, which meant the
 * Arabic site rendered a Latin "Close" inside its RTL header, a "Dark" theme
 * button, and English aria labels on every landmark. Anything authored rather
 * than lifted belongs here, in one table, in both languages — so the next person
 * adding chrome copy has an obvious place to put it and no excuse to inline it.
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
}

export const UI: Record<Locale, UiStrings> = {
  en: {
    openMenu: 'Open main menu',
    mainMenu: 'Main menu',
    close: 'Close',
    breadcrumb: 'Breadcrumb',
    themeToggle: 'Toggle colour scheme',
    themeDark: 'Dark',
    themeLight: 'Light',
    honeypot: 'Leave this field empty',
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
  },
};

export const ui = (locale: Locale): UiStrings => UI[locale];
