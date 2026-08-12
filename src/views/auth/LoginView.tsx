import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLoginMutation } from "@/hooks/use-auth-api";
import { adminHomePath, useAuthStore } from "@/stores/auth";
import { AuthShell } from "./AuthShell";
import {
  AuthBetaBanner,
  AuthError,
  AuthField,
  authErrorMessage,
  AUTH_BUTTON_CLASS,
  AUTH_CARD_CLASS,
} from "./auth-shared";
import { AUTH_LINK_ACCENT_CLASS, AUTH_LINK_CLASS } from "./config";

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
    <AuthShell panelTop={<AuthBetaBanner />}>
      <form onSubmit={submit} className={AUTH_CARD_CLASS}>
        <h1 className="text-center font-montserrat text-xl font-semibold text-black">
          Welcome to DeCash
        </h1>

        <AuthField
          id="email"
          label="Sign in by Email"
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

        <p className={`block ${AUTH_LINK_CLASS}`}>
          New to DeCash?{" "}
          <Link to="/register" className={AUTH_LINK_ACCENT_CLASS}>
            Create an account
          </Link>
          <span aria-hidden className={`ml-1 ${AUTH_LINK_ACCENT_CLASS}`}>
            →
          </span>
        </p>
      </form>
    </AuthShell>
  );
}
