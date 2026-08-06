import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CircleDashed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-3xl space-y-1">
        {eyebrow && (
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  icon,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  helper: ReactNode;
  icon: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card size="sm" className="min-h-[126px]">
      <CardContent className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{label}</span>
          <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        </div>
        <div>
          {loading ? (
            <Skeleton className="mb-2 h-7 w-28" />
          ) : (
            <div className="font-heading text-lg leading-tight font-semibold tracking-tight tabular-nums sm:text-2xl">
              {value}
            </div>
          )}
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const successStates = new Set(["ready", "paid", "confirmed", "accepted", "signed", "configured"]);
const warningStates = new Set(["pending", "processing", "quoted", "submitted", "draft", "awaiting_signature", "created", "quoting", "generating", "submitting"]);
const errorStates = new Set(["failed", "refunded", "update_required", "revoked", "expired"]);

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const normalized = status.toLowerCase();
  const isSuccess = successStates.has(normalized);
  const isWarning = warningStates.has(normalized);
  const isError = errorStates.has(normalized);
  const Icon = isSuccess ? CheckCircle2 : isError ? AlertCircle : isWarning ? Clock3 : CircleDashed;
  const display = label ?? status.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 capitalize",
        isSuccess && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
        isWarning && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
        isError && "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
        !isSuccess && !isWarning && !isError && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon />
      {display}
    </Badge>
  );
}

export function TokenCell({ token, network }: { token: string; network: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={cn(
        "grid size-8 place-items-center rounded-full text-xs font-semibold",
        token === "USDT" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700",
      )}>
        {token === "USDT" ? "₮" : "$"}
      </span>
      <span className="flex flex-col">
        <strong className="font-medium">{token}</strong>
        <small className="text-xs text-muted-foreground">{network}</small>
      </span>
    </span>
  );
}

export function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-xl border border-dashed bg-muted/20 p-8 text-center">
      <div className="max-w-sm space-y-1">
        <h2 className="font-heading text-base font-medium">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
