import { ArrowRight, CheckCircle2, FileText, Info, ShieldCheck } from "lucide-react";
import { CARD_CLASS, STEPS } from "../config";

const STEP_ICONS = [FileText, ShieldCheck, CheckCircle2] as const;

export function StepsSection() {
  return (
    <section>
      <h2 className="font-montserrat text-[22px] font-bold text-black sm:text-[26px]">
        {STEPS.TITLE}
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {STEPS.ITEMS.map((step, index) => {
          const Icon = STEP_ICONS[index] ?? FileText;
          const highlighted = index === 1;
          return (
            <div
              key={step.NUM}
              className={`relative flex flex-col p-5 sm:p-6 ${CARD_CLASS} ${
                highlighted ? "ring-1 ring-[#d0f348]" : ""
              }`}
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#d0f348] font-montserrat text-[12px] font-bold text-black">
                  {step.NUM}
                </span>
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#f0f5d0]">
                  <Icon className="size-4 text-[#5a6e10]" strokeWidth={1.75} />
                </span>
              </div>
              <h3 className="font-montserrat text-[15px] font-semibold text-black">
                {step.TITLE}
              </h3>
              <p className="mt-2 font-montserrat text-[13px] leading-relaxed text-[#606060]">
                {step.BODY_1}
              </p>
              <p className="mt-2 font-montserrat text-[13px] leading-relaxed text-[#606060]">
                {step.BODY_2}
              </p>
              {/* <ArrowRight
                className="mt-4 ml-auto size-4 text-[#909090]"
                strokeWidth={1.75}
                aria-hidden
              /> */}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-3 rounded-[16px] border border-[#f0e0a0] bg-[#fff8e1] px-4 py-3.5 sm:px-5">
        <Info className="mt-0.5 size-4 shrink-0 text-[#a67c00]" strokeWidth={2} />
        <p className="font-montserrat text-[13px] leading-relaxed text-[#606060]">
          <span className="font-semibold text-black">Note: </span>
          {STEPS.NOTE}
        </p>
      </div>
    </section>
  );
}
