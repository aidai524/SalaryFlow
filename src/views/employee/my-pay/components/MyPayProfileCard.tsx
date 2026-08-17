import type { ReactNode } from "react";
import { IdentityAvatar, identityAvatarSeed } from "@/components/IdentityAvatar";
import { IconAlert } from "@/components/icons/alert";
import { IconCheck } from "@/components/icons/check";
import { IconPen } from "@/components/icons/pen";
import { getChainByNetwork } from "@/config/chains";
import type { MyPayout } from "@/lib/api";
import { formatAddress, formatDate } from "@/lib/format";
import { tokenLogoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";
import { CARD_CLASS } from "../config";
import {
  formatCompensation,
  isVerified,
  roleBadgeAbbrev,
  roleBadgeColor,
  scheduleLabel,
  typeLabel,
} from "../utils";

export function MyPayProfileCard({
  payout,
  onEdit,
  className,
}: {
  payout: MyPayout;
  onEdit: () => void;
  className?: string;
}) {
  const verified = isVerified(payout);
  const chain = getChainByNetwork(payout.network);

  return (
    <aside
      className={cn(
        "flex h-full min-h-[420px] w-full flex-col overflow-hidden",
        CARD_CLASS,
        className,
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        <IdentityAvatar
          seed={identityAvatarSeed(payout)}
          src={payout.avatar_url}
          size={60}
          alt=""
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-montserrat text-[16px] font-medium text-black">
              {payout.name}
            </h3>
            {verified ? (
              <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[12px] bg-[#0ed000]/10 p-[6px_10px_6px_6px] font-montserrat text-[12px] text-[#0cb400]">
                <span className="size-3 shrink-0 rounded-full bg-[#0ED000] flex items-center justify-center">
                  <IconCheck className="size-1.5 text-white" />
                </span>
                Verified
              </span>
            ) : (
              <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[12px] bg-[#aaa]/10 px-2 font-montserrat text-[12px] text-[#aaa]">
                <span className="size-3 shrink-0 rounded-full bg-[#AAA] flex items-center justify-center">
                  <IconAlert className="size-1.5 text-white" />
                </span>
                Unverified
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {payout.role_title ? (
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-[12px] px-2.5 font-montserrat text-[12px]",
                  roleBadgeColor(payout.role_title),
                )}
              >
                {roleBadgeAbbrev(payout.role_title)}
              </span>
            ) : null}
            <span className="inline-flex h-6 items-center rounded-[12px] border border-black/10 px-2.5 font-montserrat text-[12px] text-[#909090]">
              {typeLabel(payout.employee_type)}
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <dl className="space-y-[30px]">
          <DetailRow
            label="Compensation"
            value={payout.amount_minor > 0 ? formatCompensation(payout) : "—"}
          />
          <DetailRow
            label="Payment Schedule"
            value={scheduleLabel(payout.payment_cadence)}
          />
          <DetailRow
            label="Payout Preference"
            value={
              payout.token ? (
                <span className="inline-flex items-center gap-1.5">
                  <img
                    src={tokenLogoUrl(payout.token)}
                    alt=""
                    className="size-4 rounded-full object-cover"
                  />
                  <span>
                    {payout.token} · {chain?.chainName || payout.network || "—"}
                  </span>
                </span>
              ) : (
                "—"
              )
            }
          />
          <DetailRow
            label="Destination Wallet"
            value={
              payout.endpoint ? (
                <span className="flex flex-col items-end gap-1">
                  <span>{formatAddress(payout.endpoint, 5, 5)}</span>
                  {verified ? (
                    <span className="font-montserrat text-[12px] font-normal text-[#0cb400]">
                      Verified by wallet
                    </span>
                  ) : null}
                </span>
              ) : (
                "—"
              )
            }
          />
          <DetailRow
            label="Next Payment"
            value={
              payout.nextPaydayDisplay
              || (payout.nextPayday ? formatDate(payout.nextPayday) : "—")
            }
          />
        </dl>
      </div>

      <div className="px-5 py-4 flex justify-center">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-2 font-montserrat text-[14px] font-normal text-[#606060] transition-colors hover:text-black"
        >
          <IconPen className="size-3" />
          Edit
        </button>
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 font-montserrat text-[14px] font-medium text-[#606060]">{label}</dt>
      <dd className="min-w-0 text-right font-montserrat text-[14px] font-medium text-black">
        {value}
      </dd>
    </div>
  );
}
