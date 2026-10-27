'use client';
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ───────────── Dialog ─────────────
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, title, description, hideClose, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: React.ReactNode; description?: React.ReactNode; hideClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn('fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-line bg-white p-5 shadow-2xl focus:outline-none data-[state=open]:animate-pop-in', className)}
        {...props}
      >
        <DialogPrimitive.Title className="pr-8 text-base font-bold text-navy">{title}</DialogPrimitive.Title>
        {description ? <DialogPrimitive.Description className="mt-1 text-[13px] text-muted">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</DialogPrimitive.Description>}
        <div className="mt-4">{children}</div>
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted hover:bg-bg hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue" aria-label="Close">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ───────────── Sheet (side panel) ─────────────
export const Sheet = DialogPrimitive.Root;
export function SheetContent({ className, children, title, description, width = 'max-w-3xl', ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: React.ReactNode; description?: React.ReactNode; width?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn('fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-bg shadow-2xl focus:outline-none data-[state=open]:animate-slide-in-right', width, className)}
        {...props}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div>
            <DialogPrimitive.Title className="text-base font-bold text-navy">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="mt-0.5 text-xs text-muted">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">Panel</DialogPrimitive.Description>}
          </div>
          <DialogPrimitive.Close className="rounded-md p-1 text-muted hover:bg-bg hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue" aria-label="Close">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ───────────── Select ─────────────
export interface SelectOption { value: string; label: React.ReactNode }

export function Select({ value, onValueChange, options, placeholder, className, ariaLabel, disabled }: { value?: string; onValueChange: (v: string) => void; options: SelectOption[]; placeholder?: string; className?: string; ariaLabel?: string; disabled?: boolean }) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn('inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-white px-3 text-left text-[13px] text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue disabled:opacity-60 data-[placeholder]:text-[#8796AB]', className)}
      >
        <span className="truncate"><SelectPrimitive.Value placeholder={placeholder} /></span>
        <SelectPrimitive.Icon><ChevronDown className="h-4 w-4 opacity-60" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={4} className="z-[90] max-h-[320px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line bg-white shadow-xl animate-in fade-in-0">
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item key={o.value} value={o.value} className="relative flex cursor-pointer select-none items-center rounded py-1.5 pl-7 pr-2 text-[13px] text-navy outline-none data-[highlighted]:bg-bg">
                <SelectPrimitive.ItemIndicator className="absolute left-2"><Check className="h-3.5 w-3.5" /></SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// ───────────── DropdownMenu ─────────────
export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export function DropdownMenuContent({ className, align = 'end', ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content align={align} sideOffset={6} className={cn('z-[70] min-w-[180px] rounded-md border border-line bg-white p-1 shadow-xl animate-in fade-in-0 zoom-in-95', className)} {...props} />
    </DropdownPrimitive.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>) {
  return <DropdownPrimitive.Item className={cn('flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-[13px] text-navy outline-none data-[highlighted]:bg-bg data-[disabled]:opacity-50 [&_svg]:size-4', className)} {...props} />;
}
export const DropdownMenuSeparator = () => <DropdownPrimitive.Separator className="my-1 h-px bg-line" />;
export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return <DropdownPrimitive.Label className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</DropdownPrimitive.Label>;
}
export function DropdownMenuCheckboxItem({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.CheckboxItem>) {
  return (
    <DropdownPrimitive.CheckboxItem className={cn('relative flex cursor-pointer select-none items-center rounded py-1.5 pl-7 pr-2 text-[13px] text-navy outline-none data-[highlighted]:bg-bg', className)} {...props}>
      <DropdownPrimitive.ItemIndicator className="absolute left-2"><Check className="h-3.5 w-3.5" /></DropdownPrimitive.ItemIndicator>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
}
