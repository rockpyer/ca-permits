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
    <nav className={`${SITE_NAV_HEIGHT} flex items-center border-b border-line bg-panel`} aria-label="Site">
      <a href={siteHref('/')} className="hidden shrink-0 pl-5 pr-2 font-condensed text-lg font-bold leading-none tracking-tight text-accent md:block">
        Weller<span className="text-steel">Tracker</span>
      </a>
      <ul className="flex h-full min-w-0 flex-1 items-center gap-x-4 overflow-x-auto whitespace-nowrap px-3 text-xs sm:gap-x-6 sm:px-5 sm:text-sm">
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
      <a
        href="https://ryweller.com"
        target="_blank"
        rel="noreferrer"
        className="hidden shrink-0 items-center gap-1.5 pr-5 text-[11px] uppercase tracking-[0.16em] text-slate-500 transition hover:text-accent md:flex"
      >
        by <span className="font-semibold text-slate-300">Ryan Weller</span>
      </a>
    </nav>
  );
}
