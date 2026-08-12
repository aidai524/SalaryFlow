import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLoginMutation } from "@/hooks/use-auth-api";
import { adminHomePath, useAuthStore } from "@/stores/auth";
import { AuthShell } from "./AuthShell";
import { AuthError, AuthField, authErrorMessage, AUTH_BUTTON_CLASS, AUTH_CARD_CLASS } from "./auth-shared";
import { AUTH_LINK_CLASS } from "./config";

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
    <AuthShell>
      <form onSubmit={submit} className={AUTH_CARD_CLASS}>
        <h1 className="mb-2 text-center font-montserrat text-base font-semibold text-black">
          Sign in
        </h1>

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

        <AuthError message={authErrorMessage(loginMutation.error, "")} />

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className={AUTH_BUTTON_CLASS}
        >
          {loginMutation.isPending ? "Please wait…" : "Sign in"}
        </button>

        <Link to="/register" className={`block ${AUTH_LINK_CLASS}`}>
          New here, create an account
        </Link>
      </form>
    </AuthShell>
  );
}
