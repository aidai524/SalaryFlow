import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAcceptInviteMutation, useResolveInviteQuery } from "@/hooks/use-auth-api";
import { useAuthStore } from "@/stores/auth";
import { AuthShell } from "./AuthShell";
import {
  AuthError,
  AuthField,
  authErrorMessage,
  extractInviteToken,
  AUTH_BUTTON_CLASS,
  AUTH_CARD_CLASS,
} from "./auth-shared";
import { AUTH_LINK_CLASS } from "./config";

export function InviteView() {
  const navigate = useNavigate();
  const { token: routeToken } = useParams();
  const applyAuthedUser = useAuthStore((state) => state.applyAuthedUser);
  const user = useAuthStore((state) => state.user);

  const [activeToken, setActiveToken] = useState(() =>
    routeToken ? extractInviteToken(routeToken) : "",
  );
  const [draftToken, setDraftToken] = useState(() =>
    routeToken ? extractInviteToken(routeToken) : "",
  );

  const resolveQuery = useResolveInviteQuery(activeToken);
  const acceptMutation = useAcceptInviteMutation();

  const invite = resolveQuery.data?.invitation ?? null;
  const resolving = Boolean(activeToken) && resolveQuery.isFetching;
  const resolveError = activeToken
    ? authErrorMessage(resolveQuery.error, "Invalid invitation")
    : "";

  const acceptedRef = useRef(false);

  useEffect(() => {
    if (routeToken) {
      const next = extractInviteToken(routeToken);
      setActiveToken(next);
      setDraftToken(next);
      acceptedRef.current = false;
    } else {
      setActiveToken("");
      setDraftToken("");
      acceptedRef.current = false;
    }
  }, [routeToken]);

  // Auto-accept when invite resolves for a new account, then go to My Pay.
  useEffect(() => {
    if (!activeToken || !invite || invite.accountExists || acceptedRef.current) return;
    if (user?.email === invite.email) {
      acceptedRef.current = true;
      navigate("/my-pay", { replace: true });
      return;
    }
    if (acceptMutation.isPending) return;

    acceptedRef.current = true;
    (async () => {
      try {
        const { user: nextUser } = await acceptMutation.mutateAsync({ token: activeToken });
        await applyAuthedUser(nextUser);
        navigate("/my-pay", { replace: true });
      } catch {
        acceptedRef.current = false;
      }
    })();
  }, [activeToken, invite, user?.email, acceptMutation, applyAuthedUser, navigate]);

  const continueWithToken = () => {
    const next = extractInviteToken(draftToken);
    if (!next) return;
    setActiveToken(next);
    if (next !== routeToken) {
      navigate(`/invite/${next}`, { replace: true });
    }
  };

  // Paste-link mode (no token)
  if (!activeToken) {
    return (
      <AuthShell>
        <div className={AUTH_CARD_CLASS}>
          <h1 className="mb-2 text-center font-montserrat text-base font-semibold text-black">
            Accept invitation
          </h1>
          <AuthField
            id="invite-link"
            label="Invitation link"
            value={draftToken}
            onChange={setDraftToken}
            placeholder="https://example.com/invite/…"
            autoFocus
          />
          <AuthError message={resolveError} />
          <button
            type="button"
            className={AUTH_BUTTON_CLASS}
            onClick={continueWithToken}
            disabled={!draftToken.trim()}
          >
            Continue
          </button>
          <Link to="/login" className={`block ${AUTH_LINK_CLASS}`}>
            Already have an account? Sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  const formError =
    authErrorMessage(acceptMutation.error, "")
    || (!invite && !resolving ? resolveError : "");

  if (resolving || (invite && !invite.accountExists && !acceptMutation.error)) {
    return (
      <AuthShell>
        <div className={`${AUTH_CARD_CLASS} items-center py-10`}>
          <span className="size-5 animate-spin rounded-full border-2 border-black border-r-transparent" />
          <p className="mt-4 font-montserrat text-sm text-[#606060]">
            {resolving ? "Checking your invitation…" : "Signing you in…"}
          </p>
        </div>
      </AuthShell>
    );
  }

  if (!invite || formError) {
    return (
      <AuthShell>
        <div className={AUTH_CARD_CLASS}>
          <h1 className="mb-2 text-center font-montserrat text-base font-semibold text-black">
            Invitation unavailable
          </h1>
          <AuthError message={formError || "Invalid invitation"} />
          <Link to="/login" className={`block ${AUTH_LINK_CLASS}`}>
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (invite.accountExists) {
    return (
      <AuthShell>
        <div className={AUTH_CARD_CLASS}>
          <h1 className="text-center font-montserrat text-lg font-semibold text-black">
            Welcome!
          </h1>
          <p className="mt-4 text-center font-montserrat text-sm font-medium text-[#606060]">
            An account for <span className="font-semibold text-black">{invite.email}</span> already
            exists. Please sign in to continue.
          </p>
          <Link
            to="/login"
            className={`${AUTH_BUTTON_CLASS} flex items-center justify-center no-underline`}
          >
            Sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return null;
}
