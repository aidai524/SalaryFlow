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
import { useUpdateTeamMutation } from "@/hooks/use-org-api";
import { ApiError, type TeamPaymentDateKey, type TeamPaymentSchedule } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { AuthShell } from "@/views/auth/AuthShell";
import {
  AUTH_BUTTON_CLASS,
  AUTH_CARD_CLASS,
  AUTH_LABEL_CLASS,
} from "@/views/auth/config";
import {
  DEFAULT_PAYMENT_SCHEDULE,
  PAYMENT_SCHEDULE_OPTIONS,
} from "./create-team/config";
import { defaultPaymentDateForSchedule, paymentDateOptionsForSchedule } from "./create-team/utils";

const SELECT_ICON = (
  <img src="/icons/to-down.svg" alt="" width={10} height={4} className="pointer-events-none size-auto shrink-0" />
);

const READONLY_FIELD_CLASS =
  "mt-2.5 flex h-10 items-center rounded-[6px] border border-[#e3e3e3] bg-[#f6f6f6] px-3 font-montserrat text-sm font-medium text-black";

export function CreateTeamView() {
  const navigate = useNavigate();
  const orgId = useAuthStore((state) => state.orgId);
  const orgName = useAuthStore((state) => state.orgName);
  const userName = useAuthStore((state) => state.user?.name ?? "");
  const refreshWorkspaceContext = useAuthStore((state) => state.refreshWorkspaceContext);

  const [schedule, setSchedule] = useState<TeamPaymentSchedule>(DEFAULT_PAYMENT_SCHEDULE);
  const [paymentDate, setPaymentDate] = useState<TeamPaymentDateKey>(
    defaultPaymentDateForSchedule(DEFAULT_PAYMENT_SCHEDULE),
  );

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
    <AuthShell>
      <div className="relative pt-10 sm:pt-12">
        <div className="pointer-events-none absolute top-0 left-0 flex items-end gap-1 sm:-left-8">
          <p className="-rotate-4 font-montserrat text-sm text-black sm:text-base">
            Starts with creating your team.
          </p>
          <img
            src="/icons/to-bot-right.svg"
            alt=""
            aria-hidden
            className="absolute top-full left-[-5%] mb-[-6px] h-[37px] w-4 shrink-0"
          />
        </div>

        <form onSubmit={submit} className={AUTH_CARD_CLASS}>
          <h1 className="text-center font-montserrat text-xl font-semibold text-black">
            Create Your Team
          </h1>

          <div className="mt-5">
            <label className={AUTH_LABEL_CLASS}>Your Name</label>
            <div className={READONLY_FIELD_CLASS}>
              <span className="truncate">{userName || "—"}</span>
            </div>
          </div>

          <div className="mt-5">
            <label className={AUTH_LABEL_CLASS}>Team Name</label>
            <div className={READONLY_FIELD_CLASS}>
              <span className="truncate">{orgName || "Your team"}</span>
            </div>
          </div>

          <label className={`mt-5 block ${AUTH_LABEL_CLASS}`}>Payment Schedule</label>
          <Select
            value={schedule}
            onValueChange={(value) => onScheduleChange(value as TeamPaymentSchedule)}
          >
            <SelectTrigger
              icon={SELECT_ICON}
              className="mt-2.5 h-10 w-full rounded-[6px] border-[#e3e3e3] bg-white px-3 font-montserrat text-sm font-medium text-black shadow-none focus-visible:ring-0 data-[size=default]:h-10"
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

          <label className={`mt-5 block ${AUTH_LABEL_CLASS}`}>Payment Date</label>
          <Select
            value={paymentDate}
            onValueChange={(value) => setPaymentDate(value as TeamPaymentDateKey)}
          >
            <SelectTrigger
              icon={SELECT_ICON}
              className="mt-2.5 h-10 w-full rounded-[6px] border-[#e3e3e3] bg-white px-3 font-montserrat text-sm font-medium text-black shadow-none focus-visible:ring-0 data-[size=default]:h-10"
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

          {errorMessage && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Setup failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={updateTeamMutation.isPending || !orgName}
            className={`${AUTH_BUTTON_CLASS} hover:bg-black/90`}
          >
            {updateTeamMutation.isPending ? "Setting up…" : "Set up"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
