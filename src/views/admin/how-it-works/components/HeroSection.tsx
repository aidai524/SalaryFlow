import { ShieldCheck, User } from "lucide-react";
import { IconLock } from "@/components/icons/lock";
import { CARD_CLASS, HERO } from "../config";

function WalletNode({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex size-14 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm">
        <User className="size-6 text-[#606060]" strokeWidth={1.75} />
      </div>
      <p className="font-montserrat text-[13px] font-semibold text-black text-center">{label}</p>
    </div>
  );
}

function DashedArrow() {
  return (
    <div
      className="hidden h-px w-10 shrink-0 border-t border-dashed border-black/25 sm:block md:w-14"
      aria-hidden
    />
  );
}

export function HeroSection() {
  return (
    <section className={`grid gap-8 p-5 sm:p-8 lg:grid-cols-2 lg:items-center lg:gap-10 ${CARD_CLASS}`}>
      <div>
        <h1 className="font-montserrat text-[26px] font-bold leading-tight text-black sm:text-[32px]">
          {HERO.TITLE}
        </h1>
        <p className="mt-3 font-montserrat text-[15px] font-semibold text-black sm:text-[16px]">
          {HERO.TAGLINE}
        </p>
        <p className="mt-4 font-montserrat text-[14px] leading-relaxed text-[#606060]">
          {HERO.BODY_1}
        </p>
        <p className="mt-3 font-montserrat text-[14px] leading-relaxed text-[#606060]">
          {HERO.BODY_2}
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#d0f348] px-3.5 py-1.5">
          <ShieldCheck className="size-4 text-black" strokeWidth={2} />
          <span className="font-montserrat text-[12px] font-semibold text-black">
            {HERO.BADGE}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 rounded-[16px] bg-[#f6f6f6] px-4 py-8 sm:px-6">
        <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-3">
          <WalletNode label={HERO.FLOW.FROM} />
          <DashedArrow />
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-[#d0f348] shadow-sm">
              <IconLock className="size-5 text-black" />
            </div>
            <p className="font-montserrat text-[13px] font-semibold text-black text-center">
              {HERO.FLOW.MIDDLE}
            </p>
          </div>
          <DashedArrow />
          <WalletNode label={HERO.FLOW.TO} />
        </div>
        <p className="max-w-[280px] text-center font-montserrat text-[12px] leading-relaxed text-[#606060]">
          {HERO.FLOW.NOTE}
        </p>
      </div>
    </section>
  );
}
