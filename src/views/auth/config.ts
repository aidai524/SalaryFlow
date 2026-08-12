export const AUTH_BRAND_BG = "#C8E458";
export const AUTH_PANEL_BG = "#F6F6F6";

/** @deprecated Use AUTH_BRAND_BG — kept for any stray imports. */
export const AUTH_BG = AUTH_BRAND_BG;

export const AUTH_CARD_CLASS =
  "flex w-full max-w-[420px] flex-col rounded-[20px] border border-white bg-[#fdfdfd] px-7 pt-7 pb-7 shadow-[0_0_20px_rgba(0,0,0,0.06)]";

export const AUTH_LABEL_CLASS = "font-montserrat text-[14px] font-medium text-[#909090]";

export const AUTH_INPUT_CLASS =
  "mt-2.5 h-14 w-full rounded-[6px] border border-[#e3e3e3] bg-[#f6f6f6] px-4 font-montserrat text-sm font-medium text-black outline-none placeholder:text-black/30 focus:border-[#c8c8c8]";

export const AUTH_BUTTON_CLASS =
  "mt-6 h-[70px] w-full rounded-[12px] bg-black font-montserrat text-base font-medium text-white shadow-[0_0_6px_rgba(0,0,0,0.06)] hover:bg-black/90 disabled:opacity-60";

export const AUTH_LINK_CLASS =
  "mt-5 text-center font-montserrat text-sm font-medium text-[#909090] hover:text-black";

export const AUTH_BRAND = {
  headline: "Confidential Payments.",
  subhead:
    "Send across chains without creating a direct public link between sender and recipient.",
  features: [
    {
      title: "Confidential by default",
      body: "Reduce direct public sender  recipient linkage.",
    },
    {
      title: "Self-custodial",
      body: "Your wallet. Your funds. You authorize every payment",
    },
    {
      title: "Cross-chain",
      body: "Pay across supported network whilethe recipient receives on another.",
    },
  ],
} as const;

export const DEFAULT_PAYOUT_TOKEN = "USDC";
export const DEFAULT_PAYOUT_NETWORK = "Base";
