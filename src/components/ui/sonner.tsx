import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      richColors
      closeButton
      position="top-right"
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "border shadow-lg rounded-lg ring-1 ring-border/50 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          title: "font-semibold",
          description: "text-sm opacity-90",
          actionButton:
            "h-8 px-3 rounded-md bg-primary text-primary-foreground hover:opacity-90",
          cancelButton:
            "h-8 px-3 rounded-md bg-muted text-foreground hover:opacity-90",

          // Error styling
          error:
            "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-900/20 dark:text-rose-50 dark:border-rose-800",
          // Success styling
          success:
            "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-50 dark:border-emerald-800",
          // Info styling
          info:
            "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-50 dark:border-blue-800",
          // Warning styling
          warning:
            "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-50 dark:border-amber-800",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }