import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { mobileNav, sidebarNav } from '@/app/navigation';
import { IconButton } from '@/design-system/primitives/IconButton';
import { Input } from '@/design-system/primitives/Input';
import { Button } from '@/design-system/primitives/Button';
import { NotificationsDropdown } from '@/modules/notifications/components/NotificationsDropdown';
import { ToastViewport } from '@/modules/notifications/components/ToastViewport';
import { SystemNotificationSync } from '@/modules/notifications/components/SystemNotificationSync';
import { useBusinessSettings } from '@/modules/settings/hooks/useBusinessSettings';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import type { NavItem } from '@/app/navigation';

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
  const businessSettings = useBusinessSettings();
  const { userEmail, signOut } = useAuth();
  const crumbs = breadcrumbsFromPath(location.pathname);

  const renderSidebarItem = (item: NavItem, isSubItem = false) => (
    <div key={item.to}>
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          `${isSubItem ? 'dl-nav-sublink' : 'dl-nav-link'} ${isActive ? 'active' : ''}`
        }
      >
        {item.icon ? <span aria-hidden>{item.icon}</span> : null}
        <span>{item.label}</span>
      </NavLink>
      {item.children && item.children.length > 0 ? (
        <div className="dl-nav-submenu">{item.children.map((child) => renderSidebarItem(child, true))}</div>
      ) : null}
    </div>
  );

  return (
    <div className="dl-layout">
      <aside className="dl-sidebar" aria-label="Primary navigation">
        <div className="dl-brand">
          {businessSettings.logoDataUrl ? (
            <img className="dl-brand-logo" src={businessSettings.logoDataUrl} alt={`${businessSettings.businessName} logo`} />
          ) : null}
          {/* <span className="dl-brand-title">DeveLogic Accounting</span> */}
          <span className="dl-brand-subtitle">{businessSettings.businessName}</span>
        </div>

        {sidebarNav.map((group) => (
          <nav key={group.label} className="dl-nav-group" aria-label={group.label}>
            <div className="dl-nav-group-label">{group.label}</div>
            {group.items.map((item) => renderSidebarItem(item))}
          </nav>
        ))}
      </aside>

      <div className="dl-main">
        <SystemNotificationSync />
        <header className="dl-topbar">
          <div className="dl-search">
            <Input placeholder="Search clients, quotes, and invoices (coming soon)" aria-label="Global search" />
          </div>
          <div className="dl-topbar-right">
            <span className="dl-muted dl-desktop-only" style={{ fontSize: 12 }}>
              {userEmail}
            </span>
            <IconButton
              icon="⟳"
              label="Refresh App Data"
              onClick={() => window.location.reload()}
            />
            <NotificationsDropdown />
            <Button size="sm" variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
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
      <ToastViewport />
    </div>
  );
}
