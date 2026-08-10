import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAccount, useSignMessage } from "wagmi";
import { useAcceptInviteMutation, useResolveInviteQuery } from "@/hooks/use-auth-api";
import { useOpenWalletModal } from "@/hooks/use-open-wallet-modal";
import { api, ApiError } from "@/lib/api";
import { isValidEthereumAddress } from "@/lib/erc191";
import { useAuthStore } from "@/stores/auth";
import { AuthShell } from "./AuthShell";
import {
  AuthError,
  AuthField,
  authErrorMessage,
  avatarInitial,
  extractInviteToken,
  AUTH_BUTTON_CLASS,
  AUTH_CARD_CLASS,
} from "./auth-shared";
import {
  AUTH_LINK_CLASS,
  DEFAULT_PAYOUT_NETWORK,
  DEFAULT_PAYOUT_TOKEN,
} from "./config";

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
  const [welcomeReady, setWelcomeReady] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const pendingVerifyRef = useRef(false);

  const { openWalletModal, isConnected } = useOpenWalletModal();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    if (routeToken) {
      const next = extractInviteToken(routeToken);
      setActiveToken(next);
      setDraftToken(next);
      acceptedRef.current = false;
      setWelcomeReady(false);
    } else {
      setActiveToken("");
      setDraftToken("");
      acceptedRef.current = false;
      setWelcomeReady(false);
    }
  }, [routeToken]);

  // Auto-accept when invite resolves for a new account.
  useEffect(() => {
    if (!activeToken || !invite || invite.accountExists || acceptedRef.current) return;
    if (user?.email === invite.email) {
      acceptedRef.current = true;
      setWelcomeReady(true);
      return;
    }
    if (acceptMutation.isPending) return;

    acceptedRef.current = true;
    (async () => {
      try {
        const { user: nextUser } = await acceptMutation.mutateAsync({ token: activeToken });
        await applyAuthedUser(nextUser);
        setWelcomeReady(true);
      } catch {
        acceptedRef.current = false;
      }
    })();
  }, [activeToken, invite, user?.email, acceptMutation, applyAuthedUser]);

  // After wallet connects (from Connect Wallet), run ownership verify.
  useEffect(() => {
    if (!pendingVerifyRef.current || !isConnected || !address || verifying) return;
    pendingVerifyRef.current = false;
    void verifyPayoutWallet(address);
  }, [isConnected, address, verifying]);

  const continueWithToken = () => {
    const next = extractInviteToken(draftToken);
    if (!next) return;
    setActiveToken(next);
    if (next !== routeToken) {
      navigate(`/invite/${next}`, { replace: true });
    }
  };

  const verifyPayoutWallet = async (walletAddress: string) => {
    setWalletError("");
    if (!isValidEthereumAddress(walletAddress)) {
      setWalletError("Connect a valid EVM wallet address.");
      return;
    }

    setVerifying(true);
    try {
      const challenge = await api.createPayoutChallenge({
        token: DEFAULT_PAYOUT_TOKEN,
        network: DEFAULT_PAYOUT_NETWORK,
        endpoint: walletAddress,
      });
      const signature = await signMessageAsync({ message: challenge.message });
      await api.verifyPayout({
        challengeId: challenge.challengeId,
        signature,
      });
      navigate("/my-pay", { replace: true, state: { promptChangePassword: true } });
    } catch (cause) {
      setWalletError(
        cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Wallet verification failed",
      );
    } finally {
      setVerifying(false);
    }
  };

  const onConnectWallet = () => {
    setWalletError("");
    if (isConnected && address) {
      void verifyPayoutWallet(address);
      return;
    }
    pendingVerifyRef.current = true;
    openWalletModal();
  };

  // Paste-link mode (no token)
  if (!activeToken) {
    return (
      <AuthShell>
        <div className={AUTH_CARD_CLASS}>
          <h1 className="text-center font-montserrat text-base font-semibold text-black">
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

  if (resolving || (invite && !invite.accountExists && !welcomeReady && !acceptMutation.error)) {
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
          <h1 className="text-center font-montserrat text-base font-semibold text-black">
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

  const displayName = invite.name || user?.name || invite.email;
  const initial = avatarInitial(displayName);

  return (
    <AuthShell>
      <div className={`${AUTH_CARD_CLASS} max-w-[350px]`}>
        <h1 className="text-center font-montserrat text-lg font-semibold text-black">
          Welcome!
        </h1>

        <div className="mt-5 flex items-center justify-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-[#909090] font-montserrat text-xs font-semibold text-white">
            {initial}
          </span>
          <span className="font-montserrat text-sm font-medium text-[#606060]">
            {invite.email}
          </span>
        </div>

        <p className="mt-5 text-center font-montserrat text-sm font-medium leading-normal text-[#606060]">
          Welcome to join{" "}
          <span className="font-semibold text-black">{invite.orgName || "your team"}</span> on{" "}
          <span className="font-semibold text-black">DeCash</span>.
          <br />
          Please connect your wallet to verify for your access.
        </p>

        <AuthError message={walletError} />

        <button
          type="button"
          className={AUTH_BUTTON_CLASS}
          onClick={onConnectWallet}
          disabled={verifying}
        >
          {verifying ? "Verifying…" : "Connect Wallet"}
        </button>
      </div>
    </AuthShell>
  );
}
