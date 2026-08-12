export const CARD_CLASS =
  "rounded-[20px] border border-white bg-[#fdfdfd] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]";

export const SECTION_CARD_CLASS =
  "rounded-[16px] border border-black/5 bg-white shadow-[0px_0px_16px_0px_rgba(0,0,0,0.04)]";

export const BACK_LABEL = "Back";
/** Fallback when there is no in-app history to return to. */
export const BACK_FALLBACK_HREF = "/login";

export const HERO = {
  TITLE: "How Confidential Payments Work",
  TAGLINE: "Your keys. Your funds. Confidential by default.",
  BODY_1:
    "DECASH uses confidential execution to reduce the public link between the wallet you pay from and the wallet that receives your payment.",
  BODY_2:
    "Send stablecoins across supported chains and assets while keeping payment relationships confidential by default.",
  BADGE: "Confidential by default",
  FLOW: {
    FROM: "Your Wallet",
    MIDDLE: "Confidential execution",
    TO: "Recipient Wallet",
    NOTE: "No direct public on-chain link between sender and recipient.",
  },
} as const;

export const PROBLEM = {
  TITLE: "The Problem With Normal On-Chain Payments",
  BODY_1:
    "A normal stablecoin transfer creates a permanent public relationship between two wallets.",
  BODY_2:
    "Anyone inspecting the blockchain can see the sending address and receiving address and use public activity to analyze the relationship between them.",
  BUSINESS: {
    TITLE: "For businesses",
    BODY: "This can expose salary relationships, treasury activity, and vendor relationships.",
  },
  INDIVIDUAL: {
    TITLE: "For individuals",
    BODY: "This can expose which wallet paid whom and make it easier to inspect related wallet activity.",
  },
  STANDARD: {
    TITLE: "Standard payment",
    FROM: "Your Wallet",
    MIDDLE: "Public transaction",
    TO: "Recipient Wallet",
    NOTE: "Sender ↔ recipient directly linked on-chain.",
  },
} as const;

export const STEPS = {
  TITLE: "How Confidential Payments Work on DECASH",
  ITEMS: [
    {
      NUM: "01",
      TITLE: "You define the payment",
      BODY_1: "Choose the recipient, amount, and what they should receive.",
      BODY_2:
        "Your payment source and the recipient's destination can use different supported networks and assets.",
    },
    {
      NUM: "02",
      TITLE: "The intent executes confidentially",
      BODY_1:
        "DECASH uses NEAR Confidential Intents, where execution happens inside a dedicated NEAR private shard.",
      BODY_2:
        "The private shard is connected to NEAR mainnet through a TEE-based bridge.",
    },
    {
      NUM: "03",
      TITLE: "The recipient gets paid",
      BODY_1:
        "The recipient receives the requested asset on their destination network.",
      BODY_2:
        "The payment does not create the same direct public sender ↔ recipient relationship as a standard wallet-to-wallet transfer.",
    },
  ],
  NOTE: "Source and destination networks may still have their own public on-chain activity. DECASH protects the direct payment relationship, not the entire blockchain.",
} as const;

export const WHY = {
  TITLE: "Why Confidential Intents",
  ITEMS: [
    {
      TITLE: "Confidential execution",
      BODY_1:
        "Execution happens without exposing details to the public mempool or bots.",
      BODY_2: "Your payment relationships and execution details stay confidential.",
    },
    {
      TITLE: "Cross-chain by design",
      BODY_1:
        "Pay with one supported asset or network and deliver another supported asset on the recipient's preferred network.",
      BODY_2: "True cross-chain payments, simplified.",
    },
    {
      TITLE: "Selective disclosure",
      BODY_1: "Confidential doesn't mean unauditable.",
      BODY_2:
        "Selective disclosure and auditable execution allow the right information to be shared when needed.",
    },
  ],
  POWERED: "Powered by NEAR Confidential Intents",
} as const;

export const USE_CASES = {
  TITLE: "Built For More Than Payroll",
  SUBTITLE: "One confidential payment layer. Many ways to use it.",
  ITEMS: [
    {
      TITLE: "Personal Payments",
      BODY: "Pay another wallet without exposing a direct public relationship between your wallets.",
    },
    {
      TITLE: "Payroll",
      BODY: "Pay employees without exposing a public treasury → employee salary graph.",
    },
    {
      TITLE: "Contractors & Vendors",
      BODY: "Keep commercial payment relationships and recurring payouts less publicly linkable.",
    },
    {
      TITLE: "Cross-Chain Payments",
      BODY: "Pay from the asset you hold while the recipient receives the stablecoin and network they prefer.",
    },
  ],
} as const;

export const CONTROL = {
  TITLE: "You Stay in Control",
  NON_CUSTODIAL: "DECASH is non-custodial.",
  BODY: "You authorize every payment from your own wallet or Safe.",
  TAGLINE: "Your keys. Your funds.",
  FLOW: [
    "You authorize the payment",
    "DECASH executes confidentially",
    "Funds move according to your instruction",
  ],
} as const;

export const MEANING = {
  TITLE: "What Confidential Does — and Doesn't — Mean",
  PROTECT: {
    TITLE: "Confidential payments help protect:",
    ITEMS: [
      "Direct sender ↔ recipient linkage",
      "Payment relationships",
      "Internal execution details",
      "Payroll / contractor / vendor relationships",
    ],
  },
  NOT: {
    TITLE: "Confidential does not mean:",
    ITEMS: [
      "Anonymous identity",
      "Every blockchain transaction disappears",
      "Public destination wallets become private wallets",
      "Activity can never be analyzed or correlated",
    ],
  },
  DISCLAIMER:
    "DECASH is designed to reduce direct public payment linkage, not to promise anonymity.",
} as const;
