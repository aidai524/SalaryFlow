import { IconCheck } from "@/components/icons/check";
import { IconClose } from "@/components/icons/close";

const PROTECT_ITEMS = [
  "Direct sender ↔ recipient linkage",
  "Payment relationships",
  "Internal execution details",
  "Payroll / contractor / vendor relationships",
] as const;

const NOT_ITEMS = [
  "Anonymous identity",
  "Every blockchain transaction disappears",
  "Public destination wallets become private wallets",
  "Activity can never be analyzed or correlated",
] as const;

export function MeaningSection() {
  return (
    <section id="what-confidential-does-and-doesnt-mean" className="scroll-mt-6">
      <h2 className="font-montserrat text-[26px] font-semibold leading-tight text-black">
        What Confidential Does — and Doesn&apos;t — Mean
      </h2>
      <div className="mt-5 space-y-4 font-montserrat text-[16px] leading-normal text-black">
        <p>
          A normal stablecoin transfer creates a permanent public relationship between
          two wallets.
        </p>
        <p>
          Anyone inspecting the blockchain can see the sending address and receiving
          address and use public activity to analyze the relationship between them.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#c8e458]">
              <IconCheck className="size-[9px] text-white" />
            </span>
            <h3 className="font-montserrat text-[16px] font-semibold text-black">
              Confidential Payments Help Protect
            </h3>
          </div>
          <ul className="space-y-2">
            {PROTECT_ITEMS.map((item) => (
              <li key={item} className="flex gap-3 items-center not-first:mb-2">
                <span className="size-[7px] shrink-0 rounded-full bg-[#84a20f]" />
                <span className="font-montserrat text-[14px] text-black leading-[100%]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ff6b6b]">
              <IconClose className="size-[10px] text-white" />
            </span>
            <h3 className="font-montserrat text-[16px] font-semibold text-black">
              Confidential Does Not Mean
            </h3>
          </div>
          <ul className="space-y-2">
            {NOT_ITEMS.map((item) => (
              <li key={item} className="flex gap-3 items-center not-first:mb-2">
                <span className="size-[7px] shrink-0 rounded-full bg-[#e85a5a]" />
                <span className="font-montserrat text-[14px] leading-[100%] text-black">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-5 font-montserrat text-[14px] leading-normal text-black">
        *Stableflow Pay is designed to reduce direct public payment linkage, not to promise
        anonymity.
      </p>
    </section>
  );
}
