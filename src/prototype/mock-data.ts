export type TeamMemberId =
  | "albert-cto"
  | "ashley"
  | "andrew"
  | "billy"
  | "blake"
  | "jack"
  | "luck"
  | "hannah"
  | "albert"
  | "zoey"
  | "adam"
  | "tai";

export type AvatarKey = TeamMemberId;
export type AvatarPath = `/decash/avatars/${AvatarKey}.png`;

export type DepartmentId = "marketing" | "bd" | "development";
export type DepartmentName = "Marketing" | "BD" | "Development";
export type PaymentFrequency = "Monthly" | "Weekly";
export type PaymentNetwork = "Arbitrum" | "Ethereum" | "BNB" | "Near";
export type PaymentToken = "USDC" | "USDT";
export type PaymentStatus = "paid" | "pending";

export interface TeamMember {
  readonly id: TeamMemberId;
  readonly name: string;
  readonly role: string;
  readonly department: DepartmentName;
  readonly frequency: PaymentFrequency;
  readonly amount: number;
  readonly email: string;
  readonly address: `0x${string}`;
  readonly network: PaymentNetwork;
  readonly token: PaymentToken;
  readonly paid: boolean;
  readonly verified: boolean;
  readonly avatarPath: AvatarPath;
  readonly lastPayDate: string;
  readonly nextPayDate: string;
}

export interface DepartmentGroup {
  readonly id: DepartmentId;
  readonly name: DepartmentName;
  readonly memberIds: readonly TeamMemberId[];
  readonly headcount: number;
  readonly monthlyTotal: number;
}

export interface PaymentHistoryRow {
  readonly id: string;
  readonly periodDate: string;
  readonly memberId: TeamMemberId;
  readonly name: string;
  readonly role: string;
  readonly frequency: PaymentFrequency;
  readonly address: `0x${string}`;
  readonly network: PaymentNetwork;
  readonly token: PaymentToken;
  readonly amount: number;
  readonly status: PaymentStatus;
  readonly paymentDate: string;
  readonly avatarPath: AvatarPath;
}

export interface PaymentPeriod {
  readonly value: string;
  readonly label: string;
}

const PRIMARY_ADDRESS =
  "0x25232d48c6c75d9dea1810c99f76424f32276fe0" as const;
const BILLY_ADDRESS =
  "0x36ed53a021e292c34768065a797499a6bc7ef023" as const;

/**
 * Canonical twelve-person team used throughout the DECASH static prototype.
 * The supplied screens contain a few deliberately inconsistent variants; this
 * list follows the latest Team, Payment, Management, and History compositions.
 */
export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    id: "albert-cto",
    name: "Albert",
    role: "CTO",
    department: "Development",
    frequency: "Monthly",
    amount: 5_000,
    email: "albert_123@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDC",
    paid: false,
    verified: true,
    avatarPath: "/decash/avatars/albert-cto.png",
    lastPayDate: "2026-08-01",
    nextPayDate: "2026-09-01",
  },
  {
    id: "ashley",
    name: "Ashley",
    role: "KOL",
    department: "Development",
    frequency: "Weekly",
    amount: 5_000,
    email: "ashley@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "Ethereum",
    token: "USDT",
    paid: false,
    verified: false,
    avatarPath: "/decash/avatars/ashley.png",
    lastPayDate: "2026-08-03",
    nextPayDate: "2026-08-10",
  },
  {
    id: "andrew",
    name: "Andrew",
    role: "MKT",
    department: "Marketing",
    frequency: "Monthly",
    amount: 5_000,
    email: "andrew@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDC",
    paid: true,
    verified: false,
    avatarPath: "/decash/avatars/andrew.png",
    lastPayDate: "2026-08-03",
    nextPayDate: "2026-08-10",
  },
  {
    id: "billy",
    name: "Billy Watson",
    role: "Engineer",
    department: "Marketing",
    frequency: "Monthly",
    amount: 5_000,
    email: "billy.watson@gmail.com",
    address: BILLY_ADDRESS,
    network: "Ethereum",
    token: "USDT",
    paid: true,
    verified: true,
    avatarPath: "/decash/avatars/billy.png",
    lastPayDate: "2026-08-01",
    nextPayDate: "2026-09-01",
  },
  {
    id: "blake",
    name: "Blake Morris",
    role: "Engineer",
    department: "Marketing",
    frequency: "Monthly",
    amount: 3_000,
    email: "blake.morris@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDC",
    paid: true,
    verified: true,
    avatarPath: "/decash/avatars/blake.png",
    lastPayDate: "2026-08-01",
    nextPayDate: "2026-09-01",
  },
  {
    id: "jack",
    name: "Jack Fisher",
    role: "MKT",
    department: "Development",
    frequency: "Monthly",
    amount: 5_000,
    email: "jack.fisher@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "Near",
    token: "USDT",
    paid: true,
    verified: true,
    avatarPath: "/decash/avatars/jack.png",
    lastPayDate: "2026-08-01",
    nextPayDate: "2026-09-01",
  },
  {
    id: "luck",
    name: "Luck Elliott",
    role: "MKT",
    department: "Development",
    frequency: "Monthly",
    amount: 5_000,
    email: "luck.elliott@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "Near",
    token: "USDT",
    paid: true,
    verified: true,
    avatarPath: "/decash/avatars/luck.png",
    lastPayDate: "2026-08-01",
    nextPayDate: "2026-09-01",
  },
  {
    id: "hannah",
    name: "Hannah Petty",
    role: "MKT",
    department: "Development",
    frequency: "Monthly",
    amount: 5_000,
    email: "hannah.petty@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDT",
    paid: true,
    verified: true,
    avatarPath: "/decash/avatars/hannah.png",
    lastPayDate: "2026-08-01",
    nextPayDate: "2026-09-01",
  },
  {
    id: "albert",
    name: "Albert",
    role: "Engineer",
    department: "Development",
    frequency: "Monthly",
    amount: 5_000,
    email: "albert@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDT",
    paid: true,
    verified: true,
    avatarPath: "/decash/avatars/albert.png",
    lastPayDate: "2026-08-01",
    nextPayDate: "2026-09-01",
  },
  {
    id: "zoey",
    name: "Zoey",
    role: "Community",
    department: "Development",
    frequency: "Weekly",
    amount: 3_000,
    email: "zoey@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDT",
    paid: true,
    verified: true,
    avatarPath: "/decash/avatars/zoey.png",
    lastPayDate: "2026-08-03",
    nextPayDate: "2026-08-10",
  },
  {
    id: "adam",
    name: "Adam Levin",
    role: "Community",
    department: "BD",
    frequency: "Weekly",
    amount: 1_500,
    email: "adam.levin@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "BNB",
    token: "USDT",
    paid: false,
    verified: true,
    avatarPath: "/decash/avatars/adam.png",
    lastPayDate: "2026-08-03",
    nextPayDate: "2026-08-10",
  },
  {
    id: "tai",
    name: "Tai Verdes",
    role: "Developer",
    department: "Development",
    frequency: "Monthly",
    amount: 6_000,
    email: "tai.verdes@gmail.com",
    address: PRIMARY_ADDRESS,
    network: "Near",
    token: "USDT",
    paid: true,
    verified: true,
    avatarPath: "/decash/avatars/tai.png",
    lastPayDate: "2026-08-01",
    nextPayDate: "2026-09-01",
  },
];

export const DEPARTMENT_GROUPS: readonly DepartmentGroup[] = [
  {
    id: "marketing",
    name: "Marketing",
    memberIds: ["andrew", "billy", "blake"],
    headcount: 3,
    monthlyTotal: 12_000,
  },
  {
    id: "bd",
    name: "BD",
    memberIds: ["adam"],
    headcount: 1,
    monthlyTotal: 4_500,
  },
  {
    id: "development",
    name: "Development",
    memberIds: [
      "tai",
      "hannah",
      "albert",
      "zoey",
      "luck",
      "albert-cto",
      "ashley",
      "jack",
    ],
    headcount: 8,
    monthlyTotal: 35_000,
  },
];

/** Rows shown for the selected Aug 1, 2026 payroll period. */
export const PAYMENT_HISTORY_ROWS: readonly PaymentHistoryRow[] = [
  {
    id: "2026-08-01-andrew",
    periodDate: "2026-08-01",
    memberId: "andrew",
    name: "Andrew",
    role: "Developer",
    frequency: "Monthly",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDC",
    amount: 5_000,
    status: "paid",
    paymentDate: "2026-08-30 15:32",
    avatarPath: "/decash/avatars/andrew.png",
  },
  {
    id: "2026-08-01-billy",
    periodDate: "2026-08-01",
    memberId: "billy",
    name: "Billy Watson",
    role: "Developer",
    frequency: "Monthly",
    address: BILLY_ADDRESS,
    network: "Ethereum",
    token: "USDT",
    amount: 5_000,
    status: "pending",
    paymentDate: "2026-08-30 15:31",
    avatarPath: "/decash/avatars/billy.png",
  },
  {
    id: "2026-08-01-blake",
    periodDate: "2026-08-01",
    memberId: "blake",
    name: "Blake Morris",
    role: "Marketing",
    frequency: "Monthly",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDC",
    amount: 3_000,
    status: "paid",
    paymentDate: "2026-08-30 15:29",
    avatarPath: "/decash/avatars/blake.png",
  },
  {
    id: "2026-08-01-adam",
    periodDate: "2026-08-01",
    memberId: "adam",
    name: "Adam Levin",
    role: "Community",
    frequency: "Monthly",
    address: PRIMARY_ADDRESS,
    network: "BNB",
    token: "USDT",
    amount: 1_500,
    status: "paid",
    paymentDate: "2026-08-30 15:29",
    avatarPath: "/decash/avatars/adam.png",
  },
  {
    id: "2026-08-01-tai",
    periodDate: "2026-08-01",
    memberId: "tai",
    name: "Tai Verdes",
    role: "Developer",
    frequency: "Monthly",
    address: PRIMARY_ADDRESS,
    network: "Near",
    token: "USDT",
    amount: 6_000,
    status: "paid",
    paymentDate: "2026-08-30 15:26",
    avatarPath: "/decash/avatars/tai.png",
  },
  {
    id: "2026-08-01-hannah",
    periodDate: "2026-08-01",
    memberId: "hannah",
    name: "Hannah Petty",
    role: "Developer",
    frequency: "Monthly",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDT",
    amount: 5_000,
    status: "paid",
    paymentDate: "2026-08-30 15:22",
    avatarPath: "/decash/avatars/hannah.png",
  },
  {
    id: "2026-08-01-albert",
    periodDate: "2026-08-01",
    memberId: "albert",
    name: "Albert",
    role: "Developer",
    frequency: "Monthly",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDT",
    amount: 5_000,
    status: "paid",
    paymentDate: "2026-08-30 15:09",
    avatarPath: "/decash/avatars/albert.png",
  },
  {
    id: "2026-08-01-zoey",
    periodDate: "2026-08-01",
    memberId: "zoey",
    name: "Zoey",
    role: "Developer",
    frequency: "Monthly",
    address: PRIMARY_ADDRESS,
    network: "Arbitrum",
    token: "USDT",
    amount: 5_000,
    status: "paid",
    paymentDate: "2026-08-30 15:22",
    avatarPath: "/decash/avatars/zoey.png",
  },
];

export const PAYMENT_PERIODS: readonly PaymentPeriod[] = [
  { value: "2026-08-01", label: "Aug 1, 2026" },
  { value: "2026-07-31", label: "Jul 31, 2026" },
  { value: "2026-07-29", label: "Jul 29, 2026" },
  { value: "2026-07-15", label: "Jul 15, 2026" },
  { value: "2026-07-01", label: "Jul 1, 2026" },
  { value: "2026-06-30", label: "Jun 30, 2026" },
  { value: "2026-06-15", label: "Jun 15, 2026" },
  { value: "2026-06-01", label: "Jun 1, 2026" },
  { value: "2026-05-31", label: "May 31, 2026" },
];

export const PAYMENT_PERIOD_DATES: readonly string[] = PAYMENT_PERIODS.map(
  ({ label }) => label,
);

// Lowercase aliases keep imports ergonomic in page and component modules.
export const teamMembers = TEAM_MEMBERS;
export const departmentGroups = DEPARTMENT_GROUPS;
export const paymentHistoryRows = PAYMENT_HISTORY_ROWS;
export const paymentPeriods = PAYMENT_PERIODS;
export const paymentPeriodDates = PAYMENT_PERIOD_DATES;
