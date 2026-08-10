import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrgContextQuery, useUpdateTeamMutation } from "@/hooks/use-org-api";
import { ApiError, type TeamPaymentDateKey, type TeamPaymentSchedule } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import {
  CREATE_TEAM_BG,
  DEFAULT_PAYMENT_SCHEDULE,
  DEFAULT_REMINDER_LEAD_DAYS,
  PAYMENT_SCHEDULE_OPTIONS,
  paymentReminderHelper,
} from "./create-team/config";
import { defaultPaymentDateForSchedule, paymentDateOptionsForSchedule } from "./create-team/utils";

const SELECT_ICON = (
  <img src="/icons/to-down.svg" alt="" width={10} height={4} className="pointer-events-none size-auto shrink-0" />
);

export function CreateTeamView() {
  const navigate = useNavigate();
  const orgId = useAuthStore((state) => state.orgId);
  const orgName = useAuthStore((state) => state.orgName);
  const refreshWorkspaceContext = useAuthStore((state) => state.refreshWorkspaceContext);

  const [schedule, setSchedule] = useState<TeamPaymentSchedule>(DEFAULT_PAYMENT_SCHEDULE);
  const [paymentDate, setPaymentDate] = useState<TeamPaymentDateKey>(
    defaultPaymentDateForSchedule(DEFAULT_PAYMENT_SCHEDULE),
  );

  const orgContextQuery = useOrgContextQuery(orgId);
  const reminderLeadDefaults = orgContextQuery.data?.reminderLeadDefaults ?? DEFAULT_REMINDER_LEAD_DAYS;
  const reminderDays = reminderLeadDefaults[schedule];

  const updateTeamMutation = useUpdateTeamMutation(orgId);
  const dateOptions = paymentDateOptionsForSchedule(schedule);

  const onScheduleChange = (value: TeamPaymentSchedule) => {
    setSchedule(value);
    setPaymentDate(defaultPaymentDateForSchedule(value));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await updateTeamMutation.mutateAsync({
        paymentSchedule: schedule,
        paymentDate,
      });
      await refreshWorkspaceContext();
      navigate("/pay", { replace: true });
    } catch {
      // Error rendered from mutation state.
    }
  };

  const errorMessage =
    updateTeamMutation.error instanceof ApiError
      ? updateTeamMutation.error.message
      : updateTeamMutation.error
        ? "Unable to set up team payment preferences"
        : null;

  return (
    <div
      className="relative min-h-[calc(100svh-5.5rem)] overflow-hidden px-4 pb-10 sm:px-6 md:px-10 lg:px-[50px]"
      style={{ backgroundColor: CREATE_TEAM_BG }}
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

      <div className="relative z-10 mx-auto flex w-full max-w-[360px] flex-col items-center pt-6 sm:pt-10">
        <img
          src="/logo.svg"
          alt="DECash"
          className="h-auto w-[176px]"
          width={176}
          height={52}
        />

        <p className="mt-4 font-rubik-one text-lg uppercase leading-none text-black">
          Pay Beyond Borders.
        </p>

        <div className="relative mt-10 w-full sm:mt-30">
          <div className="pointer-events-none absolute -top-10 left-0 flex items-end gap-1 sm:-top-12 sm:-left-8">
            <p className="-rotate-4 font-montserrat text-sm text-black sm:text-base">
              Starts with creating your team.
            </p>
            <img
              src="/icons/to-bot-right.svg"
              alt=""
              aria-hidden
              className="mb-[-6px] h-[37px] w-4 shrink-0 -rotate-[0deg] absolute left-[-5%] top-[100%]"
            />
          </div>

          <form
            onSubmit={submit}
            className="flex w-full flex-col rounded-[20px] border border-white bg-[#fdfdfd] px-5 pt-5 pb-5 shadow-[0_0_20px_rgba(0,0,0,0.06)]"
          >
            <label className="font-montserrat text-sm font-medium text-[#909090]">
              Team Name
            </label>
            <div className="mt-1.5 flex h-10 items-center rounded-[6px] border border-[#e3e3e3] bg-[#f6f6f6] px-3 font-montserrat text-sm font-medium text-black">
              <span className="truncate">{orgName || "Your team"}</span>
            </div>

            <label className="mt-5 font-montserrat text-sm font-medium text-[#909090]">
              Payment Schedule
            </label>
            <Select
              value={schedule}
              onValueChange={(value) => onScheduleChange(value as TeamPaymentSchedule)}
            >
              <SelectTrigger
                icon={SELECT_ICON}
                className="mt-1.5 h-10 w-full rounded-[6px] border-[#e3e3e3] bg-white px-3 font-montserrat text-sm font-medium text-black shadow-none focus-visible:ring-0 data-[size=default]:h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="font-montserrat">
                {PAYMENT_SCHEDULE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="mt-5 font-montserrat text-sm font-medium text-[#909090]">
              Payment Date
            </label>
            <Select
              value={paymentDate}
              onValueChange={(value) => setPaymentDate(value as TeamPaymentDateKey)}
            >
              <SelectTrigger
                icon={SELECT_ICON}
                className="mt-1.5 h-10 w-full rounded-[6px] border-[#e3e3e3] bg-white px-3 font-montserrat text-sm font-medium text-black shadow-none focus-visible:ring-0 data-[size=default]:h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="font-montserrat">
                {dateOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="mt-3 font-montserrat text-xs leading-normal text-[#909090]">
              {paymentReminderHelper(reminderDays)}
            </p>

            {errorMessage && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Setup failed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={updateTeamMutation.isPending || !orgName}
              className="mt-5 h-[50px] w-full rounded-[12px] bg-black font-montserrat text-base font-medium text-white shadow-[0_0_6px_rgba(0,0,0,0.06)] hover:bg-black/90"
            >
              {updateTeamMutation.isPending ? "Setting up…" : "Set up"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
