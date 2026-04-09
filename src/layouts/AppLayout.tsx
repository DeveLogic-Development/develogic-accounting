import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { mobileNav, sidebarNav } from '@/app/navigation';
import { IconButton } from '@/design-system/primitives/IconButton';
import { Input } from '@/design-system/primitives/Input';
import { ToastPlaceholder } from '@/design-system/patterns/ToastPlaceholder';

function breadcrumbsFromPath(pathname: string): string[] {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return ['dashboard'];
  return parts;
}

function toTitleCase(value: string): string {
  return value
    .replace(/-/g, ' ')
    .replace(/pdf/g, 'PDF')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function AppLayout() {
  const location = useLocation();
  const crumbs = breadcrumbsFromPath(location.pathname);

  return (
    <div className="dl-layout">
      <aside className="dl-sidebar" aria-label="Primary navigation">
        <div className="dl-brand">
          <span className="dl-brand-title">DeveLogic Accounting</span>
          <span className="dl-brand-subtitle">DeveLogic Digital</span>
        </div>

        {sidebarNav.map((group) => (
          <nav key={group.label} className="dl-nav-group" aria-label={group.label}>
            <div className="dl-nav-group-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `dl-nav-link ${isActive ? 'active' : ''}`}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        ))}
      </aside>

      <div className="dl-main">
        <header className="dl-topbar">
          <div className="dl-search">
            <Input placeholder="Search clients, quotes, and invoices (coming soon)" aria-label="Global search" />
          </div>
          <div className="dl-topbar-right">
            <IconButton icon="⟳" label="Sync" />
            <IconButton icon="🔔" label="Notifications" />
            <ToastPlaceholder />
          </div>
        </header>

        <main className="dl-content">
          <nav className="dl-breadcrumbs dl-desktop-only" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb}_${index}`}>
                {index > 0 ? ' / ' : ''}
                {toTitleCase(crumb)}
              </span>
            ))}
          </nav>
          <Outlet />
        </main>
      </div>

      <nav className="dl-bottom-nav" aria-label="Mobile navigation">
        {mobileNav.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span aria-hidden>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
