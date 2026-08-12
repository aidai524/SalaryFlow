import { Briefcase, Globe, User, Users } from "lucide-react";
import { SECTION_CARD_CLASS, USE_CASES } from "../config";

const USE_CASE_ICONS = [User, Users, Briefcase, Globe] as const;

export function UseCasesSection() {
  return (
    <section>
      <h2 className="font-montserrat text-[22px] font-bold text-black sm:text-[26px]">
        {USE_CASES.TITLE}
      </h2>
      <p className="mt-2 font-montserrat text-[14px] font-semibold text-black">
        {USE_CASES.SUBTITLE}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {USE_CASES.ITEMS.map((item, index) => {
          const Icon = USE_CASE_ICONS[index] ?? User;
          return (
            <div key={item.TITLE} className={`p-4 sm:p-5 ${SECTION_CARD_CLASS}`}>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#d0f348]">
                <Icon className="size-4 text-black" strokeWidth={1.75} />
              </span>
              <h3 className="mt-3 font-montserrat text-[14px] font-semibold text-black">
                {item.TITLE}
              </h3>
              <p className="mt-1.5 font-montserrat text-[12px] leading-relaxed text-[#606060]">
                {item.BODY}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
