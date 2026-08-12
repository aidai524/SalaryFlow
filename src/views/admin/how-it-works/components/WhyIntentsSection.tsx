import { Eye, Globe, Lock, ShieldCheck } from "lucide-react";
import { WHY } from "../config";

const WHY_ICONS = [Lock, Globe, Eye] as const;

export function WhyIntentsSection() {
  return (
    <section>
      <h2 className="font-montserrat text-[22px] font-bold text-black sm:text-[26px]">
        {WHY.TITLE}
      </h2>

      <div className="mt-6 grid gap-8 md:grid-cols-3 md:gap-6">
        {WHY.ITEMS.map((item, index) => {
          const Icon = WHY_ICONS[index] ?? Lock;
          return (
            <div key={item.TITLE}>
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-[#d0f348]">
                <Icon className="size-5 text-black" strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 font-montserrat text-[15px] font-semibold text-black">
                {item.TITLE}
              </h3>
              <p className="mt-2 font-montserrat text-[13px] leading-relaxed text-[#606060]">
                {item.BODY_1}
              </p>
              <p className="mt-2 font-montserrat text-[13px] leading-relaxed text-[#606060]">
                {item.BODY_2}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-1.5 shadow-sm">
        <ShieldCheck className="size-3.5 text-[#5a6e10]" strokeWidth={2} />
        <span className="font-montserrat text-[12px] font-medium text-[#606060]">
          {WHY.POWERED}
        </span>
      </div>
    </section>
  );
}
