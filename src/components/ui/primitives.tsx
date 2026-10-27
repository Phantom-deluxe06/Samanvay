'use client';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ───────────── Button ─────────────
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand-blue text-white hover:bg-[#155ca3]',
        navy: 'bg-navy text-white hover:bg-navy-2',
        saffron: 'bg-brand-saffron text-navy hover:bg-[#e48d26] font-semibold',
        outline: 'border border-line bg-white text-navy hover:bg-bg',
        ghost: 'text-navy hover:bg-bg',
        danger: 'bg-brand-red text-white hover:bg-[#a53125]',
        link: 'text-brand-blue underline-offset-4 hover:underline px-0 h-auto',
      },
      size: { default: 'h-9 px-3.5', sm: 'h-8 px-2.5 text-xs', lg: 'h-10 px-5', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

// ───────────── Card ─────────────
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-line bg-white', className)} {...props} />;
}
export function CardHeader({ className, title, action, subtitle }: { className?: string; title: React.ReactNode; action?: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-line px-4 py-3', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

// ───────────── Inputs ─────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn('h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-navy placeholder:text-[#8796AB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue disabled:opacity-60', className)}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn('min-h-[80px] w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] text-navy placeholder:text-[#8796AB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn('mb-1 block text-xs font-medium text-navy', className)} {...props} />
));
Label.displayName = 'Label';

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn('peer h-4 w-4 shrink-0 rounded border border-[#9AA9BF] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue data-[state=checked]:border-brand-blue data-[state=checked]:bg-brand-blue data-[state=checked]:text-white data-[state=indeterminate]:bg-brand-blue', className)}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <Check className="h-3 w-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn('inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-[#C3CEDD] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue data-[state=checked]:bg-brand-blue', className)}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root ref={ref} className={cn('relative flex w-full touch-none select-none items-center', className)} {...props}>
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[#D6DFEB]">
      <SliderPrimitive.Range className="absolute h-full bg-brand-blue" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb aria-label="Value" className="block h-4 w-4 rounded-full border-2 border-brand-blue bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue" />
  </SliderPrimitive.Root>
));
Slider.displayName = 'Slider';

// ───────────── Tabs ─────────────
export const Tabs = TabsPrimitive.Root;
export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn('inline-flex flex-wrap items-center gap-1 rounded-lg border border-line bg-white p-1', className)} {...props} />
));
TabsList.displayName = 'TabsList';
export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn('rounded-md px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue data-[state=active]:bg-navy data-[state=active]:text-white', className)}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';
export const TabsContent = TabsPrimitive.Content;

// ───────────── Tooltip ─────────────
export const TooltipProvider = TooltipPrimitive.Provider;
export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="z-[80] max-w-xs rounded-md bg-navy px-2.5 py-1.5 text-xs text-white shadow-lg animate-in fade-in-0 zoom-in-95">
          {content}
          <TooltipPrimitive.Arrow className="fill-navy" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ───────────── Popover ─────────────
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverContent = React.forwardRef<React.ElementRef<typeof PopoverPrimitive.Content>, React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>>(({ className, align = 'end', sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn('z-[70] rounded-card border border-line bg-white shadow-xl outline-none animate-in fade-in-0 zoom-in-95', className)}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = 'PopoverContent';

// ───────────── Skeleton ─────────────
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-[#E1E8F1]', className)} />;
}
