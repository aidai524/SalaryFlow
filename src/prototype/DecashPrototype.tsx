import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { AnimatePresence, domMax, LazyMotion, MotionConfig, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleMinus,
  Clipboard,
  Clock3,
  Link2,
  Mail,
  MoreVertical,
  Pencil,
  Plus,
  Settings,
  Upload,
} from "lucide-react";
import {
  DEPARTMENT_GROUPS,
  PAYMENT_HISTORY_ROWS,
  PAYMENT_PERIODS,
  TEAM_MEMBERS,
  type PaymentFrequency,
  type TeamMember,
  type TeamMemberId,
} from "./mock-data";
import "./decash.css";

type Scene =
  | "team"
  | "team-unpaid"
  | "team-empty"
  | "management"
  | "member-add"
  | "member-edit"
  | "payment"
  | "payment-empty"
  | "history"
  | "single-pay"
  | "dashboard";

type PrimaryView = "team" | "payment" | "dashboard";
type TeamFilter = "all" | "monthly" | "weekly" | "paid" | "due";

const SCENES = new Set<Scene>([
  "team",
  "team-unpaid",
  "team-empty",
  "management",
  "member-add",
  "member-edit",
  "payment",
  "payment-empty",
  "history",
  "single-pay",
  "dashboard",
]);

const NETWORK_ICON: Record<TeamMember["network"], string> = {
  Arbitrum: "/decash/icons/arbitrum.png",
  Ethereum: "/decash/icons/ethereum.png",
  BNB: "/decash/icons/bnb.png",
  Near: "/decash/icons/near.png",
};

const TOKEN_ICON: Record<TeamMember["token"], string> = {
  USDC: "/decash/icons/usdc.png",
  USDT: "/decash/icons/usdt.png",
};

const MOTION_EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const enterFromBelow = {
  opacity: 0,
  transform: "translate3d(0, 8px, 0) scale(0.99)",
};

const enterAtRest = {
  opacity: 1,
  transform: "translate3d(0, 0, 0) scale(1)",
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function money(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function compactAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

function readScene(): Scene {
  const candidate = new URLSearchParams(window.location.search).get("scene") as Scene | null;
  return candidate && SCENES.has(candidate) ? candidate : "team";
}

function primaryView(scene: Scene): PrimaryView {
  if (["payment", "payment-empty", "history", "single-pay"].includes(scene)) return "payment";
  if (scene === "dashboard") return "dashboard";
  return "team";
}

function roleClass(role: string) {
  if (role === "CTO" || role === "Engineer") return "is-blue";
  if (role === "KOL" || role === "MKT") return role === "KOL" ? "is-pink" : "is-orange";
  return "is-lime";
}

function memberAvatarPath(member: TeamMember, selected = false) {
  if (member.id === "albert-cto") {
    return selected ? "/decash/avatars/albert-cto.png" : "/decash/avatars/albert-cto-card.png";
  }
  return member.avatarPath;
}

function MemberAvatar({
  member,
  compact = false,
  selected = false,
  showStatus = true,
}: {
  member: TeamMember;
  compact?: boolean;
  selected?: boolean;
  showStatus?: boolean;
}) {
  const embeddedStatus = member.id === "albert-cto" && !selected;
  return (
    <span className={cx("dc-avatar-wrap", compact && "is-compact", selected && "is-selected")}>
      <img className="dc-avatar" src={memberAvatarPath(member, selected)} alt="" />
      {showStatus && !embeddedStatus ? (
        <span className={cx("dc-status-dot", member.verified ? "is-verified" : "is-pending")}>
          {member.verified ? <Check aria-hidden="true" /> : null}
        </span>
      ) : null}
    </span>
  );
}

function InitialAvatar({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <span className={cx("dc-avatar-wrap", "is-placeholder", compact && "is-compact")} aria-hidden="true">
      <span>{label}</span>
    </span>
  );
}

function IconLabel({ kind, label }: { kind: TeamMember["network"] | TeamMember["token"]; label: string }) {
  const src = kind === "USDC" || kind === "USDT" ? TOKEN_ICON[kind] : NETWORK_ICON[kind];
  return (
    <span className="dc-icon-label">
      <img className="dc-inline-icon" src={src} alt="" />
      <span>{label}</span>
    </span>
  );
}

function DecashHeader({
  active,
  onNavigate,
}: {
  active: PrimaryView;
  onNavigate: (scene: Scene) => void;
}) {
  const items: Array<{ id: PrimaryView; label: string; scene: Scene }> = [
    { id: "team", label: "Team", scene: "team" },
    { id: "payment", label: "Payment", scene: "payment" },
    { id: "dashboard", label: "Dashboard", scene: "dashboard" },
  ];

  return (
    <header className="dc-header">
      <button className="dc-brand" type="button" onClick={() => onNavigate("team")} aria-label="DECASH team">
        <img src={active === "payment" ? "/decash/logo-payment.png" : "/decash/logo.png"} alt="DECASH" />
      </button>
      <nav className="dc-primary-nav" aria-label="Primary navigation">
        {items.map((item) => (
          <button
            key={item.id}
            className={cx("dc-nav-button", active === item.id && "is-active")}
            type="button"
            aria-current={active === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.scene)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="dc-account">
        <button className="dc-wallet" type="button" aria-label="Connected wallet XK05...58dc1">
          <img className="dc-wallet-orb" src="/decash/wallet-orb.png" alt="" />
          <span>XK05...58dc1</span>
        </button>
        <button className="dc-icon-button is-ghost" type="button" aria-label="Open account menu" title="Account menu">
          <MoreVertical aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function PageHeading({
  compact = false,
  actions,
}: {
  compact?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="dc-heading-row">
      <div>
        <h1 className={cx("dc-title", compact && "is-compact")}>Hi! Eureka Team</h1>
        {!compact ? <p className="dc-subtitle">Manage your team members and their payout methods</p> : null}
      </div>
      {actions ? <div className="dc-action-row">{actions}</div> : null}
    </div>
  );
}

function TeamActions({ onScene }: { onScene: (scene: Scene) => void }) {
  return (
    <>
      <button className="dc-button is-black is-small" type="button" onClick={() => onScene("member-add")}>
        <Link2 aria-hidden="true" /> Invite
      </button>
      <button className="dc-round-button" type="button" aria-label="Add team member" title="Add team member" onClick={() => onScene("member-add")}>
        <Plus aria-hidden="true" />
      </button>
      <button className="dc-round-button" type="button" aria-label="Manage departments" title="Manage departments" onClick={() => onScene("management")}>
        <Settings aria-hidden="true" />
      </button>
    </>
  );
}

function TeamFilters({
  members,
  filter,
  onFilter,
}: {
  members: readonly TeamMember[];
  filter: TeamFilter;
  onFilter: (filter: TeamFilter) => void;
}) {
  const paid = members.filter((member) => member.paid).length;
  const monthly = members.filter((member) => member.frequency === "Monthly").length;
  const weekly = members.length - monthly;
  const items: Array<{ id: TeamFilter; label: string; count: number; tone?: string }> = [
    { id: "all", label: "All", count: members.length },
    { id: "monthly", label: "Monthly", count: monthly },
    { id: "weekly", label: "Weekly", count: weekly },
  ];
  return (
    <div className="dc-filter-row">
      <div className="dc-filter-group">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cx("dc-filter", filter === item.id && "is-active")}
            onClick={() => onFilter(item.id)}
          >
            {item.label} ({item.count})
          </button>
        ))}
        <span className="dc-filter-separator" />
        <button className="dc-filter dc-disabled" type="button" disabled>Daily (0)</button>
        <button className="dc-filter dc-disabled" type="button" disabled>Flexible (0)</button>
        <span className="dc-filter-separator" />
        <button
          className={cx("dc-filter", "is-success", filter === "paid" && "is-active")}
          type="button"
          onClick={() => onFilter("paid")}
        >
          Paid ({paid})
        </button>
        <button
          className={cx("dc-filter", "is-due", filter === "due" && "is-active")}
          type="button"
          onClick={() => onFilter("due")}
        >
          To be paid ({members.length - paid})
        </button>
      </div>
      <button className="dc-month-filter" type="button">
        2026 Aug <ChevronDown aria-hidden="true" />
      </button>
    </div>
  );
}

function MemberMenu({
  member,
  onScene,
  onRemove,
}: {
  member: TeamMember;
  onScene: (scene: Scene) => void;
  onRemove: (id: TeamMemberId) => void;
}) {
  return (
    <m.div
      className="dc-card-menu"
      role="menu"
      aria-label={`${member.name} actions`}
      initial={{ opacity: 0, transform: "translate3d(0, -4px, 0) scale(0.96)" }}
      animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
      exit={{
        opacity: 0,
        transform: "translate3d(0, -2px, 0) scale(0.98)",
        transition: { duration: 0.11, ease: MOTION_EASE_OUT },
      }}
      transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
    >
      <button className="dc-card-menu-item" role="menuitem" type="button" onClick={() => onScene("member-edit")}>
        <Pencil aria-hidden="true" /> Edit
      </button>
      <button className="dc-card-menu-item" role="menuitem" type="button">
        <Link2 aria-hidden="true" /> Invites to verify
      </button>
      <button className="dc-card-menu-item" role="menuitem" type="button" onClick={() => onScene("management")}>
        <Clipboard aria-hidden="true" /> Payroll
      </button>
      <button className="dc-card-menu-item" role="menuitem" type="button" onClick={() => onScene("single-pay")}>
        <Upload aria-hidden="true" /> Pay
      </button>
      <button className="dc-card-menu-item is-danger" role="menuitem" type="button" onClick={() => onRemove(member.id)}>
        <CircleMinus aria-hidden="true" /> Remove
      </button>
    </m.div>
  );
}

function MemberCard({
  member,
  menuOpen,
  onMenu,
  onPay,
  onScene,
  onRemove,
}: {
  member: TeamMember;
  menuOpen: boolean;
  onMenu: () => void;
  onPay: (id: TeamMemberId) => void;
  onScene: (scene: Scene) => void;
  onRemove: (id: TeamMemberId) => void;
}) {
  return (
    <article className="dc-member-card">
      <div className="dc-member-head">
        <MemberAvatar member={member} />
        <div className="dc-member-copy">
          <h2 className="dc-member-name">{member.name}</h2>
          <div className="dc-tag-row">
            <span className={cx("dc-role-tag", roleClass(member.role))}>{member.role}</span>
            <span className="dc-frequency-tag">{member.frequency}</span>
          </div>
        </div>
        <button className="dc-icon-button is-card" type="button" aria-label={`Open actions for ${member.name}`} onClick={onMenu}>
          <MoreVertical aria-hidden="true" />
        </button>
        <AnimatePresence initial={false}>
          {menuOpen ? <MemberMenu key={`${member.id}-menu`} member={member} onScene={onScene} onRemove={onRemove} /> : null}
        </AnimatePresence>
      </div>
      <p className="dc-member-email">{member.email}</p>
      <div className="dc-member-payment-row">
        <span className="dc-address">{compactAddress(member.address)}</span>
        <span className="dc-token-amount"><IconLabel kind={member.token} label={money(member.amount)} /></span>
      </div>
      <div className="dc-card-actions">
        <AnimatePresence initial={false} mode="sync">
          {member.paid ? (
            <m.div
              className="dc-paid-action-group"
              key="paid"
              initial={{ opacity: 0, transform: "scale(0.96)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              transition={{ duration: 0.18, ease: MOTION_EASE_OUT }}
            >
              <button className="dc-paid-button" type="button"><Check aria-hidden="true" /> Paid</button>
              <button className="dc-mail-button" type="button" aria-label={`Email invoice to ${member.name}`} title="Send invoice by email"><Mail aria-hidden="true" /></button>
            </m.div>
          ) : (
            <m.div className="dc-unpaid-action-group" key="unpaid" exit={{ opacity: 0, transition: { duration: 0.1 } }}>
              <button className="dc-button is-black is-card-pay" type="button" onClick={() => onPay(member.id)}>Pay</button>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

function TeamPage({
  members,
  allUnpaid,
  onScene,
  onSelectMember,
  onRemove,
}: {
  members: readonly TeamMember[];
  allUnpaid?: boolean;
  onScene: (scene: Scene) => void;
  onSelectMember: (id: TeamMemberId) => void;
  onRemove: (id: TeamMemberId) => void;
}) {
  const [filter, setFilter] = useState<TeamFilter>("all");
  const [hasFiltered, setHasFiltered] = useState(false);
  const [openMenu, setOpenMenu] = useState<TeamMemberId | null>(null);
  const displayMembers = useMemo(
    () => allUnpaid ? members.map((member) => ({ ...member, paid: false })) : members,
    [allUnpaid, members],
  );
  const filtered = displayMembers.filter((member) => {
    if (filter === "monthly") return member.frequency === "Monthly";
    if (filter === "weekly") return member.frequency === "Weekly";
    if (filter === "paid") return member.paid;
    if (filter === "due") return !member.paid;
    return true;
  });

  const pay = (id: TeamMemberId) => {
    onSelectMember(id);
    onScene("payment");
  };

  return (
    <main className="dc-content">
      <PageHeading actions={<TeamActions onScene={onScene} />} />
      <TeamFilters
        members={displayMembers}
        filter={filter}
        onFilter={(nextFilter) => {
          setHasFiltered(true);
          setOpenMenu(null);
          setFilter(nextFilter);
        }}
      />
      <section className="dc-team-grid" aria-label="Team members">
        <AnimatePresence initial={false}>
          {filtered.map((member, index) => (
            <m.div
              className="dc-member-motion-shell"
              key={member.id}
              initial={enterFromBelow}
              animate={enterAtRest}
              exit={{
                opacity: 0,
                transform: "translate3d(0, -4px, 0) scale(0.985)",
                transition: { duration: 0.12, ease: MOTION_EASE_OUT },
              }}
              transition={{
                duration: 0.18,
                delay: hasFiltered ? 0 : Math.min(index * 0.022, 0.16),
                ease: MOTION_EASE_OUT,
                layout: { duration: 0.22, ease: MOTION_EASE_OUT },
              }}
              layout="position"
            >
              <MemberCard
                member={member}
                menuOpen={openMenu === member.id}
                onMenu={() => setOpenMenu((current) => current === member.id ? null : member.id)}
                onPay={pay}
                onScene={onScene}
                onRemove={(id) => {
                  setOpenMenu(null);
                  onRemove(id);
                }}
              />
            </m.div>
          ))}
        </AnimatePresence>
      </section>
    </main>
  );
}

function EmptyTeamPage({ onScene }: { onScene: (scene: Scene) => void }) {
  const shouldReduceMotion = useReducedMotion();
  const emptyTransition = (delay: number) => ({
    duration: shouldReduceMotion ? 0.08 : 0.22,
    delay: shouldReduceMotion ? 0 : delay,
    ease: MOTION_EASE_OUT,
  });

  return (
    <main className="dc-content">
      <PageHeading actions={<TeamActions onScene={onScene} />} />
      <section className="dc-empty-team">
        <m.p className="dc-empty-note" initial={enterFromBelow} animate={enterAtRest} transition={emptyTransition(0.04)}>Starts with invite or add a staff.<span aria-hidden="true">↙</span></m.p>
        <m.div className="dc-skeleton-card" initial={enterFromBelow} animate={enterAtRest} transition={emptyTransition(0.09)}>
          <div className="dc-member-head">
            <span className="dc-avatar-wrap is-placeholder" />
            <div className="dc-member-copy">
              <strong>Staff</strong>
              <span className="dc-skeleton-line is-short" />
            </div>
          </div>
          <span className="dc-skeleton-line" />
          <span className="dc-skeleton-line is-medium" />
        </m.div>
        <m.div className="dc-empty-actions" initial={enterFromBelow} animate={enterAtRest} transition={emptyTransition(0.14)}>
          <button className="dc-button is-black" type="button" onClick={() => onScene("member-add")}><Link2 aria-hidden="true" /> Invite</button>
          <button className="dc-button is-outline" type="button" onClick={() => onScene("member-add")}><Plus aria-hidden="true" /> Add</button>
        </m.div>
        <p className="dc-empty-help">The [invite] can use wallet authentication, and the staff can log<br />in to DECASH by wallet to use the employee side.</p>
      </section>
    </main>
  );
}

function PaymentSummary({
  empty,
  history,
  onHistory,
}: {
  empty?: boolean;
  history?: boolean;
  onHistory: (history: boolean) => void;
}) {
  return (
    <section className="dc-summary-bar" aria-label="Payroll summary">
      <div className="dc-stat">
        <span className="dc-stat-label">Current payment date</span>
        <strong className={cx("dc-stat-value", empty && "dc-muted")}>{empty ? "-" : "Aug 10"}</strong>
      </div>
      <div className="dc-stat">
        <span className="dc-stat-label">Total Payment</span>
        <strong className={cx("dc-stat-value", empty && "dc-muted")}>{empty ? "$0" : "$65,880.00"}</strong>
      </div>
      <div className="dc-stat">
        <span className="dc-stat-label">Awaiting</span>
        <strong className={cx("dc-stat-value", empty && "dc-muted")}>{empty ? "$0" : "$1,600.00"}</strong>
      </div>
      <div className="dc-stat">
        <span className="dc-stat-label">Paid / Employees</span>
        <strong className={cx("dc-stat-value", empty && "dc-muted")}>
          {empty ? "-" : <>9 <small>/12</small></>}
        </strong>
      </div>
      <div className="dc-segmented" aria-label="Payment view">
        <button type="button" className={!history ? "is-active" : undefined} onClick={() => onHistory(false)}>Pay</button>
        <button type="button" className={history ? "is-active" : undefined} onClick={() => onHistory(true)}>History</button>
      </div>
    </section>
  );
}

function PayerCard() {
  return (
    <section className="dc-payer-card">
      <div>
        <span className="dc-payer-label">Paying by</span>
        <span className="dc-payer-wallet">▣ 0x541...8dc1</span>
      </div>
      <div>
        <button className="dc-token-select" type="button">
          <IconLabel kind="USDT" label="USDT" /> <ChevronDown aria-hidden="true" />
        </button>
        <span className="dc-balance">Balance: <strong>25,000</strong></span>
      </div>
    </section>
  );
}

function RecipientCard({ member }: { member: TeamMember }) {
  return (
    <m.div
      className="dc-recipient-card"
      initial={{ opacity: 0, transform: "translate3d(0, 4px, 0)" }}
      animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
      exit={{ opacity: 0, transform: "translate3d(0, -2px, 0)", transition: { duration: 0.1, ease: MOTION_EASE_OUT } }}
      transition={{ duration: 0.18, ease: MOTION_EASE_OUT }}
    >
      <div className="dc-selected-member">
        <MemberAvatar member={member} selected />
        <div>
          <strong>{member.name}</strong>
          <div className="dc-tag-row">
            <span className={cx("dc-role-tag", roleClass(member.role))}>{member.role}</span>
            <span className="dc-frequency-tag">{member.frequency}</span>
          </div>
        </div>
      </div>
      <p>{member.email}</p>
      <div className="dc-member-payment-row">
        <span className="dc-address">{compactAddress(member.address)}</span>
        <span className="dc-token-amount"><IconLabel kind={member.token} label={money(member.amount)} /></span>
      </div>
    </m.div>
  );
}

function PaymentComposer({
  member,
  empty,
  onPay,
}: {
  member?: TeamMember;
  empty?: boolean;
  onPay: () => void;
}) {
  // The approved payment composition labels the blue payout asset as USDT.
  // Keep that presentation local to this static scene because the source
  // screens use different token labels for the same team member elsewhere.
  const usesBlueUsdtPresentation = member ? ["albert-cto", "andrew"].includes(member.id) : false;
  const paymentToken = usesBlueUsdtPresentation ? "USDT" : member?.token;

  return (
    <>
      <section className="dc-payment-card">
        <span className="dc-section-label">To Pay</span>
        <AnimatePresence initial={false} mode="wait">
          {empty || !member ? (
            <m.div
              key="empty-recipient"
              className="dc-skeleton-card is-payment"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16 }}
            >
              <div className="dc-member-head">
                <span className="dc-avatar-wrap is-placeholder" />
                <div className="dc-member-copy"><strong>Staff</strong><span className="dc-skeleton-line is-short" /></div>
              </div>
              <span className="dc-skeleton-line" />
              <span className="dc-skeleton-line is-medium" />
            </m.div>
          ) : <RecipientCard key={member.id} member={member} />}
        </AnimatePresence>

        <span className="dc-section-label is-amount">Paying Amount</span>
        <strong className={cx("dc-payment-amount", empty && "dc-muted")}>{empty || !member ? "0" : money(member.amount)}</strong>
        <button className={cx("dc-token-select", "is-amount", empty && "dc-disabled")} type="button" disabled={empty}>
          {empty || !member || !paymentToken ? (
            <span className="dc-token-placeholder" />
          ) : (
            <IconLabel kind={usesBlueUsdtPresentation ? "USDC" : paymentToken} label={paymentToken} />
          )}
          <ChevronDown aria-hidden="true" />
        </button>
        <label className="dc-section-label is-address" htmlFor="dc-payment-address">To</label>
        <input
          id="dc-payment-address"
          className="dc-address-field"
          readOnly
          value={empty || !member ? "" : member.address}
          placeholder="0x..."
        />
      </section>
      {empty || !member ? <div className="dc-empty-pay-spacer" /> : (
        <div className="dc-cost-row">
          <span>Est. Cost&nbsp; {`${money(member.amount)}.23 USDT`}</span>
          <span className="dc-cost-meta"><b>◉</b> <b>Ⓝ</b>　▣ $0.02　◷ ~13s　<ChevronDown aria-hidden="true" /></span>
        </div>
      )}
      <button className={cx("dc-primary-pay", empty && "dc-disabled")} type="button" onClick={onPay} disabled={empty}>Pay Now</button>
    </>
  );
}

function PersonChoice({
  member,
  active,
  onClick,
}: {
  member: TeamMember;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <m.button
      className={cx("dc-person-choice", active && "is-active")}
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, transform: "translate3d(0, 5px, 0) scale(0.96)" }}
      animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
      exit={{
        opacity: 0,
        transform: "translate3d(0, -3px, 0) scale(0.96)",
        transition: { duration: 0.11, ease: MOTION_EASE_OUT },
      }}
      whileTap={{
        transform: "translate3d(0, 0, 0) scale(0.98)",
        transition: { duration: 0.12, ease: MOTION_EASE_OUT },
      }}
      transition={{
        duration: 0.18,
        ease: MOTION_EASE_OUT,
        layout: { type: "spring", stiffness: 380, damping: 30, mass: 0.75 },
      }}
      layoutId={`payment-person-${member.id}`}
    >
      <MemberAvatar member={member} selected={active} showStatus={false} />
      <span className="dc-person-name">{member.name}</span>
    </m.button>
  );
}

function PaymentPage({
  members,
  selectedId,
  empty,
  onSelect,
  onScene,
  onPay,
}: {
  members: readonly TeamMember[];
  selectedId: TeamMemberId;
  empty?: boolean;
  onSelect: (id: TeamMemberId) => void;
  onScene: (scene: Scene) => void;
  onPay: () => void;
}) {
  const due = members.filter((member) => !member.paid);
  const paid = members.filter((member) => member.paid);
  const selected = members.find((member) => member.id === selectedId) ?? due[0] ?? members[0];
  return (
    <main className="dc-content-wide">
      <PaymentSummary empty={empty} onHistory={(show) => onScene(show ? "history" : "payment")} />
      <section className="dc-payment-layout">
        <aside className="dc-side-group is-due">
          <h2 className="dc-side-heading">To be paid ({empty ? members.length : due.length})</h2>
          <div className="dc-avatar-rail">
            {empty ? (
              <>
                <div className="dc-person-choice"><InitialAvatar label="S" /><span className="dc-person-name">Staff 1</span></div>
                <div className="dc-person-choice"><InitialAvatar label="S" /><span className="dc-person-name">Staff 2</span></div>
                <p className="dc-empty-note is-payment">Choose one you will pay<span aria-hidden="true">↙</span></p>
              </>
            ) : (
              <>
                <button className="dc-person-choice" type="button">
                  <InitialAvatar label="J" />
                  <span className="dc-person-name">John</span>
                </button>
                <AnimatePresence initial={false}>
                  {due.filter((member) => member.id !== "adam").map((member) => (
                    <PersonChoice key={member.id} member={member} active={selected.id === member.id} onClick={() => onSelect(member.id)} />
                  ))}
                </AnimatePresence>
              </>
            )}
          </div>
        </aside>

        <div className="dc-payment-column">
          <PayerCard />
          <PaymentComposer member={selected} empty={empty} onPay={onPay} />
        </div>

        <aside className="dc-side-group is-paid">
          <h2 className="dc-side-heading">Already paid ({empty ? 0 : paid.length})</h2>
          {empty ? (
            <p className="dc-empty-paid">The people you paid will be listed here</p>
          ) : (
            <div className="dc-paid-grid">
              <AnimatePresence initial={false}>
                {paid.filter((member) => member.id !== "tai").map((member) => (
                  <m.div
                    className="dc-person-choice"
                    key={member.id}
                    layoutId={`payment-person-${member.id}`}
                    initial={{ opacity: 0, transform: "translate3d(0, 5px, 0) scale(0.9)" }}
                    animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{
                      duration: 0.2,
                      ease: MOTION_EASE_OUT,
                      layout: { type: "spring", stiffness: 380, damping: 30, mass: 0.75 },
                    }}
                  >
                    <MemberAvatar member={member} showStatus={false} />
                    <span className="dc-person-name">{member.name}</span>
                  </m.div>
                ))}
              </AnimatePresence>
              <div className="dc-person-choice">
                <InitialAvatar label="A" />
                <span className="dc-person-name">Andrew</span>
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function HistoryPage({ onScene }: { onScene: (scene: Scene) => void }) {
  const [frequency, setFrequency] = useState<"All" | PaymentFrequency>("Monthly");
  const [period, setPeriod] = useState("2026-08-01");
  const rows = PAYMENT_HISTORY_ROWS.filter((row) => {
    const matchesFrequency = frequency === "All" || row.frequency === frequency;
    return matchesFrequency && (period === "2026-08-01" || row.periodDate === period);
  });
  return (
    <main className="dc-content-wide">
      <PaymentSummary history onHistory={(show) => onScene(show ? "history" : "payment")} />
      <section className="dc-history-layout">
        <aside className="dc-history-sidebar">
          <span className="dc-section-label">Payment Period</span>
          <div className="dc-history-tabs">
            {(["All", "Monthly", "Weekly"] as const).map((item) => (
              <button key={item} className={frequency === item ? "is-active" : undefined} type="button" onClick={() => setFrequency(item)}>{item}</button>
            ))}
          </div>
          <div className="dc-period-list">
            {PAYMENT_PERIODS.map((item) => (
              <button
                key={item.value}
                className={cx("dc-period-button", period === item.value && "is-active")}
                type="button"
                onClick={() => setPeriod(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="dc-history-panel">
          <span className="dc-section-label">Payment History</span>
          <div className="dc-table-wrap">
            <table className="dc-history-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Frequency</th>
                  <th>Address</th>
                  <th>Network</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Payment Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="dc-person-cell">
                        <img className="dc-mini-avatar" src={row.avatarPath} alt="" />
                        <span><strong>{row.name}</strong><small>{row.role}</small></span>
                      </span>
                    </td>
                    <td>{row.frequency}</td>
                    <td>{compactAddress(row.address)}</td>
                    <td><IconLabel kind={row.network} label={row.network} /></td>
                    <td><IconLabel kind={row.token} label={money(row.amount)} /></td>
                    <td><span className={cx("dc-status", row.status === "paid" ? "is-paid" : "is-pending")}><span />{row.status === "paid" ? "Paid" : "Pending"}</span></td>
                    <td>{row.paymentDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? <p className="dc-empty-paid is-table">No payments match this period.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function DepartmentCard({ group, members }: { group: (typeof DEPARTMENT_GROUPS)[number]; members: readonly TeamMember[] }) {
  const groupMembers = group.memberIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is TeamMember => Boolean(member));
  return (
    <section className="dc-department-card">
      <div className="dc-department-head">
        <h2>{group.name} ({group.headcount}) <span>${money(group.monthlyTotal)} <small>/ month</small></span></h2>
        <div className="dc-department-actions">
          <button className="dc-round-button" type="button" aria-label={`Copy ${group.name} invite link`} title="Copy invite link"><Link2 aria-hidden="true" /></button>
          <button className="dc-round-button" type="button" aria-label={`Add to ${group.name}`} title="Add team member"><Plus aria-hidden="true" /></button>
          <button className="dc-round-button" type="button" aria-label={`Configure ${group.name}`} title="Department settings"><Settings aria-hidden="true" /></button>
        </div>
      </div>
      <div className="dc-table-wrap">
        <table className="dc-management-table">
          <thead>
            <tr>
              <th>Name</th><th>Salary</th><th>Frequency</th><th>Last Pay Date</th><th>Next Pay Date</th><th>Network</th><th>Token</th><th>Address</th><th />
            </tr>
          </thead>
          <tbody>
            {groupMembers.map((member, index) => {
              const marketingOverrides = group.id === "marketing" ? {
                andrew: { name: "Andrew", role: "Developer", amount: 1_000, frequency: "Weekly" as const },
                billy: { name: "Billy Watson", role: "Developer", amount: 5_000, frequency: "Monthly" as const },
                blake: { name: "Blake Morris", role: "Marketing", amount: 3_000, frequency: "Monthly" as const },
              }[member.id as "andrew" | "billy" | "blake"] : undefined;
              const isRepeatedTai = group.id === "development" && index === 4;
              const displayName = isRepeatedTai ? "Tai Verdes" : marketingOverrides?.name ?? member.name;
              const displayRole = group.id === "development" ? "Developer" : marketingOverrides?.role ?? member.role;
              const displayAmount = isRepeatedTai ? 3_000 : marketingOverrides?.amount ?? member.amount;
              const displayFrequency = marketingOverrides?.frequency ?? member.frequency;

              return (
              <tr key={member.id}>
                <td>
                  <span className="dc-person-cell">
                    <MemberAvatar member={member} compact showStatus={false} />
                    <span><strong>{displayName}</strong><small>{displayRole}</small></span>
                  </span>
                </td>
                <td>{money(displayAmount)}</td>
                <td>{displayFrequency}</td>
                <td>
                  <span className={cx("dc-date-badge", index < 2 && group.id === "marketing" ? "is-warning" : "is-success")}>
                    {index < 2 && group.id === "marketing" ? <CircleAlert aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                    {new Date(member.lastPayDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </td>
                <td>{new Date(member.nextPayDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td><IconLabel kind={member.network} label={member.network} /></td>
                <td><IconLabel kind={member.token} label={member.token} /></td>
                <td>{compactAddress(member.address)}</td>
                <td><button className="dc-icon-button is-card" type="button" aria-label={`Actions for ${member.name}`}><MoreVertical aria-hidden="true" /></button></td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ManagementPage({ members, onScene }: { members: readonly TeamMember[]; onScene: (scene: Scene) => void }) {
  return (
    <main className="dc-content dc-management-list">
      <PageHeading compact actions={(
        <button className="dc-button is-outline is-dashed" type="button" onClick={() => onScene("member-add")}><Plus aria-hidden="true" /> Department</button>
      )} />
      <div className="dc-management-cards">
        {DEPARTMENT_GROUPS.map((group) => <DepartmentCard key={group.id} group={group} members={members} />)}
      </div>
    </main>
  );
}

function TeamPanel({
  members,
  selectedId,
  onSelect,
  onScene,
  menuOpen,
  onMenu,
}: {
  members: readonly TeamMember[];
  selectedId?: TeamMemberId;
  onSelect: (id: TeamMemberId) => void;
  onScene: (scene: Scene) => void;
  menuOpen?: boolean;
  onMenu?: () => void;
}) {
  const byId = new Map(members.map((member) => [member.id, member]));
  const orderedIds: readonly TeamMemberId[] = ["andrew", "billy", "blake", "adam", "tai", "hannah", "albert", "zoey"];
  const orderedMembers = orderedIds
    .map((id) => byId.get(id))
    .filter((member): member is TeamMember => Boolean(member));
  const repeatedAndrew = byId.get("andrew");
  const repeatedAlbert = byId.get("albert");
  const repeatedZoey = byId.get("zoey");
  const panelEntries = [
    ...orderedMembers.map((member) => ({ key: member.id, member, initial: undefined as string | undefined })),
    ...(repeatedAndrew ? [{ key: "andrew-placeholder", member: repeatedAndrew, initial: "A" }] : []),
    ...(repeatedAlbert ? [{ key: "albert-repeat", member: repeatedAlbert, initial: undefined }] : []),
    ...(repeatedZoey ? [{ key: "zoey-repeat", member: repeatedZoey, initial: undefined }] : []),
  ];

  return (
    <aside className="dc-team-panel">
      <div className="dc-team-panel-head"><h2>Team ({members.length})</h2><Settings aria-hidden="true" /></div>
      <div className="dc-team-panel-actions">
        <button className="dc-button is-black" type="button" onClick={() => onScene("member-add")}><Link2 aria-hidden="true" /> Invite</button>
        <button className="dc-button is-outline is-dashed" type="button" onClick={() => onScene("member-add")}><Plus aria-hidden="true" /> Add</button>
      </div>
      <div className="dc-member-list">
        {panelEntries.map(({ key, member, initial }, index) => {
          const showsPaid = index >= 6;
          return (
          <div className={cx("dc-member-list-row", member.id === selectedId && index === 0 && "is-selected")} key={key}>
            <button className="dc-list-person" type="button" onClick={() => onSelect(member.id)}>
              {initial ? <InitialAvatar label={initial} compact /> : <MemberAvatar member={member} compact showStatus={false} />}
              <span><strong>{member.name}</strong><small>{index < 6 ? (member.id === "blake" ? "Marketing" : member.id === "adam" ? "Community" : "Developer") : "Developer"}</small></span>
            </button>
            <button className={cx("dc-list-action", showsPaid && "is-paid")} type="button" onClick={() => onSelect(member.id)}>
              {showsPaid ? <><Check aria-hidden="true" /> Paid</> : "Pay"}
            </button>
            <button className="dc-icon-button is-card" type="button" aria-label={`Open actions for ${member.name}`} onClick={index === 0 ? onMenu : undefined}>
              <MoreVertical aria-hidden="true" />
            </button>
            {index === 0 ? (
              <AnimatePresence initial={false}>
                {menuOpen ? (
                  <MemberMenu
                    key={`${member.id}-panel-menu`}
                    member={member}
                    onScene={(next) => {
                      if (next === "member-edit") onSelect(member.id);
                      onScene(next);
                    }}
                    onRemove={() => {}}
                  />
                ) : null}
              </AnimatePresence>
            ) : null}
          </div>
          );
        })}
      </div>
    </aside>
  );
}

function MemberFormPage({
  mode,
  members,
  selectedId,
  onSelect,
  onScene,
}: {
  mode: "add" | "edit";
  members: readonly TeamMember[];
  selectedId: TeamMemberId;
  onSelect: (id: TeamMemberId) => void;
  onScene: (scene: Scene) => void;
}) {
  const selectedSource = members.find((member) => member.id === selectedId) ?? members[0];
  const source = mode === "add"
    ? members.find((member) => member.id === "andrew") ?? selectedSource
    : selectedSource;
  const referenceSource = source.id === "andrew"
    ? { ...source, role: "Developer", amount: 5_000, frequency: "Monthly" as const, token: "USDT" as const, network: "Near" as const }
    : source;
  const [name, setName] = useState(referenceSource.name);
  const [role, setRole] = useState(referenceSource.role);
  const [email, setEmail] = useState(referenceSource.email);
  const [amount, setAmount] = useState(String(referenceSource.amount));
  const [frequency, setFrequency] = useState<PaymentFrequency>(referenceSource.frequency);
  const [token, setToken] = useState(referenceSource.token);
  const [network, setNetwork] = useState(referenceSource.network);
  const [address, setAddress] = useState(referenceSource.address);
  const [menuOpen, setMenuOpen] = useState(mode === "edit");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onScene("team");
  };

  return (
    <main className="dc-content dc-member-form-page">
      <PageHeading />
      <section className="dc-form-layout">
        <TeamPanel
          members={members}
          selectedId={mode === "edit" ? referenceSource.id : undefined}
          onSelect={onSelect}
          onScene={onScene}
          menuOpen={menuOpen}
          onMenu={() => setMenuOpen((current) => !current)}
        />
        <div className="dc-form-column">
          <button className="dc-back-link" type="button" onClick={() => onScene("team")}><ArrowLeft aria-hidden="true" /> {mode === "edit" ? "Edit" : "Add"}</button>
          <form onSubmit={submit}>
            <div className="dc-form-card">
              <div className="dc-form-avatar">
                {mode === "edit" ? <MemberAvatar member={referenceSource} showStatus={false} /> : <span className="dc-avatar-wrap is-placeholder"><Camera aria-hidden="true" /></span>}
              </div>
              <div className="dc-field-grid">
                <label className="dc-field dc-field-full">
                  <span className="dc-label">Name (Required)</span>
                  <input className="dc-input" value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
                <label className="dc-field dc-field-full">
                  <span className="dc-label">Role</span>
                  <input className="dc-input" value={role} onChange={(event) => setRole(event.target.value)} />
                </label>
                <label className="dc-field dc-field-full">
                  <span className="dc-label">Email</span>
                  <input className="dc-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label className="dc-field">
                  <span className="dc-label">Amount{mode === "add" ? " (Required)" : ""}</span>
                  <input className="dc-input" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} required />
                </label>
                <label className="dc-field">
                  <span className="dc-label">Frequency (Required)</span>
                  <span className="dc-select">
                    <select value={frequency} onChange={(event) => setFrequency(event.target.value as PaymentFrequency)}>
                      <option>Monthly</option><option>Weekly</option>
                    </select><ChevronDown aria-hidden="true" />
                  </span>
                </label>
                <label className="dc-field">
                  <span className="dc-label">Received Token&amp;Network (Required)</span>
                  <span className="dc-select">
                    <select value={token} onChange={(event) => setToken(event.target.value as TeamMember["token"])}>
                      <option>USDT</option><option>USDC</option>
                    </select><ChevronDown aria-hidden="true" />
                  </span>
                </label>
                <label className="dc-field is-network">
                  <span className="dc-label" aria-hidden="true">&nbsp;</span>
                  <span className="dc-select">
                    <select value={network} onChange={(event) => setNetwork(event.target.value as TeamMember["network"])}>
                      <option>Near</option><option>Arbitrum</option><option>Ethereum</option><option>BNB</option>
                    </select><ChevronDown aria-hidden="true" />
                  </span>
                </label>
                <label className="dc-field dc-field-full">
                  <span className="dc-label">To</span>
                  <input className="dc-input" value={address} onChange={(event) => setAddress(event.target.value as TeamMember["address"])} />
                </label>
              </div>
            </div>
            <button className="dc-form-submit" type="submit">{mode === "edit" ? "Save" : "Add"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}

function SinglePayPage({
  members,
  selectedId,
  onSelect,
  onScene,
  onPay,
}: {
  members: readonly TeamMember[];
  selectedId: TeamMemberId;
  onSelect: (id: TeamMemberId) => void;
  onScene: (scene: Scene) => void;
  onPay: () => void;
}) {
  const effectiveSelectedId = selectedId === "albert-cto" ? "andrew" : selectedId;
  const selected = members.find((member) => member.id === effectiveSelectedId) ?? members[0];
  return (
    <main className="dc-content dc-single-pay-page">
      <PageHeading compact />
      <section className="dc-form-layout is-single-pay">
        <TeamPanel members={members} selectedId={selected.id} onSelect={onSelect} onScene={onScene} />
        <div className="dc-form-column dc-legacy-payment">
          <PayerCard />
          <PaymentComposer member={selected} onPay={onPay} />
        </div>
      </section>
    </main>
  );
}

function QuickPayPanel({
  members,
  selectedId,
  onSelect,
}: {
  members: readonly TeamMember[];
  selectedId: TeamMemberId;
  onSelect: (id: TeamMemberId) => void;
}) {
  const quickIds: readonly TeamMemberId[] = ["andrew", "billy", "blake", "adam", "tai"];
  const quickMembers = quickIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is TeamMember => Boolean(member));
  const effectiveSelectedId = selectedId === "albert-cto" ? "andrew" : selectedId;
  const selected = members.find((member) => member.id === effectiveSelectedId) ?? quickMembers[0] ?? members[0];
  return (
    <section className="dc-quick-pay">
      <h2>Quick Pay</h2>
      <div className="dc-chip-row">
        {quickMembers.map((member) => (
          <button className={cx("dc-chip", selected.id === member.id && "is-active")} type="button" key={member.id} onClick={() => onSelect(member.id)}>
            <MemberAvatar member={member} compact showStatus={false} /> {member.id === "billy" ? "Bill Genies" : member.name}
          </button>
        ))}
      </div>
      <span className="dc-section-label">Recipient</span>
      <AnimatePresence initial={false} mode="wait">
        <m.div
          className="dc-quick-recipient"
          key={selected.id}
          initial={{ opacity: 0, transform: "translate3d(0, 4px, 0)" }}
          animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
          exit={{ opacity: 0, transform: "translate3d(0, -2px, 0)", transition: { duration: 0.1, ease: MOTION_EASE_OUT } }}
          transition={{ duration: 0.18, ease: MOTION_EASE_OUT }}
        >
          <MemberAvatar member={selected} showStatus={false} />
          <div><strong>{selected.name}</strong><div className="dc-tag-row"><span className={cx("dc-role-tag", roleClass(selected.role))}>{selected.role}</span><span className="dc-frequency-tag">{selected.frequency}</span><span className="dc-verified-address"><CheckCircle2 aria-hidden="true" /> {compactAddress(selected.address)}</span></div></div>
          <span className="dc-token-amount"><IconLabel kind={selected.token} label={`${money(selected.amount)} / month`} /></span>
        </m.div>
      </AnimatePresence>
      <span className="dc-section-label is-dashboard">Compensation</span>
      <div className="dc-dashboard-amount"><strong>{money(selected.amount)}</strong><button className="dc-token-select" type="button"><IconLabel kind={selected.id === "andrew" ? "USDC" : selected.token} label={selected.id === "andrew" ? "USDT" : selected.token} /><ChevronDown aria-hidden="true" /></button></div>
      <div className="dc-divider" />
      <span className="dc-section-label is-dashboard">You Pay</span>
      <div className="dc-dashboard-amount is-small"><strong>{money(selected.amount)}.23</strong><button className="dc-token-select" type="button"><IconLabel kind="USDT" label="USDT" /><ChevronDown aria-hidden="true" /></button></div>
      <div className="dc-dashboard-wallet"><span>▣ 0x541...8dc1</span><span className="dc-balance">Balance: <strong>25,000</strong></span></div>
      <div className="dc-divider" />
    </section>
  );
}

function RecipientList({ members, onSelect, onScene }: { members: readonly TeamMember[]; onSelect: (id: TeamMemberId) => void; onScene: (scene: Scene) => void }) {
  const byId = new Map(members.map((member) => [member.id, member]));
  const recipientEntries = [
    { key: "andrew", member: byId.get("andrew"), initial: false, verified: true, role: "Developer" },
    { key: "andrew-placeholder", member: byId.get("andrew"), initial: true, verified: false, role: "Developer" },
    { key: "blake", member: byId.get("blake"), initial: false, verified: true, role: "Marketing" },
    { key: "adam", member: byId.get("adam"), initial: false, verified: true, role: "Community" },
    { key: "tai", member: byId.get("tai"), initial: false, verified: true, role: "Developer" },
    { key: "hannah", member: byId.get("hannah"), initial: false, verified: true, role: "Developer" },
  ].filter((entry): entry is typeof entry & { member: TeamMember } => Boolean(entry.member));

  return (
    <section className="dc-recipient-list">
      <div className="dc-recipient-list-head"><h2>Recipients</h2><button type="button" onClick={() => onScene("team")}>View All <ArrowRight aria-hidden="true" /></button></div>
      <div>
        {recipientEntries.map(({ key, member, initial, verified, role }, index) => (
          <div className={cx("dc-member-list-row", index === 0 && "is-selected")} key={key}>
            <div className="dc-list-person">{initial ? <InitialAvatar label="A" compact /> : <MemberAvatar member={member} compact showStatus={false} />}<span><strong>{member.name}</strong><small>{role}</small></span></div>
            <span className={cx("dc-status", verified ? "is-paid" : "is-neutral")}><span />{verified ? "Verified" : "Unverified"}</span>
            <button className="dc-list-action" type="button" onClick={() => { onSelect(member.id); onScene("payment"); }}>Pay</button>
            <button className="dc-icon-button is-card" type="button" aria-label={`Actions for ${member.name}`}><MoreVertical aria-hidden="true" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardPage({
  members,
  selectedId,
  onSelect,
  onScene,
}: {
  members: readonly TeamMember[];
  selectedId: TeamMemberId;
  onSelect: (id: TeamMemberId) => void;
  onScene: (scene: Scene) => void;
}) {
  return (
    <main className="dc-content-wide dc-dashboard">
      <h1 className="dc-dashboard-heading">Hi! Eureka Team <button className="dc-round-button" type="button" aria-label="Switch team"><ChevronDown aria-hidden="true" /></button></h1>
      <section className="dc-metric-strip">
        <div><span>Next Round Payroll</span><strong>$65,880.00</strong></div>
        <div><span>Next Payroll Date</span><strong>Sep 1, 2026</strong></div>
        <div><span>Recipients</span><strong>{members.length}</strong></div>
      </section>
      <section className="dc-dashboard-grid">
        <QuickPayPanel members={members} selectedId={selectedId} onSelect={onSelect} />
        <RecipientList members={members} onSelect={onSelect} onScene={onScene} />
      </section>
    </main>
  );
}

function DecashPrototypeContent() {
  const [scene, setSceneState] = useState<Scene>(readScene);
  const [members, setMembers] = useState(() => TEAM_MEMBERS.map((member) => ({ ...member })));
  const [selectedId, setSelectedId] = useState<TeamMemberId>(() => scene === "member-edit" ? "andrew" : "albert-cto");
  const shouldReduceMotion = useReducedMotion();

  const navigate = (next: Scene) => {
    const url = new URL(window.location.href);
    url.searchParams.set("scene", next);
    window.history.replaceState({}, "", url);
    setSceneState(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  useEffect(() => {
    document.title = `DECASH · ${scene}`;
  }, [scene]);

  const removeMember = (id: TeamMemberId) => {
    setMembers((current) => current.filter((member) => member.id !== id));
  };

  const paySelected = () => {
    setMembers((current) => current.map((member) => member.id === selectedId ? { ...member, paid: true } : member));
  };

  let page: ReactNode;
  if (scene === "team-empty") {
    page = <EmptyTeamPage onScene={navigate} />;
  } else if (scene === "team" || scene === "team-unpaid") {
    page = <TeamPage members={members} allUnpaid={scene === "team-unpaid"} onScene={navigate} onSelectMember={setSelectedId} onRemove={removeMember} />;
  } else if (scene === "management") {
    page = <ManagementPage members={members} onScene={navigate} />;
  } else if (scene === "member-add" || scene === "member-edit") {
    page = <MemberFormPage mode={scene === "member-add" ? "add" : "edit"} members={members} selectedId={selectedId} onSelect={setSelectedId} onScene={navigate} />;
  } else if (scene === "history") {
    page = <HistoryPage onScene={navigate} />;
  } else if (scene === "single-pay") {
    page = <SinglePayPage members={members} selectedId={selectedId} onSelect={setSelectedId} onScene={navigate} onPay={paySelected} />;
  } else if (scene === "dashboard") {
    page = <DashboardPage members={members} selectedId={selectedId} onSelect={setSelectedId} onScene={navigate} />;
  } else {
    page = <PaymentPage members={members} selectedId={selectedId} empty={scene === "payment-empty"} onSelect={setSelectedId} onScene={navigate} onPay={paySelected} />;
  }

  return (
    <div className="decash-prototype">
      <a className="dc-skip-link" href="#decash-main">Skip to content</a>
      <DecashHeader active={primaryView(scene)} onNavigate={navigate} />
      <div id="decash-main">
        <AnimatePresence initial={false} mode="sync">
          <m.div
            className="dc-scene-frame"
            data-scene={scene}
            key={scene}
            initial={shouldReduceMotion || scene === "team-empty" ? { opacity: 0 } : { opacity: 0, transform: "translate3d(0, 8px, 0)" }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, transform: "translate3d(0, 0, 0)" }}
            exit={shouldReduceMotion ? {
              opacity: 0,
              pointerEvents: "none",
              transition: { duration: 0.06 },
            } : {
              opacity: 0,
              transform: "translate3d(0, -4px, 0)",
              pointerEvents: "none",
              transition: { duration: 0.12, ease: MOTION_EASE_OUT },
            }}
            transition={{ duration: shouldReduceMotion ? 0.08 : 0.22, ease: MOTION_EASE_OUT }}
          >
            {page}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function DecashPrototype() {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        <DecashPrototypeContent />
      </LazyMotion>
    </MotionConfig>
  );
}
