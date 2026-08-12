import { Building2, User } from "lucide-react";
import { CARD_CLASS, PROBLEM, SECTION_CARD_CLASS } from "../config";

export function ProblemSection() {
  return (
    <section>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-10">
        <div>
          <h2 className="font-montserrat text-[22px] font-bold text-black sm:text-[26px]">
            {PROBLEM.TITLE}
          </h2>
          <p className="mt-3 font-montserrat text-[14px] leading-relaxed text-[#606060]">
            {PROBLEM.BODY_1}
          </p>
          <p className="mt-3 font-montserrat text-[14px] leading-relaxed text-[#606060]">
            {PROBLEM.BODY_2}
          </p>

          <div className="mt-5 space-y-3">
            <div className={`flex gap-3 p-4 ${SECTION_CARD_CLASS}`}>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#d0f348]">
                <Building2 className="size-4 text-black" strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-montserrat text-[14px] font-semibold text-black">
                  {PROBLEM.BUSINESS.TITLE}
                </p>
                <p className="mt-1 font-montserrat text-[13px] leading-relaxed text-[#606060]">
                  {PROBLEM.BUSINESS.BODY}
                </p>
              </div>
            </div>
            <div className={`flex gap-3 p-4 ${SECTION_CARD_CLASS}`}>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#d0f348]">
                <User className="size-4 text-black" strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-montserrat text-[14px] font-semibold text-black">
                  {PROBLEM.INDIVIDUAL.TITLE}
                </p>
                <p className="mt-1 font-montserrat text-[13px] leading-relaxed text-[#606060]">
                  {PROBLEM.INDIVIDUAL.BODY}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={`p-5 sm:p-6 ${CARD_CLASS}`}>
          <p className="mb-5 font-montserrat text-[14px] font-semibold text-black">
            {PROBLEM.STANDARD.TITLE}
          </p>
          <div className="flex flex-col items-center gap-2">
            <div className="w-full max-w-[240px] rounded-[12px] border border-black/10 bg-[#f6f6f6] px-4 py-3 text-center">
              <p className="font-montserrat text-[13px] font-semibold text-black">
                {PROBLEM.STANDARD.FROM}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 py-1">
              <div className="h-8 w-px bg-[#e85a5a]" aria-hidden />
              <span className="rounded-full bg-[#fde8e8] px-2.5 py-0.5 font-montserrat text-[11px] font-medium text-[#c0392b]">
                {PROBLEM.STANDARD.MIDDLE}
              </span>
              <div className="h-8 w-px bg-[#e85a5a]" aria-hidden />
              <div
                className="size-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-[#e85a5a]"
                aria-hidden
              />
            </div>
            <div className="w-full max-w-[240px] rounded-[12px] border border-black/10 bg-[#f6f6f6] px-4 py-3 text-center">
              <p className="font-montserrat text-[13px] font-semibold text-black">
                {PROBLEM.STANDARD.TO}
              </p>
            </div>
            <p className="mt-4 text-center font-montserrat text-[12px] font-medium text-[#c0392b]">
              {PROBLEM.STANDARD.NOTE}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
