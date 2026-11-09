import { siteHref, type Page } from '../lib/routes';

// The site menu across the top of every page: the states page, each state, and About.
const ITEMS: Array<{ page: Page; path: string; label: string; draft?: boolean }> = [
  { page: 'home', path: '/', label: 'All states' },
  { page: 'ca', path: '/ca', label: 'California' },
  { page: 'co', path: '/co', label: 'Colorado', draft: true },
  { page: 'wy', path: '/wy', label: 'Wyoming', draft: true },
  { page: 'about', path: '/about', label: 'About' }
];

export const SITE_NAV_HEIGHT = 'h-10';

export function SiteNav({ current }: { current: Page }) {
  return (
    <nav className={`${SITE_NAV_HEIGHT} border-b border-line bg-panel`} aria-label="Site">
      <ul className="mx-auto flex h-full items-center gap-x-4 overflow-x-auto whitespace-nowrap px-3 text-xs sm:gap-x-6 sm:px-5 sm:text-sm">
        {ITEMS.map((item) => {
          const active = item.page === current;
          return (
            <li key={item.page} className="h-full">
              <a
                href={siteHref(item.path)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full items-center gap-1 border-b-2 font-semibold transition ${
                  active ? 'border-accent text-slate-50' : 'border-transparent text-slate-400 hover:text-accent'
                }`}
              >
                {item.label}
                {item.draft && <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-amber sm:inline">draft</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
