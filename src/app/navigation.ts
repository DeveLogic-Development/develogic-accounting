export interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const sidebarNav: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: '▦' },
      { to: '/reports', label: 'Reports', icon: '◷' },
      { to: '/clients', label: 'Customers', icon: '◎' },
      { to: '/products-services', label: 'Products & Services', icon: '◫' },
      { to: '/quotes', label: 'Quotes', icon: '✦' },
      { to: '/invoices', label: 'Invoices', icon: '◩' },
    ],
  },
  {
    label: 'Documents',
    items: [
      { to: '/templates', label: 'Templates', icon: '◧' },
      { to: '/notifications', label: 'Notifications', icon: '🔔' },
      { to: '/emails/history', label: 'Email History', icon: '✉' },
      { to: '/pdf-archive', label: 'PDF Archive', icon: '⬒' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/settings/business', label: 'Business Settings', icon: '◰' },
      { to: '/settings/tax', label: 'Tax & Numbering', icon: '⚙️' },
    ],
  },
];

export const mobileNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/reports', label: 'Reports', icon: '◷' },
  { to: '/clients', label: 'Clients', icon: '◎' },
  { to: '/quotes', label: 'Quotes', icon: '✦' },
  { to: '/invoices', label: 'Invoices', icon: '◩' },
  { to: '/templates', label: 'Templates', icon: '⋯' },
];
