import { ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router";

import { SiteButton } from "@/components/site/SitePrimitives";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[95vw] items-center px-4 py-8 sm:py-10 md:px-8 md:py-14">
      <div className="grid w-full gap-px bg-border lg:grid-cols-[0.78fr_1.22fr]">
        <div className="flex items-center justify-center bg-accent p-6 text-black sm:p-8 md:p-12">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] sm:text-xs sm:tracking-[0.32em]">Signal lost</p>
            <p className="mt-4 text-[clamp(4.2rem,18vw,14rem)] font-bold leading-none tracking-[-0.12em]">404</p>
          </div>
        </div>
        <div className="bg-background p-6 sm:p-8 md:p-12 lg:p-16">
          <p className="site-kicker text-accent">Route missing</p>
          <h1 className="mt-4 text-[clamp(2.6rem,11vw,8rem)] font-bold uppercase leading-[0.82] tracking-[-0.08em]">
            The page burned out before you reached it.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg md:text-2xl">
            The route you requested does not exist here anymore. Head back to the public entry or return to the last surface you trusted.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <SiteButton size="lg" onClick={() => navigate("/")} className="w-full sm:w-auto">
              <Home className="h-5 w-5" />
              Back to home
            </SiteButton>
            <SiteButton variant="outline" size="lg" onClick={() => navigate(-1)} className="w-full sm:w-auto">
              <ArrowLeft className="h-5 w-5" />
              Go back
            </SiteButton>
          </div>
        </div>
      </div>
    </div>
  );
}
