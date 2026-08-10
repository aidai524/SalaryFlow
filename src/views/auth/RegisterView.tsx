import { ArrowRight } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { useRegisterMutation } from "@/hooks/use-auth-api";
import { adminHomePath, useAuthStore } from "@/stores/auth";
import { AuthError, AuthField, Brand, authErrorMessage } from "./auth-shared";

export function RegisterView() {
  const navigate = useNavigate();
  const applyAuthedUser = useAuthStore((state) => state.applyAuthedUser);
  const registerMutation = useRegisterMutation();

  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const { user } = await registerMutation.mutateAsync({
        email,
        password,
        name,
        orgName,
      });
      await applyAuthedUser(user);
      const paymentConfigured = useAuthStore.getState().paymentConfigured;
      navigate(
        user.role === "admin" ? adminHomePath(paymentConfigured) : "/my-pay",
        { replace: true },
      );
    } catch {
      // Error rendered from mutation state.
    }
  };

  return (
    <main className="auth-screen">
      <Card className="w-full max-w-md shadow-lg shadow-slate-900/5">
        <CardHeader className="space-y-4">
          <Brand />
          <div className="space-y-1">
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription className="leading-6">
              Create a workspace, then invite your team securely.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={submit}>
            <FieldGroup>
              <AuthField
                id="name"
                label="Your name"
                value={name}
                onChange={setName}
                placeholder="Lina Qiao"
                autoFocus
                autoComplete="name"
              />
              <AuthField
                id="organization"
                label="Organization name"
                value={orgName}
                onChange={setOrgName}
                placeholder="Northstar Labs"
              />
              <AuthField
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
                autoComplete="email"
              />
              <AuthField
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </FieldGroup>
            <AuthError message={authErrorMessage(registerMutation.error, "")} />
            <Button className="w-full" size="lg" type="submit" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Please wait…" : "Create account"}
              {!registerMutation.isPending && <ArrowRight data-icon="inline-end" />}
            </Button>
          </form>

          <Separator className="my-5" />
          <div className="flex flex-col items-center gap-1 text-sm">
            <Button variant="link" type="button" asChild>
              <Link to="/login">Already have an account? Sign in</Link>
            </Button>
            <Button variant="link" type="button" asChild>
              <Link to="/invite">Have an invitation link? Accept invitation</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
