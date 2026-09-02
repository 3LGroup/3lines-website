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
  /** aria-label on the header button that opens the search overlay. */
  openSearch: string;
  /** Placeholder inside the search overlay's input. */
  searchPlaceholder: string;
  /** Shown when a query matches no page. Takes no argument — the query is
      already on screen in the input directly above it. */
  searchNoResults: string;
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
    openSearch: 'Search this site',
    searchPlaceholder: 'Search pages…',
    searchNoResults: 'No pages match that search.',
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
    openSearch: 'ابحث في الموقع',
    searchPlaceholder: 'ابحث في الصفحات…',
    searchNoResults: 'لا توجد صفحات تطابق هذا البحث.',
  },
  ja: {
    openMenu: 'メインメニューを開く',
    mainMenu: 'メインメニュー',
    close: '閉じる',
    breadcrumb: 'パンくずリスト',
    themeToggle: 'カラーテーマを切り替える',
    themeDark: 'ダーク',
    themeLight: 'ライト',
    honeypot: 'この欄は空のままにしてください',
    discover: '詳しく見る',
    notFoundTitle: 'ページが見つかりませんでした。',
    notFoundBody: 'アドレスが古いか、ページが移動した可能性があります。',
    notFoundBrowse: '次のページをお試しください：',
    whatsapp: 'WhatsApp',
    openSearch: 'サイト内検索',
    searchPlaceholder: 'ページを検索…',
    searchNoResults: '該当するページはありません。',
  },
  ko: {
    openMenu: '메인 메뉴 열기',
    mainMenu: '메인 메뉴',
    close: '닫기',
    breadcrumb: '탐색 경로',
    themeToggle: '색상 테마 전환',
    themeDark: '다크',
    themeLight: '라이트',
    honeypot: '이 칸은 비워 두세요',
    discover: '자세히 보기',
    notFoundTitle: '페이지를 찾을 수 없습니다.',
    notFoundBody: '주소가 오래되었거나 페이지가 이동했을 수 있습니다.',
    notFoundBrowse: '다음 페이지를 이용해 보세요:',
    whatsapp: 'WhatsApp',
    openSearch: '사이트 검색',
    searchPlaceholder: '페이지 검색…',
    searchNoResults: '검색과 일치하는 페이지가 없습니다.',
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
