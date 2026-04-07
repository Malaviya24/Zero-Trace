import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { useReducedMotion } from "framer-motion";
import { forwardRef, useMemo, useState, type ComponentProps, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const siteButtonVariants = cva(
  "site-focus inline-flex items-center justify-center gap-3 border-2 border-border text-center text-[0.72rem] font-bold uppercase tracking-[0.18em] transition duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground hover:scale-[1.03] active:scale-[0.98] hover:border-accent",
        outline:
          "bg-transparent text-foreground hover:bg-foreground hover:text-black",
        ghost:
          "border-transparent bg-transparent text-foreground hover:text-accent",
      },
      size: {
        sm: "min-h-10 px-3.5 py-2 text-[0.64rem] tracking-[0.16em] sm:px-4 md:text-[0.72rem]",
        default: "min-h-11 px-4 py-3 text-[0.68rem] sm:min-h-12 sm:px-5 md:min-h-14 md:px-8",
        lg: "min-h-12 px-5 py-3.5 text-[0.76rem] sm:min-h-14 sm:px-6 sm:text-sm md:min-h-20 md:px-10 md:text-base",
        icon: "size-11 px-0 md:size-14",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export function SiteButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof siteButtonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(siteButtonVariants({ variant, size, className }))} {...props} />;
}

export function SitePanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("site-panel border-2 border-border bg-background", className)} {...props} />;
}

export function SiteBadge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border border-border px-3 py-1 text-[0.64rem] font-bold uppercase tracking-[0.22em] text-muted-foreground md:text-[0.7rem] md:tracking-[0.24em]",
        className
      )}
      {...props}
    />
  );
}

interface SiteAvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback: ReactNode;
  imageClassName?: string;
  fallbackClassName?: string;
}

export function SiteAvatar({
  src,
  alt,
  fallback,
  className,
  imageClassName,
  fallbackClassName,
  ...props
}: SiteAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const shouldShowImage = useMemo(() => Boolean(src && !imageFailed), [imageFailed, src]);

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden border-2 border-border bg-muted", className)}
      {...props}
    >
      {shouldShowImage ? (
        <img
          src={src}
          alt={alt || ""}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-muted text-sm font-bold uppercase tracking-[0.16em] text-accent",
            fallbackClassName
          )}
          aria-hidden={alt ? undefined : true}
        >
          {fallback}
        </div>
      )}
    </div>
  );
}

interface SiteSectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function SiteSectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SiteSectionHeadingProps) {
  return (
    <div className={cn("space-y-2.5 sm:space-y-3 md:space-y-4", align === "center" ? "text-center" : "text-left", className)}>
      {eyebrow ? <p className="site-kicker text-accent">{eyebrow}</p> : null}
      <div className="site-heading">{title}</div>
      {description ? (
        <p className={cn("site-copy max-w-2xl text-muted-foreground", align === "center" ? "mx-auto" : undefined)}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

interface SiteInputProps extends ComponentProps<"input"> {
  displayUppercase?: boolean;
}

export const SiteInput = forwardRef<HTMLInputElement, SiteInputProps>(function SiteInput(
  { className, displayUppercase = true, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "site-focus h-14 w-full border-b-2 border-border bg-transparent px-0 text-base font-bold tracking-tight text-foreground placeholder:text-muted placeholder:uppercase placeholder:tracking-[0.12em] focus:border-accent focus:outline-none sm:h-16 sm:text-lg md:h-20 md:text-2xl md:placeholder:tracking-[0.16em]",
        displayUppercase ? "uppercase" : undefined,
        className
      )}
      {...props}
    />
  );
});

interface SiteTextareaProps extends ComponentProps<"textarea"> {
  displayUppercase?: boolean;
}

export const SiteTextarea = forwardRef<HTMLTextAreaElement, SiteTextareaProps>(function SiteTextarea(
  { className, displayUppercase = false, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "site-focus min-h-28 w-full border-b-2 border-border bg-transparent px-0 py-4 text-base font-medium tracking-tight text-foreground placeholder:text-muted placeholder:uppercase placeholder:tracking-[0.12em] focus:border-accent focus:outline-none sm:min-h-32 sm:text-lg md:min-h-40 md:text-xl md:placeholder:tracking-[0.16em]",
        displayUppercase ? "uppercase" : undefined,
        className
      )}
      {...props}
    />
  );
});

interface SiteSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  label?: string;
}

export function SiteSwitch({ checked, onCheckedChange, className, label }: SiteSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "site-focus inline-flex h-10 w-22 items-center justify-between border-2 border-border px-3 text-[0.64rem] font-bold uppercase tracking-[0.16em] transition-colors sm:h-11 sm:w-24 sm:text-[0.68rem] md:h-12 md:w-28 md:text-xs md:tracking-[0.18em]",
        checked ? "bg-accent text-black" : "bg-background text-muted-foreground",
        className
      )}
    >
      <span>{checked ? "On" : "Off"}</span>
      <span
        aria-hidden="true"
        className={cn("h-4 w-4 border border-current transition-transform md:h-5 md:w-5", checked ? "bg-black" : "bg-muted")}
      />
    </button>
  );
}

interface SiteMarqueeProps {
  items: ReactNode[];
  speed?: "fast" | "medium" | "slow";
  inverted?: boolean;
  className?: string;
}

const speedMap = {
  fast: "26s",
  medium: "38s",
  slow: "54s",
} satisfies Record<NonNullable<SiteMarqueeProps["speed"]>, string>;

export function SiteMarquee({
  items,
  speed = "medium",
  inverted = false,
  className,
}: SiteMarqueeProps) {
  const reduceMotion = useReducedMotion();

  const content = items.map((item, index) => (
    <div key={`${speed}-${index}`} className="site-marquee-item">
      {item}
    </div>
  ));

  if (reduceMotion) {
    return (
      <div
        className={cn(
          "flex flex-wrap gap-px border-y-2 border-border",
          inverted ? "bg-accent text-black" : "bg-background text-foreground",
          className
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "site-marquee border-y-2 border-border",
        inverted ? "bg-accent text-black" : "bg-background text-foreground",
        className
      )}
    >
      <div className="site-marquee-track" style={{ ["--site-marquee-duration" as string]: speedMap[speed] }}>
        {content}
        {content.map((item, index) => (
          <div key={`clone-${speed}-${index}`} className="site-marquee-item" aria-hidden="true">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
