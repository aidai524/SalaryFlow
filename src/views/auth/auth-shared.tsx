import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";

export function Brand() {
  return (
    <div className="mb-1 flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
        DC
      </span>
      <div className="flex flex-col leading-tight">
        <strong className="font-heading text-base">DECash</strong>
        <small className="text-xs text-muted-foreground">Stablecoin payroll for global teams</small>
      </div>
    </div>
  );
}

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoFocus,
  readOnly = false,
  autoComplete,
  description,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
  description?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        readOnly={readOnly}
        autoComplete={autoComplete ?? (type === "password" ? "current-password" : "on")}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function extractInviteToken(value: string): string {
  const trimmed = value.trim();
  const pathToken = trimmed.match(/\/invite\/([0-9a-f]{64})/i)?.[1];
  return pathToken ?? trimmed;
}

export function authErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
