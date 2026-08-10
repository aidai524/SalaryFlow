import { ArrowRight, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { useAcceptInviteMutation, useResolveInviteQuery } from "@/hooks/use-auth-api";
import { useAuthStore } from "@/stores/auth";
import {
  AuthError,
  AuthField,
  Brand,
  authErrorMessage,
  extractInviteToken,
} from "./auth-shared";

export function InviteView() {
  const navigate = useNavigate();
  const { token: routeToken } = useParams();
  const applyAuthedUser = useAuthStore((state) => state.applyAuthedUser);

  const [activeToken, setActiveToken] = useState(() =>
    routeToken ? extractInviteToken(routeToken) : "",
  );
  const [draftToken, setDraftToken] = useState(() =>
    routeToken ? extractInviteToken(routeToken) : "",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const resolveQuery = useResolveInviteQuery(activeToken);
  const acceptMutation = useAcceptInviteMutation();

  const invite = resolveQuery.data?.invitation ?? null;
  const resolving = Boolean(activeToken) && resolveQuery.isFetching;
  const resolveError = activeToken
    ? authErrorMessage(resolveQuery.error, "Invalid invitation")
    : "";

  useEffect(() => {
    if (routeToken) {
      const next = extractInviteToken(routeToken);
      setActiveToken(next);
      setDraftToken(next);
    }
  }, [routeToken]);

  useEffect(() => {
    if (invite?.email) {
      setEmail(invite.email);
    }
  }, [invite?.email]);

  const continueWithToken = () => {
    const next = extractInviteToken(draftToken);
    if (!next) return;
    setActiveToken(next);
    if (next !== routeToken) {
      navigate(`/invite/${next}`, { replace: true });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const { user } = await acceptMutation.mutateAsync({
        token: extractInviteToken(activeToken),
        email,
        name,
        password,
      });
      await applyAuthedUser(user);
      navigate(user.role === "admin" ? "/pay" : "/my-pay", { replace: true });
    } catch {
      // Error rendered from mutation state.
    }
  };

  const formError = authErrorMessage(acceptMutation.error, "") || (!invite ? resolveError : "");

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
                <AuthField
                  id="invite-name"
                  label="Your name"
                  value={name}
                  onChange={setName}
                  placeholder="Your full name"
                  autoFocus
                  autoComplete="name"
                />
                <AuthField
                  id="invite-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  readOnly
                />
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
              <AuthError message={authErrorMessage(acceptMutation.error, "")} />
              <Button className="w-full" size="lg" type="submit" disabled={acceptMutation.isPending}>
                <ShieldCheck data-icon="inline-start" />
                {acceptMutation.isPending ? "Please wait…" : "Accept invitation"}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <Field>
                <FieldLabel htmlFor="invite-link">Invitation link</FieldLabel>
                <Input
                  id="invite-link"
                  placeholder="https://example.com/invite/…"
                  value={draftToken}
                  onChange={(event) => setDraftToken(event.target.value)}
                  autoFocus
                />
                <FieldDescription>Only links issued by your organization can be accepted.</FieldDescription>
              </Field>
              <AuthError message={formError} />
              <Button
                className="w-full"
                size="lg"
                type="button"
                onClick={continueWithToken}
                disabled={!draftToken.trim() || resolveQuery.isFetching}
              >
                Continue
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          )}

          <Separator className="my-5" />
          <Button variant="link" className="w-full" type="button" asChild>
            <Link to="/login">Already have an account? Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
