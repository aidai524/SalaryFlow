import { useEffect, useState } from "react";
import { useMyPaymentsQuery, useMyPayoutQuery } from "@/hooks/use-employee-api";
import { useAuthStore } from "@/stores/auth";
import { ChangePasswordDialog } from "@/views/auth/ChangePasswordDialog";
import { AddRecipientDialog } from "@/views/admin/recipients/components/AddRecipientDialog";
import { MyPayHistoryTable } from "./my-pay/components/MyPayHistoryTable";
import { MyPayProfileCard } from "./my-pay/components/MyPayProfileCard";
import { MyPayStats } from "./my-pay/components/MyPayStats";
import { firstName } from "./my-pay/utils";

export function MyPayView() {
  const user = useAuthStore((state) => state.user);
  const mustChangePassword = user?.must_change_password;
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const payoutQuery = useMyPayoutQuery();
  const paymentsQuery = useMyPaymentsQuery();
  const payout = payoutQuery.data?.payout ?? null;
  const payments = paymentsQuery.data?.payments ?? [];

  useEffect(() => {
    document.title = "DECash · My Pay";
  }, []);

  useEffect(() => {
    if (mustChangePassword) {
      setChangePasswordOpen(true);
    }
  }, [mustChangePassword]);

  return (
    <>
      <div className="mx-auto w-full max-w-[1412px] px-4 pb-10 sm:px-6 md:px-0">
        <h1 className="mb-4 font-montserrat text-[26px] font-medium text-black">
          Hi! {firstName(user?.name || payout?.name)}
        </h1>

        <MyPayStats payout={payout} isLoading={payoutQuery.isLoading} />

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(280px,389px)_minmax(0,1fr)]">
          {payout ? (
            <MyPayProfileCard payout={payout} onEdit={() => setEditOpen(true)} />
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-[20px] border border-white bg-[#fdfdfd] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] font-montserrat text-[14px] text-[#909090]">
              {payoutQuery.isLoading ? "Loading profile…" : "No employee profile linked"}
            </div>
          )}
          <MyPayHistoryTable
            payments={payments}
            isLoading={paymentsQuery.isLoading}
          />
        </div>
      </div>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />

      {payout ? (
        <AddRecipientDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          variant="self"
          employee={{
            id: payout.id,
            user_id: user?.id ?? null,
            email: payout.email,
            name: payout.name,
            role_title: payout.role_title || "",
            location: "",
            employee_type: payout.employee_type,
            token: payout.token,
            network: payout.network,
            amount_minor: payout.amount_minor,
            endpoint: payout.endpoint,
            status: payout.status,
            payout_verified_at: payout.payout_verified_at,
            last_paid_at: payout.last_paid_at,
            created_at: payout.created_at,
            payment_cadence: payout.payment_cadence,
            payment_date_key: payout.payment_date_key,
            nextPayday: payout.nextPayday,
            nextPaydayDisplay: payout.nextPaydayDisplay,
          }}
          teamCadence="monthly"
          teamPaymentDate="every_1st"
        />
      ) : null}
    </>
  );
}
