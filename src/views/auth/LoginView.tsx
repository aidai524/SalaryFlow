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
import { useLoginMutation } from "@/hooks/use-auth-api";
import { adminHomePath, useAuthStore } from "@/stores/auth";
import { AuthError, AuthField, Brand, authErrorMessage } from "./auth-shared";

export function LoginView() {
  const navigate = useNavigate();
  const applyAuthedUser = useAuthStore((state) => state.applyAuthedUser);
  const loginMutation = useLoginMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const { user } = await loginMutation.mutateAsync({ email, password });
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
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription className="leading-6">
              Welcome back. Sign in to your payroll workspace.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={submit}>
            <FieldGroup>
              <AuthField
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
                autoFocus
                autoComplete="email"
              />
              <AuthField
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
              />
            </FieldGroup>
            <AuthError message={authErrorMessage(loginMutation.error, "")} />
            <Button className="w-full" size="lg" type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Please wait…" : "Sign in"}
              {!loginMutation.isPending && <ArrowRight data-icon="inline-end" />}
            </Button>
          </form>

          <Separator className="my-5" />
          <div className="flex flex-col items-center gap-1 text-sm">
            <Button variant="link" type="button" asChild>
              <Link to="/register">New here? Create an account</Link>
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
