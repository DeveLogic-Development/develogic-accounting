export interface NavItem {
  to: string;
  label: string;
  icon?: string;
  children?: NavItem[];
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
      { to: '/items', label: 'Items', icon: '◫' },
      { to: '/quotes', label: 'Quotes', icon: '✦' },
      {
        to: '/invoices',
        label: 'Invoices',
        icon: '◩',
        children: [
          { to: '/invoices/recurring', label: 'Recurring Invoices', icon: '↻' },
          { to: '/invoices/payment-submissions', label: 'Payment Submissions', icon: '⌁' },
        ],
      },
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
  { to: '/clients', label: 'Clients', icon: '◎' },
  { to: '/quotes', label: 'Quotes', icon: '✦' },
  { to: '/invoices', label: 'Invoices', icon: '◩' },
];

export const mobileMoreNav: NavItem[] = [
  { to: '/items', label: 'Items', icon: '◫' },
  { to: '/reports', label: 'Reports', icon: '◷' },
  { to: '/invoices/recurring', label: 'Recurring Invoices', icon: '↻' },
  { to: '/invoices/payment-submissions', label: 'Payment Submissions', icon: '⌁' },
  { to: '/templates', label: 'Templates', icon: '◧' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/emails/history', label: 'Email History', icon: '✉' },
  { to: '/pdf-archive', label: 'PDF Archive', icon: '⬒' },
  { to: '/settings/business', label: 'Business Settings', icon: '◰' },
  { to: '/settings/tax', label: 'Tax & Numbering', icon: '⚙️' },
];
