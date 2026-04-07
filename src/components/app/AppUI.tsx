import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import * as RadixAvatar from "@radix-ui/react-avatar";
import * as RadixCollapsible from "@radix-ui/react-collapsible";
import * as RadixDialog from "@radix-ui/react-dialog";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "site-focus inline-flex items-center justify-center gap-2 border-2 border-border text-center text-[0.72rem] font-bold uppercase tracking-[0.18em] transition duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-black hover:border-accent hover:scale-[1.02]",
        outline: "bg-transparent text-foreground hover:bg-foreground hover:text-black",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-muted",
      },
      size: {
        default: "min-h-11 px-4 py-3 text-[0.68rem] sm:min-h-12 sm:px-5 md:min-h-14 md:px-8",
        sm: "min-h-10 px-3.5 py-2 text-[0.64rem] tracking-[0.16em] sm:px-4",
        lg: "min-h-12 px-5 py-3.5 text-[0.76rem] sm:min-h-14 sm:px-6 sm:text-sm md:min-h-16 md:px-10 md:text-base",
        icon: "size-11 px-0 md:size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border border-border px-3 py-1 text-[0.64rem] font-bold uppercase tracking-[0.22em] text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn("border-2 border-border bg-background text-foreground", className)} {...props} />;
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function CardHeader(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn("space-y-2 border-b-2 border-border p-4 sm:p-5 md:p-6", className)} {...props} />;
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function CardContent(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn("p-4 sm:p-5 md:p-6", className)} {...props} />;
});

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(function CardTitle(
  { className, ...props },
  ref
) {
  return <h3 ref={ref} className={cn("text-xl font-bold uppercase tracking-[-0.05em]", className)} {...props} />;
});

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "site-focus h-11 w-full border-b-2 border-border bg-transparent px-0 text-sm font-medium text-foreground placeholder:text-muted focus:border-accent focus:outline-none sm:h-12",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "site-focus min-h-20 w-full border-b-2 border-border bg-transparent px-0 py-3 text-sm font-medium text-foreground placeholder:text-muted focus:border-accent focus:outline-none sm:min-h-24",
        className
      )}
      {...props}
    />
  );
});

export const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function ScrollArea(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn("overflow-y-auto overflow-x-hidden", className)} {...props} />;
});

export const Avatar = React.forwardRef<
  React.ElementRef<typeof RadixAvatar.Root>,
  React.ComponentPropsWithoutRef<typeof RadixAvatar.Root>
>(function Avatar({ className, ...props }, ref) {
  return <RadixAvatar.Root ref={ref} className={cn("relative flex shrink-0 overflow-hidden border-2 border-border bg-muted", className)} {...props} />;
});

export const AvatarImage = React.forwardRef<
  React.ElementRef<typeof RadixAvatar.Image>,
  React.ComponentPropsWithoutRef<typeof RadixAvatar.Image>
>(function AvatarImage({ className, ...props }, ref) {
  return <RadixAvatar.Image ref={ref} className={cn("aspect-square h-full w-full object-cover", className)} {...props} />;
});

export const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof RadixAvatar.Fallback>,
  React.ComponentPropsWithoutRef<typeof RadixAvatar.Fallback>
>(function AvatarFallback({ className, ...props }, ref) {
  return <RadixAvatar.Fallback ref={ref} className={cn("flex h-full w-full items-center justify-center bg-muted text-sm font-bold uppercase tracking-[0.16em] text-accent", className)} {...props} />;
});

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof RadixDialog.Content>) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
      <RadixDialog.Content
        className={cn("fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-1.5rem)] w-[min(94vw,56rem)] -translate-x-1/2 -translate-y-1/2 overflow-auto border-2 border-border bg-background text-foreground", className)}
        {...props}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b-2 border-border p-4 sm:p-5 md:p-6", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse gap-3 border-t-2 border-border p-4 sm:flex-row sm:items-center sm:justify-end sm:p-5 md:p-6", className)} {...props} />;
}

export const DialogTitle = React.forwardRef<React.ElementRef<typeof RadixDialog.Title>, React.ComponentPropsWithoutRef<typeof RadixDialog.Title>>(
  function DialogTitle({ className, ...props }, ref) {
    return <RadixDialog.Title ref={ref} className={cn("text-2xl font-bold uppercase tracking-[-0.05em]", className)} {...props} />;
  }
);

export const Collapsible = RadixCollapsible.Root;
export const CollapsibleTrigger = RadixCollapsible.Trigger;
export const CollapsibleContent = RadixCollapsible.Content;

export const DropdownMenu = RadixDropdownMenu.Root;
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;

export function DropdownMenuContent({ className, sideOffset = 8, ...props }: React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>) {
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        sideOffset={sideOffset}
        className={cn("z-50 min-w-40 border-2 border-border bg-background p-1 text-foreground", className)}
        {...props}
      />
    </RadixDropdownMenu.Portal>
  );
}

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Label>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return <RadixDropdownMenu.Label ref={ref} className={cn("px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-muted-foreground", className)} {...props} />;
});

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Item>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item>
>(function DropdownMenuItem({ className, ...props }, ref) {
  return <RadixDropdownMenu.Item ref={ref} className={cn("flex cursor-pointer items-center px-3 py-3 text-[0.72rem] font-bold uppercase tracking-[0.16em] outline-none transition-colors hover:bg-muted focus:bg-muted", className)} {...props} />;
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <RadixDropdownMenu.Separator ref={ref} className={cn("my-1 h-px bg-border", className)} {...props} />;
});

export const Sheet = RadixDialog.Root;

export function SheetContent({
  className,
  side = "right",
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDialog.Content> & { side?: "right" | "bottom" }) {
  const positionClass =
    side === "bottom"
      ? "left-1/2 top-auto bottom-0 max-h-[85dvh] w-[min(100vw,64rem)] -translate-x-1/2 overflow-auto"
      : "right-0 top-0 h-full w-[min(94vw,28rem)] overflow-auto";

  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
      <RadixDialog.Content
        className={cn("fixed z-50 border-2 border-border bg-background text-foreground", positionClass, className)}
        {...props}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b-2 border-border px-4 py-4", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-xl font-bold uppercase tracking-[-0.04em]", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-2 text-sm text-muted-foreground", className)} {...props} />;
}
