export const VOLUME_RANGE_OPTIONS = [
  { value: 6 as const, label: "6 Months", weeklyLabel: "6 Weeks" },
  { value: 12 as const, label: "12 Months", weeklyLabel: "12 Weeks" },
] as const;

export type VolumeRange = (typeof VOLUME_RANGE_OPTIONS)[number]["value"];

export const CATEGORY_COLORS: Record<"employee" | "contractor", string> = {
  employee: "#000000",
  contractor: "#909090",
};

export const CARD_CLASS =
  "rounded-[20px] border border-white bg-[#fdfdfd] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]";
