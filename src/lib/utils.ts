import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceStrict } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmtDate = (iso?: string) => (iso ? format(new Date(iso), 'dd MMM yyyy') : '—');
export const fmtDateShort = (iso?: string) => (iso ? format(new Date(iso), 'dd MMM') : '—');
export const fmtDateTime = (iso?: string) => (iso ? format(new Date(iso), 'dd MMM yyyy, HH:mm') : '—');
export const fmtAgo = (iso: string, now: Date) => `${formatDistanceStrict(new Date(iso), now)} ago`;

export function slaText(daysLeft: number, disposed: boolean): string {
  if (disposed) return 'Closed';
  if (daysLeft < 0) return `+${-daysLeft} d overdue`;
  if (daysLeft === 0) return 'Due today';
  return `${daysLeft} d left`;
}

export function slaTone(daysLeft: number, disposed: boolean): 'red' | 'amber' | 'green' | 'muted' {
  if (disposed) return 'muted';
  if (daysLeft < 0) return 'red';
  if (daysLeft <= 5) return 'amber';
  return 'green';
}

export const caseHref = (id: string) => `/cases/${encodeURIComponent(id)}`;
export const instHref = (id: string) => `/institutions/${encodeURIComponent(id)}`;

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
