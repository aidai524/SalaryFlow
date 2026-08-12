import { ApiError } from "@/lib/api";
import { IconAlert } from "@/components/icons";
import {
  AUTH_BRAND,
  AUTH_BUTTON_CLASS,
  AUTH_CARD_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
} from "./config";

export function AuthBetaBanner() {
  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-full bg-[rgba(63,138,251,0.2)] px-3">
      <span
        className="grid size-3.5 shrink-0 place-items-center rounded-full bg-[#3f8afb] text-white"
        aria-hidden
      >
        <IconAlert className="h-[7px] w-[2px]" />
      </span>
      <span className="font-montserrat text-sm font-medium text-[#3f8afb]">
        {AUTH_BRAND.betaLabel}
      </span>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="mt-3 font-montserrat text-sm font-medium text-red-600" role="alert">
      {message}
    </p>
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
}) {
  return (
    <div className="mt-5">
      <label htmlFor={id} className={AUTH_LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        readOnly={readOnly}
        autoComplete={autoComplete ?? (type === "password" ? "current-password" : "on")}
        className={AUTH_INPUT_CLASS}
      />
    </div>
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

export function avatarInitial(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export { AUTH_BUTTON_CLASS, AUTH_CARD_CLASS };
