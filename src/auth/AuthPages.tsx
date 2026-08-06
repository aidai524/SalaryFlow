import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api, ApiError, type AuthUser } from "@/lib/api";

function Brand() {
  return (
    <div className="mb-1 flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
        SF
      </span>
      <div className="flex flex-col leading-tight">
        <strong className="font-heading text-base">SalaryFlow</strong>
        <small className="text-xs text-muted-foreground">Stablecoin payroll for global teams</small>
      </div>
    </div>
  );
}

function AuthField({
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

function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function LoginPage({
  onAuthed,
  onGoInvite,
}: {
  onAuthed: (user: AuthUser) => void;
  onGoInvite: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        const { user } = await api.login({ email, password });
        onAuthed(user);
      } else {
        const { user } = await api.register({ email, password, name, orgName });
        onAuthed(user);
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <Card className="w-full max-w-md shadow-lg shadow-slate-900/5">
        <CardHeader className="space-y-4">
          <Brand />
          <div className="space-y-1">
            <CardTitle className="text-2xl">
              {mode === "login" ? "Sign in" : "Create your account"}
            </CardTitle>
            <CardDescription className="leading-6">
              {mode === "login"
                ? "Welcome back. Sign in to your payroll workspace."
                : "Create a workspace, then invite your team securely."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={submit}>
            <FieldGroup>
              {mode === "register" && (
                <>
                  <AuthField id="name" label="Your name" value={name} onChange={setName} placeholder="Lina Qiao" autoFocus />
                  <AuthField id="organization" label="Organization name" value={orgName} onChange={setOrgName} placeholder="Northstar Labs" />
                </>
              )}
              <AuthField id="email" label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoFocus={mode === "login"} />
              <AuthField id="password" label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" />
            </FieldGroup>
            <AuthError message={error} />
            <Button className="w-full" size="lg" type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              {!busy && <ArrowRight data-icon="inline-end" />}
            </Button>
          </form>

          <Separator className="my-5" />
          <div className="flex flex-col items-center gap-1 text-sm">
            <Button
              variant="link"
              type="button"
              onClick={() => {
                setMode((current) => current === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
            </Button>
            <Button variant="link" type="button" onClick={onGoInvite}>
              Have an invitation link? Accept invitation
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function extractInviteToken(value: string): string {
  const trimmed = value.trim();
  const pathToken = trimmed.match(/\/invite\/([0-9a-f]{64})/i)?.[1];
  return pathToken ?? trimmed;
}

export function InvitePage({
  onAuthed,
  onGoLogin,
}: {
  onAuthed: (user: AuthUser) => void;
  onGoLogin: () => void;
}) {
  const [token, setToken] = useState("");
  const [invite, setInvite] = useState<{ email: string; role: string; orgName: string; accountExists: boolean } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    const pathToken = window.location.pathname.match(/^\/invite\/([0-9a-f]+)/)?.[1];
    if (!pathToken) {
      setResolving(false);
      return;
    }
    setToken(pathToken);
    api.resolveInvite(pathToken)
      .then((result) => {
        setInvite(result.invitation);
        setEmail(result.invitation.email);
      })
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "Invalid invitation"))
      .finally(() => setResolving(false));
  }, []);

  const resolve = async () => {
    setResolving(true);
    setError("");
    const inviteToken = extractInviteToken(token);
    setToken(inviteToken);
    try {
      const result = await api.resolveInvite(inviteToken);
      setInvite(result.invitation);
      setEmail(result.invitation.email);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Invalid invitation");
    } finally {
      setResolving(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { user } = await api.acceptInvite({ token: extractInviteToken(token), email, name, password });
      onAuthed(user);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <Card className="w-full max-w-md shadow-lg shadow-slate-900/5">
        <CardHeader className="space-y-4">
          <Brand />
          <div className="space-y-1">
            <CardTitle className="text-2xl">
              {invite ? "You’re invited" : "Accept an invitation"}
            </CardTitle>
            <CardDescription className="leading-6">
              {resolving
                ? "Checking your invitation…"
                : invite
                  ? `${invite.orgName} invited ${invite.email} to join as ${invite.role === "admin" ? "an administrator" : "a team member"}.`
                  : "Paste the secure invitation link from your email."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {resolving ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
              Resolving invitation…
            </div>
          ) : invite ? (
            <form className="space-y-5" onSubmit={submit}>
              <FieldGroup>
                <AuthField id="invite-name" label="Your name" value={name} onChange={setName} placeholder="Your full name" autoFocus />
                <AuthField id="invite-email" label="Email" type="email" value={email} onChange={setEmail} readOnly />
                <AuthField
                  id="invite-password"
                  label={invite.accountExists ? "Existing account password" : "Set a password"}
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 8 characters"
                  autoComplete={invite.accountExists ? "current-password" : "new-password"}
                  description="The invitation is bound to the email shown above."
                />
              </FieldGroup>
              <AuthError message={error} />
              <Button className="w-full" size="lg" type="submit" disabled={busy}>
                <ShieldCheck data-icon="inline-start" />
                {busy ? "Please wait…" : "Accept invitation"}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <Field>
                <FieldLabel htmlFor="invite-link">Invitation link</FieldLabel>
                <Input
                  id="invite-link"
                  placeholder="https://salaryflow.dev/invite/…"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoFocus
                />
                <FieldDescription>Only links issued by your organization can be accepted.</FieldDescription>
              </Field>
              <AuthError message={error} />
              <Button className="w-full" size="lg" type="button" onClick={resolve} disabled={!token.trim()}>
                Continue
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          )}

          <Separator className="my-5" />
          <Button variant="link" className="w-full" type="button" onClick={onGoLogin}>
            Already have an account? Sign in
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
