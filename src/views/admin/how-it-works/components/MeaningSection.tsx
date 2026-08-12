import { Check, X } from "lucide-react";
import { CARD_CLASS, MEANING } from "../config";

export function MeaningSection() {
  return (
    <section>
      <h2 className="font-montserrat text-[22px] font-bold text-black sm:text-[26px]">
        {MEANING.TITLE}
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className={`p-5 sm:p-6 ${CARD_CLASS}`}>
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#d0f348]">
              <Check className="size-4 text-black" strokeWidth={2.5} />
            </span>
            <h3 className="font-montserrat text-[14px] font-semibold text-black">
              {MEANING.PROTECT.TITLE}
            </h3>
          </div>
          <ul className="space-y-2.5">
            {MEANING.PROTECT.ITEMS.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#84a20f]" />
                <span className="font-montserrat text-[13px] leading-relaxed text-[#606060]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`p-5 sm:p-6 ${CARD_CLASS}`}>
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#fde8e8]">
              <X className="size-4 text-[#c0392b]" strokeWidth={2.5} />
            </span>
            <h3 className="font-montserrat text-[14px] font-semibold text-black">
              {MEANING.NOT.TITLE}
            </h3>
          </div>
          <ul className="space-y-2.5">
            {MEANING.NOT.ITEMS.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#e85a5a]" />
                <span className="font-montserrat text-[13px] leading-relaxed text-[#606060]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-6 text-center font-montserrat text-[12px] leading-relaxed text-[#909090]">
        {MEANING.DISCLAIMER}
      </p>
    </section>
  );
}
