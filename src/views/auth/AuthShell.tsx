import type { ReactNode } from "react";
import { AUTH_BG } from "./config";

export function AuthShell({
  children,
  cardClassName,
}: {
  children: ReactNode;
  cardClassName?: string;
}) {
  return (
    <main
      className="relative flex min-h-svh items-start justify-center overflow-hidden px-4 pb-10 pt-16 sm:items-center sm:px-6 sm:pt-10"
      style={{ backgroundColor: AUTH_BG }}
    >
      <img
        src="/teams/dollar-mark.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-[7%] left-[-18%] h-auto w-[min(48vw,480px)] select-none opacity-100 max-sm:opacity-40"
      />
      <img
        src="/teams/dollar-mark.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-[7%] right-[-18%] h-auto w-[min(48vw,480px)] scale-x-[-1] select-none opacity-100 max-sm:opacity-40"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[400px] flex-col items-center">
        <img
          src="/logo.svg"
          alt="DECash"
          className="h-auto w-[176px]"
          width={176}
          height={52}
        />

        <p className="mt-4 font-rubik-one text-lg uppercase leading-none text-black">
          Confidential stablecoin payments.
        </p>
        <p className="mt-2 max-w-[394px] text-center font-montserrat text-[12px] font-normal leading-[1.5] text-black">
          Send across chains without creating a direct public link between sender and recipient.
        </p>

        <div className={`relative mt-10 w-full sm:mt-16 ${cardClassName ?? ""}`}>
          {children}
        </div>
      </div>
    </main>
  );
}
