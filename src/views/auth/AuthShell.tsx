import type { ReactNode } from "react";
import { AUTH_BRAND, AUTH_BRAND_BG, AUTH_PANEL_BG } from "./config";

export function AuthShell({
  children,
  cardClassName,
}: {
  children: ReactNode;
  cardClassName?: string;
}) {
  return (
    <main className="flex min-h-svh flex-col md:flex-row">
      {/* Brand panel */}
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

        <div className="relative z-10 flex flex-col">
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
            {AUTH_BRAND.features.map((feature) => (
              <li key={feature.title} className="max-w-[480px]">
                <p className="font-montserrat text-[20px] font-semibold capitalize text-black">
                  {feature.title}
                </p>
                <p className="mt-2.5 font-montserrat text-[14px] font-normal leading-[1.5] text-black">
                  {feature.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form panel */}
      <section
        className="relative flex flex-1 items-start justify-center px-4 py-10 sm:px-6 md:items-center md:py-12"
        style={{ backgroundColor: AUTH_PANEL_BG }}
      >
        <div className={`relative z-10 w-full max-w-[420px] ${cardClassName ?? ""}`}>
          {children}
        </div>
      </section>
    </main>
  );
}
