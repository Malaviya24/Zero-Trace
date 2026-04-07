import { Toaster as Sonner, type ToasterProps } from "sonner";

export function SiteToaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      duration={3500}
      visibleToasts={4}
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            "border-2 border-[#3f3f46] rounded-none bg-[#09090b] text-[#fafafa] shadow-none [font-family:Space_Grotesk,_Inter,_sans-serif]",
          title: "text-xs font-bold uppercase tracking-[0.18em]",
          description: "text-sm leading-6 text-[#a1a1aa]",
          actionButton:
            "h-10 rounded-none border-2 border-[#dfe104] bg-[#dfe104] px-4 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-black hover:bg-[#d3d53c]",
          cancelButton:
            "h-10 rounded-none border border-[#3f3f46] bg-transparent px-4 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#fafafa] hover:bg-[#18181b]",
          success: "border-[#dfe104]",
          error: "border-red-500",
          warning: "border-amber-500",
          info: "border-[#3f3f46]",
        },
      }}
      {...props}
    />
  );
}
