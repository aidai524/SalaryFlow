import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconLock, IconNode, IconShield } from "@/components/icons";
import {
  AUTH_BRAND,
  AUTH_BRAND_BG,
  AUTH_PANEL_BG,
  type AuthFeatureIconKey,
} from "./config";

const FEATURE_ICONS: Record<
  AuthFeatureIconKey,
  ComponentType<{ className?: string; style?: CSSProperties }>
> = {
  lock: IconLock,
  shield: IconShield,
  node: IconNode,
};

export function AuthShell({
  children,
  panelTop,
  cardClassName,
}: {
  children: ReactNode;
  /** Content above the form card (beta pill, annotation, etc.) */
  panelTop?: ReactNode;
  cardClassName?: string;
}) {
  return (
    <main className="flex min-h-svh flex-col md:flex-row">
      <aside
        className="relative flex w-full shrink-0 flex-col overflow-hidden px-6 py-8 md:w-[min(740px,45%)] md:min-h-svh md:px-12 md:py-14 lg:px-16"
        style={{ backgroundColor: AUTH_BRAND_BG }}
      >
        <img
          src="/auth/brand-mark-vector.svg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-[12%] left-[-45%] h-auto w-[min(120%,760px)] max-w-none select-none md:left-[-52%] md:top-[10%]"
        />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <img
            src="/logo.svg"
            alt="DECash"
            className="h-auto w-[188px]"
            width={188}
            height={46}
          />

          <h1 className="mt-10 max-w-[558px] font-montserrat text-[32px] font-semibold capitalize leading-tight text-black md:mt-16 md:text-[46px]">
            {AUTH_BRAND.headline}
          </h1>
          <p className="mt-4 max-w-[558px] font-montserrat text-[16px] font-normal leading-[1.5] text-black md:mt-5 md:text-[20px]">
            {AUTH_BRAND.subhead}
          </p>

          <ul className="mt-8 hidden flex-col gap-8 md:mt-12 md:flex">
            {AUTH_BRAND.features.map((feature) => {
              const Icon = FEATURE_ICONS[feature.icon];
              return (
                <li key={feature.title} className="flex max-w-[480px] items-start gap-4">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[rgba(0,0,0,0.1)] text-black"
                    aria-hidden
                  >
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-montserrat text-[20px] font-semibold capitalize text-black">
                      {feature.title}
                    </p>
                    <p className="mt-1 font-montserrat text-[14px] font-normal leading-[1.5] text-black">
                      {feature.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <Link
            to={AUTH_BRAND.howItWorksHref}
            className="mt-8 inline-flex items-center gap-1.5 font-montserrat text-sm font-normal text-black transition-opacity hover:opacity-70 md:mt-auto md:pt-10"
          >
            {AUTH_BRAND.howItWorksLabel}
            <svg className="shrink-0" width="13" height="9" viewBox="0 0 13 9" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0.5 4.5H12M8 8.5L12 4.5L8 0.5" stroke="#606060" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </Link>
        </div>
      </aside>

      <section
        className="relative flex flex-1 flex-col items-center justify-start px-4 py-10 sm:px-6 md:justify-center md:py-12"
        style={{ backgroundColor: AUTH_PANEL_BG }}
      >
        <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center">
          {panelTop ? <div className="mb-5 flex justify-center">{panelTop}</div> : null}
          <div className={`w-full ${cardClassName ?? ""}`}>{children}</div>
        </div>
      </section>
    </main>
  );
}
