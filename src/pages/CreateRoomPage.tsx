import CreateRoom from "@/components/CreateRoom";
import { SiteButton } from "@/components/site/SitePrimitives";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export default function CreateRoomPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-[95vw] px-4 py-8 sm:py-10 md:px-8 md:py-14">
      <div className="mb-8 flex flex-col gap-5 border-b-2 border-border pb-8 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-4xl">
          <p className="site-kicker text-accent">Room constructor</p>
          <h1 className="mt-4 text-[clamp(2.6rem,11vw,9rem)] font-bold uppercase leading-[0.82] tracking-[-0.08em]">
            Create the room before the room creates its own gravity.
          </h1>
        </div>
        <SiteButton variant="ghost" size="sm" onClick={() => navigate("/")} className="self-start md:self-auto">
          <ArrowLeft className="h-4 w-4" />
          Back
        </SiteButton>
      </div>
      <CreateRoom />
    </div>
  );
}
