import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRegisterMutation, useRegistrationConfigQuery } from "@/hooks/use-auth-api";
import { adminHomePath, useAuthStore } from "@/stores/auth";
import { AuthShell } from "./AuthShell";
import { AuthError, AuthField, authErrorMessage, AUTH_BUTTON_CLASS, AUTH_CARD_CLASS } from "./auth-shared";
import { AUTH_LINK_CLASS } from "./config";

export function RegisterView() {
  const navigate = useNavigate();
  const applyAuthedUser = useAuthStore((state) => state.applyAuthedUser);
  const registerMutation = useRegisterMutation();
  const registrationConfig = useRegistrationConfigQuery();
  const inviteRequired = registrationConfig.data?.inviteRequired === true;

  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const { user } = await registerMutation.mutateAsync({
        email,
        password,
        name,
        orgName,
        ...(inviteRequired ? { inviteCode: inviteCode.trim() } : {}),
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
    <AuthShell>
      <form onSubmit={submit} className={AUTH_CARD_CLASS}>
        <h1 className="mb-2 text-center font-montserrat text-base font-semibold text-black">
          Create account
        </h1>

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
        {inviteRequired ? (
          <AuthField
            id="invite-code"
            label="Invite code"
            value={inviteCode}
            onChange={setInviteCode}
            placeholder="DECASH-XXXX-XXXX"
            autoComplete="off"
          />
        ) : null}

        <AuthError message={authErrorMessage(registerMutation.error, "")} />

        <button
          type="submit"
          disabled={registerMutation.isPending || registrationConfig.isLoading}
          className={AUTH_BUTTON_CLASS}
        >
          {registerMutation.isPending ? "Please wait…" : "Create account"}
        </button>

        <Link to="/login" className={`block ${AUTH_LINK_CLASS}`}>
          Already have an account? Sign in
        </Link>
      </form>
    </AuthShell>
  );
}
