import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ControlSection } from "./how-it-works/components/ControlSection";
import { HeroSection } from "./how-it-works/components/HeroSection";
import { MeaningSection } from "./how-it-works/components/MeaningSection";
import { ProblemSection } from "./how-it-works/components/ProblemSection";
import { StepsSection } from "./how-it-works/components/StepsSection";
import { UseCasesSection } from "./how-it-works/components/UseCasesSection";
import { WhyIntentsSection } from "./how-it-works/components/WhyIntentsSection";
import { BACK_FALLBACK_HREF, BACK_LABEL } from "./how-it-works/config";

export function HowItWorksView() {
  const navigate = useNavigate();

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
      return;
    }
    navigate(BACK_FALLBACK_HREF);
  };

  return (
    <div className="min-h-svh bg-[#f6f6f6] text-black">
      <div className="mx-auto w-full max-w-[1512px] px-4 pb-12 pt-4 sm:px-6 md:px-10 md:pt-5 lg:px-[50px]">
        <button
          type="button"
          onClick={goBack}
          className="mb-5 inline-flex items-center gap-1.5 font-montserrat text-[13px] font-medium text-[#606060] transition-colors hover:text-black"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          {BACK_LABEL}
        </button>

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
    </div>
  );
}
