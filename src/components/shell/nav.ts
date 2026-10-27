import { AlertTriangle, BarChart3, Building2, ClipboardCheck, FileText, LayoutDashboard, ScrollText, Settings, Timer } from 'lucide-react';
import type { RoleId } from '@/lib/types';

export const NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/cases', label: 'Case Register', icon: FileText },
  { href: '/needs-confirmation', label: 'Needs confirmation', icon: ClipboardCheck, badge: 'queue' as const, sub: true },
  { href: '/overlaps', label: 'Overlap Alerts', icon: AlertTriangle, badge: 'overlaps' as const },
  { href: '/institutions', label: 'Institutions', icon: Building2 },
  { href: '/sla', label: 'SLA & Escalations', icon: Timer },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/audit', label: 'Audit Log', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export const PAGE_TITLES: [string, string][] = [
  ['/overview', 'National Overview'],
  ['/cases/', 'Case Detail'],
  ['/cases', 'Case Register'],
  ['/needs-confirmation', 'Needs Confirmation'],
  ['/overlaps/', 'Case Cluster'],
  ['/overlaps', 'Overlap Alerts'],
  ['/institutions/', 'Institution Profile'],
  ['/institutions', 'Institutions'],
  ['/sla', 'SLA & Escalations'],
  ['/reports', 'Reports'],
  ['/audit', 'Audit Log'],
  ['/settings', 'Settings'],
];

export function titleFor(path: string) {
  return PAGE_TITLES.find(([p]) => path.startsWith(p))?.[1] ?? 'Samanvay';
}

export function homeFor(role: RoleId) {
  if (role === 'SENIOR') return '/overview';
  if (role === 'ADMIN') return '/overview';
  return '/cases';
}

