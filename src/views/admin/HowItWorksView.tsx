import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ControlSection } from "./how-it-works/components/ControlSection";
import { HeroSection } from "./how-it-works/components/HeroSection";
import { MeaningSection } from "./how-it-works/components/MeaningSection";
import { ProblemSection } from "./how-it-works/components/ProblemSection";
import { StepsSection } from "./how-it-works/components/StepsSection";
import { UseCasesSection } from "./how-it-works/components/UseCasesSection";
import { WhyIntentsSection } from "./how-it-works/components/WhyIntentsSection";
import { BACK_HREF, BACK_LABEL } from "./how-it-works/config";

export function HowItWorksView() {
  return (
    <div className="pb-12 pt-4 md:pt-5">
      <Link
        to={BACK_HREF}
        className="mb-5 inline-flex items-center gap-1.5 font-montserrat text-[13px] font-medium text-[#606060] transition-colors hover:text-black"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        {BACK_LABEL}
      </Link>

      <div className="flex flex-col gap-12 sm:gap-14">
        <HeroSection />
        <ProblemSection />
        <StepsSection />
        <WhyIntentsSection />
        <UseCasesSection />
        <ControlSection />
        <MeaningSection />
      </div>
    </div>
  );
}
