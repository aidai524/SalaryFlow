export const AUTH_BRAND_BG = "#C8E458";
export const AUTH_PANEL_BG = "#F6F6F6";

/** @deprecated Use AUTH_BRAND_BG — kept for any stray imports. */
export const AUTH_BG = AUTH_BRAND_BG;

export const AUTH_CARD_CLASS =
  "flex w-full max-w-[420px] flex-col rounded-[20px] border border-white bg-[#fdfdfd] px-7 pt-8 pb-8 shadow-[0_0_20px_rgba(0,0,0,0.06)]";

export const AUTH_LABEL_CLASS = "font-montserrat text-[14px] font-medium text-[#909090]";

export const AUTH_INPUT_CLASS =
  "mt-2.5 h-[42px] w-full rounded-[6px] border border-[#e3e3e3] bg-[#f6f6f6] px-4 font-montserrat text-sm font-medium text-black outline-none placeholder:text-black/30 focus:border-[#c8c8c8]";

export const AUTH_BUTTON_CLASS =
  "mt-6 h-[50px] w-full rounded-[12px] bg-black font-montserrat text-base font-medium text-white shadow-[0_0_6px_rgba(0,0,0,0.06)] hover:bg-black/90 disabled:opacity-60";

export const AUTH_LINK_CLASS =
  "mt-5 text-center font-montserrat text-sm font-medium text-[#909090]";

export const AUTH_LINK_ACCENT_CLASS = "text-[#3f8afb] hover:text-[#3f8afb]/90";

export const AUTH_FEATURE_ICON_KEYS = ["lock", "shield", "node"] as const;
export type AuthFeatureIconKey = (typeof AUTH_FEATURE_ICON_KEYS)[number];

export const AUTH_BRAND = {
  headline: "Confidential Payments.",
  subhead:
    "Send across chains without creating a direct public link between sender and recipient.",
  features: [
    {
      icon: "lock" as AuthFeatureIconKey,
      title: "Confidential by default",
      body: "Reduce direct public sender  recipient linkage.",
    },
    {
      icon: "shield" as AuthFeatureIconKey,
      title: "Self-custodial",
      body: "Your wallet. Your funds. You authorize every payment",
    },
    {
      icon: "node" as AuthFeatureIconKey,
      title: "Cross-chain",
      body: "Pay across supported network whilethe recipient receives on another.",
    },
  ],
  howItWorksLabel: "How it works",
  howItWorksHref: "/howitworks",
  betaLabel: "DeCash is currently in beta.",
} as const;

export const DEFAULT_PAYOUT_TOKEN = "USDC";
export const DEFAULT_PAYOUT_NETWORK = "Base";
