import { useNavigate } from "react-router-dom";
import { HeroSection } from "./how-it-works/components/HeroSection";
import { MeaningSection } from "./how-it-works/components/MeaningSection";
import { ProblemSection } from "./how-it-works/components/ProblemSection";
import { StepsSection } from "./how-it-works/components/StepsSection";
import { TableOfContents } from "./how-it-works/components/TableOfContents";
import { UseCasesSection } from "./how-it-works/components/UseCasesSection";
import { WhyIntentsSection } from "./how-it-works/components/WhyIntentsSection";
import { useHowItWorksToc } from "./how-it-works/useHowItWorksToc";

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 font-montserrat text-[16px] font-medium text-black transition-opacity hover:opacity-70"
    >
      <span
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white"
        aria-hidden
      >
        <img
          src="/icons/to-down.svg"
          alt=""
          className="h-3 w-3 rotate-90 brightness-0"
        />
      </span>
      Back
    </button>
  );
}

export function HowItWorksView() {
  const navigate = useNavigate();
  const { activeId, navigateTo } = useHowItWorksToc();

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
      return;
    }
    navigate("/login");
  };

  return (
    <div className="min-h-svh bg-[#f6f6f6] text-black">
      <div className="mx-auto w-full max-w-[1512px] px-2.5 pb-12 pt-2.5 sm:px-4 md:px-6 lg:px-2.5">
        <picture>
          <source media="(min-width: 768px)" srcSet="/howitwork/banner.png" />
          <img
            src="/howitwork/banner-mobile.png"
            alt="Stableflow Pay Confidential Payments."
            className="h-auto w-full rounded-[20px] object-cover"
          />
        </picture>

        <div className="mt-6 flex gap-8 lg:mt-8 lg:gap-10 xl:gap-12">
          <aside className="hidden w-[276px] shrink-0 lg:block">
            <div className="sticky top-6">
              <div className="mb-4">
                <BackButton onClick={goBack} />
              </div>
              <TableOfContents activeId={activeId} onNavigate={navigateTo} />
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-5 lg:hidden">
              <BackButton onClick={goBack} />
            </div>

            <div className="flex flex-col gap-12 sm:gap-14">
              <HeroSection />
              <ProblemSection />
              <StepsSection />
              <WhyIntentsSection />
              <UseCasesSection />
              <MeaningSection />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
