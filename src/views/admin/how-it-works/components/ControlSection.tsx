import { ShieldCheck, Vault, Wallet } from "lucide-react";
import { CARD_CLASS, CONTROL } from "../config";

export function ControlSection() {
  return (
    <section className={`p-5 sm:p-8 ${CARD_CLASS} bg-[rgba(208,243,72,0.12)]`}>
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-10">
        <div>
          <span className="inline-flex size-14 items-center justify-center rounded-2xl border-2 border-[#d0f348] bg-white">
            <ShieldCheck className="size-7 text-[#5a6e10]" strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 font-montserrat text-[22px] font-bold text-black sm:text-[26px]">
            {CONTROL.TITLE}
          </h2>
          <p className="mt-3 font-montserrat text-[15px] font-semibold text-black">
            {CONTROL.NON_CUSTODIAL}
          </p>
          <p className="mt-2 font-montserrat text-[14px] leading-relaxed text-[#606060]">
            {CONTROL.BODY}
          </p>
          <p className="mt-3 font-montserrat text-[15px] font-semibold text-black">
            {CONTROL.TAGLINE}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          {CONTROL.FLOW.map((label, index) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-2 sm:flex-row sm:gap-2">
              <div className="flex w-full flex-col items-center gap-2 text-center">
                {index === 0 ? (
                  <span className="inline-flex size-14 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm">
                    <Wallet className="size-6 text-[#606060]" strokeWidth={1.75} />
                  </span>
                ) : null}
                {index === 1 ? (
                  <span className="inline-flex size-16 items-center justify-center rounded-full bg-[#d0f348] shadow-sm">
                    <ShieldCheck className="size-7 text-black" strokeWidth={2.5} />
                  </span>
                ) : null}
                {index === 2 ? (
                  <span className="inline-flex size-14 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm">
                    <Vault className="size-6 text-[#606060]" strokeWidth={1.75} />
                  </span>
                ) : null}
                <p className="max-w-[140px] font-montserrat text-[12px] font-semibold leading-snug text-black">
                  {label}
                </p>
              </div>
              {index < CONTROL.FLOW.length - 1 ? (
                <div
                  className="mx-auto h-6 w-px border-l border-dashed border-black/25 sm:mx-0 sm:h-px sm:w-8 sm:border-l-0 sm:border-t"
                  aria-hidden
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
