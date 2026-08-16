'use client';

import { usePathname } from 'next/navigation';
import Icon, { type IconName } from './Icon';

/**
 * A nav link that knows whether it is the current one.
 *
 * Client-side because a server layout has no access to the pathname, and
 * `aria-current` cannot be guessed: with it hardcoded, every live link claimed
 * to be the current page at once, which is worse than omitting it — a screen
 * reader announces two destinations as "current" and the highlight lies.
 *
 * Matching is prefix-based below the root so /admin/pages/en--about still
 * highlights Pages, but /admin itself matches exactly or it would light up
 * everywhere.
 */
export default function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: IconName;
}) {
  const pathname = usePathname();
  const current = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <a className="adm-nav__item" href={href} aria-current={current ? 'page' : undefined}>
      <Icon name={icon} />
      {label}
    </a>
  );
}
