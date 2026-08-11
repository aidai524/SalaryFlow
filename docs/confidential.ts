import { base16, base58, base64, base64url } from "@scure/base";
import bs58check from "bs58check";
import { config_near } from "@/services/config";
import { getPasskeyUserId, signWithPasskey } from "@/services/passkey";
import type { PasskeyCredential } from "@/services/passkey";
import {
  fetchIntentsTokens,
  getMultichainTokensByChains,
} from "@/services/api/centralized_api";
import { EVM_CHAINS, NEAR_ICON } from "@/services/chainConfig";
import {
  SUPPORT_EVM_CHAINS_SWAP,
  NATIVE_SOL_INTENTS_ASSET_ID,
  SUPPORT_NEAR_CHAINS_SWAP,
  SUPPORT_SOLANA_CHAINS_SWAP,
  SUPPORT_TRON_CHAINS_SWAP,
} from "@/services/chainSwapConfig";
import { transfer_evm } from "@/services/chains/evm";
import { transfer_near } from "@/services/chains/near";
import { transfer_solana } from "@/services/chains/solana";
import { transfer_tron } from "@/services/chains/tron";
import { formatEvmChainName } from "@/utils/chainsUtil";

/** Chains allowed on Trade Confidential (hide BTC/Zcash/Aptos/Sui/etc.). */
export const CONFIDENTIAL_SUPPORT_CHAINS = [
  ...SUPPORT_EVM_CHAINS_SWAP,
  ...SUPPORT_NEAR_CHAINS_SWAP,
  ...SUPPORT_SOLANA_CHAINS_SWAP,
  ...SUPPORT_TRON_CHAINS_SWAP,
];

export function isConfidentialSupportedBlockchain(
  blockchain: string | undefined | null
): boolean {
  if (!blockchain) return false;
  return CONFIDENTIAL_SUPPORT_CHAINS.includes(String(blockchain).toLowerCase());
}

export function walletKindFromBlockchain(
  blockchain: string | undefined | null
): Exclude<ConfidentialWalletKind, "webauthn"> | null {
  const chain = String(blockchain || "").toLowerCase();
  if (!chain) return null;
  if (SUPPORT_NEAR_CHAINS_SWAP.includes(chain)) return "near";
  if (SUPPORT_SOLANA_CHAINS_SWAP.includes(chain)) return "solana";
  if (SUPPORT_TRON_CHAINS_SWAP.includes(chain)) return "tron";
  if (SUPPORT_EVM_CHAINS_SWAP.includes(chain)) return "evm";
  return null;
}

const ONE_CLICK_BASE_URL = String(config_near.oneClickUrl || "").replace(
  /\/$/,
  ""
);
/** Partner JWT for confidential / privacy 1Click calls (temporary hardcode). */
export const CONFIDENTIAL_PARTNER_JWT = "";
export const CONFIDENTIAL_REFERRAL = "rhea";
export const CONFIDENTIAL_SLIPPAGE_BPS = 30;
export const CONFIDENTIAL_QUOTE_WAITING_TIME_MS = 0;

function getConfidentialAppFees(): Array<{ recipient: string; fee: number }> {
  const recipient = config_near.INTENTS_APP_FEES_RECIPIENT;
  if (!recipient) return [];
  return [
    {
      recipient,
      fee: config_near.INTENTS_APP_FEES,
    },
  ];
}
const INTENTS_VERIFIER_CONTRACT = "intents.near";
const REGISTER_KEY_GAS = "100000000000000";
const ONE_YOCTO_NEAR = "1";
const VERSIONED_NONCE_PREFIX = new Uint8Array([86, 40, 246, 198]);
const VERSIONED_NONCE_VERSION = 0;
const NEAR_SIGNING_KEY_STORAGE = "near-intents:signing-keys";
const CONFIDENTIAL_SESSION_STORAGE = "near-intents:confidential-session:";
const INTENTS_BALANCE_BATCH_SIZE = 50;
const EMPTY_TOKEN_ICON = "https://img.rhea.finance/images/mutiEmptyIcon.svg";
const MONAD_TOKEN_ID = "nep245:v2_1.omni.hot.tg:143_11111111111111111111";
const MONAD_TOKEN_ICON = "https://img.rhea.finance/images/monad_logo.png";

export type Nep413Payload = {
  message: string;
  nonce: string;
  recipient: string;
  callbackUrl?: string;
};

export type Nep413UnsignedData = {
  standard: "nep413";
  payload: Nep413Payload;
};

export type Nep413SignedData = Nep413UnsignedData & {
  public_key: string;
  signature: string;
};

export type ConfidentialWalletKind =
  | "near"
  | "evm"
  | "solana"
  | "tron"
  | "webauthn";
export type ConfidentialSigningStandard =
  | "nep413"
  | "erc191"
  | "raw_ed25519"
  | "tip191"
  | "webauthn";

export type StringUnsignedData = {
  standard: Exclude<ConfidentialSigningStandard, "nep413">;
  payload: string;
};

export type StringSignedData = StringUnsignedData & {
  public_key?: string;
  signature: string;
  client_data_json?: string;
  authenticator_data?: string;
};

export type ConfidentialUnsignedData = Nep413UnsignedData | StringUnsignedData;
export type ConfidentialSignedData = Nep413SignedData | StringSignedData;

export function getConfidentialSigningStandard(
  walletKind: ConfidentialWalletKind
): ConfidentialSigningStandard {
  const standards: Record<ConfidentialWalletKind, ConfidentialSigningStandard> =
    {
      near: "nep413",
      evm: "erc191",
      solana: "raw_ed25519",
      tron: "tip191",
      webauthn: "webauthn",
    };
  return standards[walletKind];
}

export function deriveConfidentialAccountId(
  walletKind: ConfidentialWalletKind,
  walletAccountId: string
): string {
  const accountId = walletAccountId.trim();
  if (!accountId) return "";
  if (walletKind === "near") return accountId;
  if (walletKind === "webauthn") {
    if (
      !/^0x[0-9a-f]{40}$/i.test(accountId) &&
      !/^[0-9a-f]{64}$/i.test(accountId)
    ) {
      throw new Error("The selected Passkey account is invalid.");
    }
    return accountId.toLowerCase();
  }
  if (walletKind === "evm") {
    if (!/^0x[0-9a-f]{40}$/i.test(accountId)) {
      throw new Error("The connected EVM account address is invalid.");
    }
    return accountId.toLowerCase();
  }
  if (walletKind === "solana") {
    const publicKey = base58.decode(accountId);
    if (publicKey.length !== 32) {
      throw new Error("The connected Solana public key is invalid.");
    }
    return base16.encode(publicKey).toLowerCase();
  }

  const decoded = bs58check.decode(accountId);
  if (decoded.length !== 21 || decoded[0] !== 0x41) {
    throw new Error("The connected TRON account address is invalid.");
  }
  return `0x${base16.encode(decoded.slice(1)).toLowerCase()}`;
}

export type ConfidentialSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
};

export type StoredConfidentialLogin = {
  walletKind?: ConfidentialWalletKind;
  signingStandard?: ConfidentialSigningStandard;
  walletAccountId: string;
  intentsAccountId: string;
  publicKey?: string;
  session: ConfidentialSession;
};

export type ConfidentialBalance = {
  tokenId: string;
  available: string;
  source: string;
};

/** Match public nep141 id or confidential imt:…:nep141:… balance rows. */
export function getConfidentialAvailableForAsset(
  balances: ConfidentialBalance[],
  assetId: string
): string {
  if (!assetId) return "0";
  const exact = balances.find((item) => item.tokenId === assetId);
  if (exact && /^\d+$/.test(exact.available)) return exact.available;

  const suffix = `:${assetId}`;
  const nested = balances.find(
    (item) => item.tokenId.endsWith(suffix) || item.tokenId.includes(assetId)
  );
  if (nested && /^\d+$/.test(nested.available)) return nested.available;
  return "0";
}

export type OneClickToken = {
  assetId: string;
  symbol: string;
  decimals: number;
  blockchain?: string;
  price?: number;
  contractAddress?: string | null;
  icon?: string;
};

export type ConfidentialQuoteResponse = {
  correlationId: string;
  timestamp: string;
  signature: string;
  quoteRequest: Record<string, unknown>;
  quote: {
    amountIn: string;
    amountInFormatted: string;
    amountInUsd?: string;
    minAmountIn?: string;
    amountOut: string;
    amountOutFormatted: string;
    amountOutUsd?: string;
    minAmountOut: string;
    minAmountOutFormatted?: string;
    timeEstimate?: number;
    depositAddress: string;
    depositMemo?: string;
    deadline?: string;
    timeWhenInactive?: string;
  };
};

export type OneClickStatus =
  | "KNOWN_DEPOSIT_TX"
  | "PENDING_DEPOSIT"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

export type ConfidentialSwapStatusResponse = {
  correlationId?: string;
  status: OneClickStatus;
  updatedAt?: string;
  quoteResponse?: ConfidentialQuoteResponse;
  swapDetails?: {
    intentHashes?: string[];
    amountIn?: string;
    amountInFormatted?: string;
    amountOut?: string;
    amountOutFormatted?: string;
    depositedAmount?: string;
    depositedAmountFormatted?: string;
    refundReason?: string;
  };
};

type ApiOptions = RequestInit & {
  accessToken?: string;
};

function errorMessageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const value = body as Record<string, unknown>;
  for (const key of ["message", "error", "detail"]) {
    const message = value[key];
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

async function oneClickFetch<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { accessToken, headers, ...init } = options;

  const response = await fetch(`${ONE_CLICK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  const text = await response.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(
        response.ok
          ? "NEAR Intents returned an invalid response."
          : `NEAR Intents request failed (${response.status}).`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      errorMessageFromBody(
        body,
        `NEAR Intents request failed (${response.status}).`
      )
    );
  }

  return body as T;
}

function decodeBase64Value(value: string): Uint8Array {
  const normalized = value.trim();
  try {
    return base64.decode(normalized);
  } catch {
    return base64url.decode(normalized.replace(/=+$/, ""));
  }
}

function decodeHex(value: string): Uint8Array | null {
  const normalized = value.replace(/^0x/i, "");
  if (!/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2 !== 0) {
    return null;
  }
  try {
    return base16.decode(normalized.toUpperCase());
  } catch {
    return null;
  }
}

function decodeWalletValue(value: string, expectedLength: number): Uint8Array {
  const raw = value.replace(/^ed25519:/, "").trim();
  const hex = decodeHex(raw);
  if (hex?.length === expectedLength) return hex;

  try {
    const bytes = base58.decode(raw);
    if (bytes.length === expectedLength) return bytes;
  } catch {
    // Try the wallet-selector base64 representation next.
  }

  try {
    const bytes = decodeBase64Value(raw);
    if (bytes.length === expectedLength) return bytes;
  } catch {
    // Fall through to the normalized error below.
  }

  throw new Error(
    `Wallet returned an invalid Ed25519 ${expectedLength}-byte value.`
  );
}

function normalizeEd25519(value: string, expectedLength: number): string {
  return `ed25519:${base58.encode(decodeWalletValue(value, expectedLength))}`;
}

export function deriveNearImplicitAccountId(publicKey: string): string {
  return base16.encode(decodeWalletValue(publicKey, 32)).toLowerCase();
}

export function isNearImplicitAccountId(accountId: string): boolean {
  return /^[0-9a-f]{64}$/.test(accountId);
}

function getCachedNearSigningPublicKey(accountId: string): string {
  try {
    const value = localStorage.getItem(NEAR_SIGNING_KEY_STORAGE);
    if (!value) return "";
    const keys = JSON.parse(value) as Record<string, unknown>;
    const publicKey = keys[accountId];
    return typeof publicKey === "string" ? normalizeEd25519(publicKey, 32) : "";
  } catch {
    return "";
  }
}

export function rememberNearSigningPublicKey(
  accountId: string,
  publicKey: string
): void {
  try {
    const normalized = normalizeEd25519(publicKey, 32);
    const value = localStorage.getItem(NEAR_SIGNING_KEY_STORAGE);
    const keys = value ? (JSON.parse(value) as Record<string, unknown>) : {};
    localStorage.setItem(
      NEAR_SIGNING_KEY_STORAGE,
      JSON.stringify({ ...keys, [accountId]: normalized })
    );
  } catch {
    // Public-key caching is an optimization; signing still works without it.
  }
}

function confidentialSessionKey(
  walletAccountId: string,
  walletKind: ConfidentialWalletKind = "near"
): string {
  const walletKey =
    walletKind === "near"
      ? walletAccountId
      : `${walletKind}:${walletAccountId.toLowerCase()}`;
  return `${CONFIDENTIAL_SESSION_STORAGE}${walletKey}`;
}

export function storeConfidentialLogin(login: StoredConfidentialLogin): void {
  try {
    sessionStorage.setItem(
      confidentialSessionKey(login.walletAccountId, login.walletKind),
      JSON.stringify(login)
    );
  } catch {
    // Continue with an in-memory session when storage is unavailable.
  }
}

export function loadConfidentialLogin(
  walletAccountId: string,
  walletKind: ConfidentialWalletKind = "near"
): StoredConfidentialLogin | null {
  try {
    const value = sessionStorage.getItem(
      confidentialSessionKey(walletAccountId, walletKind)
    );
    if (!value) return null;
    const login = JSON.parse(value) as StoredConfidentialLogin;
    if (
      login.walletAccountId !== walletAccountId ||
      (login.walletKind && login.walletKind !== walletKind) ||
      typeof login.intentsAccountId !== "string" ||
      !login.intentsAccountId ||
      !login.session?.accessToken ||
      !login.session?.refreshToken ||
      !Number.isFinite(login.session.expiresAt) ||
      !Number.isFinite(login.session.refreshExpiresAt)
    ) {
      return null;
    }
    return login;
  } catch {
    return null;
  }
}

export function clearConfidentialLogin(
  walletAccountId: string,
  walletKind: ConfidentialWalletKind = "near"
): void {
  try {
    sessionStorage.removeItem(
      confidentialSessionKey(walletAccountId, walletKind)
    );
  } catch {
    // Nothing else to clear when storage is unavailable.
  }
}

export async function getNearWalletSigningIdentity(
  walletAccountId: string
): Promise<{ publicKey: string; implicitAccountId: string }> {
  if (!window.selector) {
    throw new Error("NEAR wallet is not initialized.");
  }
  const wallet = await window.selector.wallet();
  let publicKey = getCachedNearSigningPublicKey(walletAccountId);

  if (wallet?.getAccounts) {
    const accounts = await wallet.getAccounts({
      network: config_near.networkId,
    });
    const account = accounts?.find(
      (item: { accountId?: string }) => item.accountId === walletAccountId
    );
    if (account?.publicKey) {
      publicKey = normalizeEd25519(String(account.publicKey), 32);
      rememberNearSigningPublicKey(walletAccountId, publicKey);
    }
  }

  // Some wallets omit the public key from getAccounts(). A harmless message
  // signature lets us discover the exact key that the wallet will use.
  if (!publicKey) {
    if (!wallet?.signMessage) {
      throw new Error(
        "The connected NEAR wallet does not expose a message signing key."
      );
    }
    const nonce = new Uint8Array(32);
    crypto.getRandomValues(nonce);
    const signed = await wallet.signMessage({
      message: "Authenticate",
      recipient: INTENTS_VERIFIER_CONTRACT,
      nonce,
      signerId: walletAccountId,
      network: config_near.networkId,
    });
    if (!signed?.publicKey) {
      throw new Error("The wallet did not return a public key.");
    }
    if (signed.accountId && signed.accountId !== walletAccountId) {
      throw new Error("The wallet signed with a different NEAR account.");
    }
    publicKey = normalizeEd25519(String(signed.publicKey), 32);
    rememberNearSigningPublicKey(walletAccountId, publicKey);
  }

  return {
    publicKey,
    implicitAccountId: deriveNearImplicitAccountId(publicKey),
  };
}

async function viewIntentsContract<T>(
  methodName: string,
  args: Record<string, unknown>
): Promise<T> {
  const argsBase64 = base64.encode(
    new TextEncoder().encode(JSON.stringify(args))
  );
  const response = await fetch(config_near.nodeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "near-intents-confidential",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: INTENTS_VERIFIER_CONTRACT,
        method_name: methodName,
        args_base64: argsBase64,
      },
    }),
  });
  const rpc = (await response.json()) as {
    result?: { result?: number[] };
    error?: { message?: string; data?: string };
  };
  if (!response.ok || rpc.error || !Array.isArray(rpc.result?.result)) {
    throw new Error(
      rpc.error?.data ||
        rpc.error?.message ||
        "Failed to read the NEAR Intents verifier contract."
    );
  }
  const value = new TextDecoder().decode(Uint8Array.from(rpc.result.result));
  return JSON.parse(value) as T;
}

export async function isIntentPublicKeyRegistered(
  accountId: string,
  publicKey: string
): Promise<boolean> {
  return viewIntentsContract<boolean>("has_public_key", {
    account_id: accountId,
    public_key: publicKey,
  });
}

export async function registerIntentPublicKey(
  accountId: string,
  publicKey: string
): Promise<void> {
  if (!window.selector) {
    throw new Error("NEAR wallet is not initialized.");
  }
  const wallet = await window.selector.wallet();
  if (!wallet?.signAndSendTransaction) {
    throw new Error(
      "The connected NEAR wallet cannot register an Intents signing key."
    );
  }
  await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: INTENTS_VERIFIER_CONTRACT,
    network: config_near.networkId,
    actions: [
      {
        type: "FunctionCall",
        params: {
          methodName: "add_public_key",
          args: { public_key: publicKey },
          gas: REGISTER_KEY_GAS,
          deposit: ONE_YOCTO_NEAR,
        },
      },
    ],
  });
}

async function createAuthNonce(
  startTime: Date,
  deadline: Date
): Promise<Uint8Array> {
  const saltHex = await viewIntentsContract<string>("current_salt", {});
  const salt = decodeHex(saltHex);
  if (!salt || salt.length !== 4) {
    throw new Error("NEAR Intents returned an invalid nonce salt.");
  }

  const timestampedRandom = new Uint8Array(15);
  crypto.getRandomValues(timestampedRandom);
  new DataView(timestampedRandom.buffer).setBigInt64(
    0,
    BigInt(startTime.getTime()) * BigInt(1_000_000),
    true
  );

  const nonce = new Uint8Array(32);
  nonce.set(VERSIONED_NONCE_PREFIX, 0);
  nonce[4] = VERSIONED_NONCE_VERSION;
  nonce.set(salt, 5);
  new DataView(nonce.buffer).setBigUint64(
    9,
    BigInt(deadline.getTime()) * BigInt(1_000_000),
    true
  );
  nonce.set(timestampedRandom, 17);
  return nonce;
}

export async function createAuthPayload(
  accountId: string,
  standard: ConfidentialSigningStandard = "nep413"
): Promise<ConfidentialUnsignedData> {
  const startTime = new Date();
  const deadline = new Date(startTime.getTime() + 5 * 60_000);
  const nonce = await createAuthNonce(startTime, deadline);
  const nonceBase64 = base64.encode(nonce);

  if (standard === "nep413") {
    return {
      standard,
      payload: {
        recipient: "intents.near",
        nonce: nonceBase64,
        message: JSON.stringify({
          deadline: deadline.toISOString(),
          intents: [],
          signer_id: accountId,
        }),
      },
    };
  }

  return {
    standard,
    payload: JSON.stringify({
      signer_id: accountId,
      verifying_contract: INTENTS_VERIFIER_CONTRACT,
      deadline: deadline.toISOString(),
      nonce: nonceBase64,
      intents: [],
    }),
  };
}

export async function signNep413Payload(
  unsignedData: Nep413UnsignedData,
  accountId: string
): Promise<Nep413SignedData> {
  if (!window.selector) {
    throw new Error("NEAR wallet is not initialized.");
  }
  const wallet = await window.selector.wallet();
  if (!wallet?.signMessage) {
    throw new Error(
      "The connected NEAR wallet does not support message signing."
    );
  }

  const nonce = decodeBase64Value(unsignedData.payload.nonce);
  if (nonce.length !== 32) {
    throw new Error("The NEP-413 nonce must be 32 bytes.");
  }

  const signed = await wallet.signMessage({
    message: unsignedData.payload.message,
    recipient: unsignedData.payload.recipient,
    nonce,
    signerId: accountId,
    network: config_near.networkId,
    ...(unsignedData.payload.callbackUrl
      ? { callbackUrl: unsignedData.payload.callbackUrl }
      : {}),
  });

  if (!signed?.publicKey || !signed?.signature) {
    throw new Error("The wallet did not return a public key and signature.");
  }
  if (signed.accountId && signed.accountId !== accountId) {
    throw new Error("The wallet signed with a different NEAR account.");
  }

  const publicKey = normalizeEd25519(String(signed.publicKey), 32);
  rememberNearSigningPublicKey(accountId, publicKey);

  return {
    ...unsignedData,
    public_key: publicKey,
    signature: normalizeEd25519(String(signed.signature), 64),
  };
}

function normalizeSecp256k1Signature(signature: string): string {
  const hex = signature.trim().replace(/^0x/i, "");
  if (!/^[0-9a-f]{130}$/i.test(hex)) {
    throw new Error("The wallet returned an invalid secp256k1 signature.");
  }
  const bytes = base16.decode(hex.toUpperCase());
  if (bytes[64] === 27 || bytes[64] === 28) bytes[64] -= 27;
  if (bytes[64] !== 0 && bytes[64] !== 1) {
    throw new Error("The wallet returned an invalid signature recovery byte.");
  }
  return `secp256k1:${base58.encode(bytes)}`;
}

function toSignatureBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value && typeof value === "object" && "signature" in value) {
    return toSignatureBytes((value as { signature: unknown }).signature);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error("The wallet returned an invalid Ed25519 signature.");
}

export async function signConfidentialPayload(
  unsignedData: ConfidentialUnsignedData,
  walletKind: ConfidentialWalletKind,
  walletAccountId: string,
  passkeyCredential?: PasskeyCredential
): Promise<ConfidentialSignedData> {
  const expectedStandard = getConfidentialSigningStandard(walletKind);
  if (unsignedData.standard !== expectedStandard) {
    throw new Error("The wallet signing standard does not match the intent.");
  }
  if (unsignedData.standard === "nep413") {
    return signNep413Payload(unsignedData, walletAccountId);
  }

  if (walletKind === "webauthn") {
    if (!passkeyCredential) {
      throw new Error("Select a Passkey before signing.");
    }
    const credentialAccountId = getPasskeyUserId(
      passkeyCredential.formattedPublicKey
    );
    if (credentialAccountId.toLowerCase() !== walletAccountId.toLowerCase()) {
      throw new Error("The selected Passkey changed before signing.");
    }
    const challenge = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(unsignedData.payload)
      )
    );
    const signed = await signWithPasskey({
      credentialId: passkeyCredential.credentialId,
      challenge,
      curveType: passkeyCredential.curveType,
    });
    return {
      ...unsignedData,
      public_key: passkeyCredential.formattedPublicKey,
      signature: signed.signature,
      client_data_json: signed.clientDataJSON,
      authenticator_data: signed.authenticatorData,
    };
  }

  if (walletKind === "evm") {
    const signer = await window.ethWeb3Provider?.getSigner();
    if (!signer) throw new Error("EVM wallet is not connected.");
    const signerAddress = (await signer.getAddress()).toLowerCase();
    if (signerAddress !== walletAccountId.toLowerCase()) {
      throw new Error("The EVM wallet switched accounts before signing.");
    }
    const signature = await signer.signMessage(unsignedData.payload);
    return {
      ...unsignedData,
      signature: normalizeSecp256k1Signature(signature),
    };
  }

  if (walletKind === "solana") {
    const solanaWallet = window.solanaWallet;
    if (!solanaWallet?.signMessage) {
      throw new Error("Solana wallet does not support message signing.");
    }
    const signature = toSignatureBytes(
      await solanaWallet.signMessage(
        new TextEncoder().encode(unsignedData.payload)
      )
    );
    if (signature.length !== 64) {
      throw new Error("The Solana wallet returned an invalid signature.");
    }
    return {
      ...unsignedData,
      public_key: `ed25519:${walletAccountId}`,
      signature: `ed25519:${base58.encode(signature)}`,
    };
  }

  const tronWallet = (
    window as typeof window & {
      tronWallet?: { signMessage?: (message: string) => Promise<string> };
    }
  ).tronWallet;
  if (!tronWallet?.signMessage) {
    throw new Error("TRON wallet does not support message signing.");
  }
  const signature = await tronWallet.signMessage(unsignedData.payload);
  return {
    ...unsignedData,
    signature: normalizeSecp256k1Signature(signature),
  };
}

export async function authenticateConfidentialUser(
  signedData: ConfidentialSignedData
): Promise<ConfidentialSession> {
  const response = await oneClickFetch<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    refreshExpiresIn: number;
  }>("/auth/authenticate", {
    method: "POST",
    body: JSON.stringify({ signedData }),
  });
  const now = Date.now();
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: now + response.expiresIn * 1000,
    refreshExpiresAt: now + response.refreshExpiresIn * 1000,
  };
}

export async function refreshConfidentialSession(
  session: ConfidentialSession
): Promise<ConfidentialSession> {
  const response = await oneClickFetch<{
    accessToken: string;
    expiresIn: number;
  }>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  return {
    ...session,
    accessToken: response.accessToken,
    expiresAt: Date.now() + response.expiresIn * 1000,
  };
}

export async function getConfidentialBalances(
  accessToken: string
): Promise<ConfidentialBalance[]> {
  const response = await oneClickFetch<{ balances: ConfidentialBalance[] }>(
    "/account/balances",
    { accessToken }
  );
  return Array.isArray(response.balances) ? response.balances : [];
}

export async function getPublicIntentsBalances(
  accountId: string,
  tokenIds: string[]
): Promise<ConfidentialBalance[]> {
  const uniqueTokenIds = Array.from(
    new Set(tokenIds.filter((tokenId) => Boolean(tokenId)))
  );
  const balances: ConfidentialBalance[] = [];

  for (
    let offset = 0;
    offset < uniqueTokenIds.length;
    offset += INTENTS_BALANCE_BATCH_SIZE
  ) {
    const batch = uniqueTokenIds.slice(
      offset,
      offset + INTENTS_BALANCE_BATCH_SIZE
    );
    const amounts = await viewIntentsContract<string[]>("mt_batch_balance_of", {
      account_id: accountId,
      token_ids: batch,
    });
    if (!Array.isArray(amounts) || amounts.length !== batch.length) {
      throw new Error("NEAR Intents returned invalid public balances.");
    }
    batch.forEach((tokenId, index) => {
      const available = amounts[index];
      if (typeof available === "string" && /^\d+$/.test(available)) {
        balances.push({ tokenId, available, source: "public" });
      }
    });
  }

  return balances;
}

export async function getOneClickTokens(): Promise<OneClickToken[]> {
  const [tokens, tokenMetadatas] = await Promise.all([
    fetchIntentsTokens(),
    getMultichainTokensByChains(CONFIDENTIAL_SUPPORT_CHAINS.join(",")),
  ]);
  const iconByAssetId = new Map<string, string>();
  const metadataByAssetId = new Map<string, typeof tokenMetadatas[number]>();
  tokenMetadatas.forEach((token) => {
    if (!token.assetId) return;
    metadataByAssetId.set(token.assetId, token);
    metadataByAssetId.set(token.assetId.toLowerCase(), token);
    if (token.icon) {
      iconByAssetId.set(token.assetId, token.icon);
      iconByAssetId.set(token.assetId.toLowerCase(), token.icon);
    }
  });

  return tokens
    .filter((token) => isConfidentialSupportedBlockchain(token.blockchain))
    .map((token) => {
      const metadata =
        metadataByAssetId.get(token.assetId) ||
        metadataByAssetId.get(token.assetId.toLowerCase());
      const metadataIcon =
        iconByAssetId.get(token.assetId) ||
        iconByAssetId.get(token.assetId.toLowerCase());
      let icon = metadataIcon || EMPTY_TOKEN_ICON;

      if (token.assetId === MONAD_TOKEN_ID) icon = MONAD_TOKEN_ICON;
      if (token.assetId === "near") icon = NEAR_ICON;

      const isSolana = walletKindFromBlockchain(token.blockchain) === "solana";
      const isNativeSol = token.assetId === NATIVE_SOL_INTENTS_ASSET_ID;
      const contractAddress =
        isSolana && !isNativeSol
          ? token.contractAddress || metadata?.contractAddress
          : token.contractAddress;

      return { ...token, contractAddress, icon };
    });
}

/**
 * Partner-authenticated 1Click quote (hardcoded partner JWT / referral / appFees).
 */
export async function requestConfidentialPartnerQuote(params: {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  refundTo: string;
  recipient: string;
  depositType: "ORIGIN_CHAIN" | "INTENTS" | "CONFIDENTIAL_INTENTS";
  refundType: "ORIGIN_CHAIN" | "INTENTS" | "CONFIDENTIAL_INTENTS";
  recipientType: "DESTINATION_CHAIN" | "INTENTS" | "CONFIDENTIAL_INTENTS";
  dry?: boolean;
  slippageTolerance?: number;
  deadline?: string;
}): Promise<ConfidentialQuoteResponse> {
  const response = await oneClickFetch<ConfidentialQuoteResponse>("/quote", {
    method: "POST",
    accessToken: CONFIDENTIAL_PARTNER_JWT,
    body: JSON.stringify({
      dry: params.dry ?? false,
      swapType: "EXACT_INPUT",
      slippageTolerance: params.slippageTolerance ?? CONFIDENTIAL_SLIPPAGE_BPS,
      originAsset: params.originAsset,
      depositType: params.depositType,
      destinationAsset: params.destinationAsset,
      amount: params.amount,
      refundTo: params.refundTo,
      refundType: params.refundType,
      recipient: params.recipient,
      recipientType: params.recipientType,
      deadline:
        params.deadline ||
        new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      referral: CONFIDENTIAL_REFERRAL,
      quoteWaitingTimeMs: CONFIDENTIAL_QUOTE_WAITING_TIME_MS,
      appFees: getConfidentialAppFees(),
      confidentiality: "basic",
    }),
  });
  if (!response?.quote) {
    throw new Error("Failed to get quote");
  }
  return response;
}

/** Chain wallet → confidential account (privacy deposit). */
export async function requestConfidentialDepositQuote(params: {
  originAsset: string;
  amount: string;
  slippageTolerance: number;
  confidentialAccountId: string;
  refundTo: string;
  dry?: boolean;
}): Promise<ConfidentialQuoteResponse> {
  return requestConfidentialPartnerQuote({
    originAsset: params.originAsset,
    destinationAsset: params.originAsset,
    amount: params.amount,
    refundTo: params.refundTo,
    recipient: params.confidentialAccountId,
    depositType: "ORIGIN_CHAIN",
    refundType: "ORIGIN_CHAIN",
    recipientType: "CONFIDENTIAL_INTENTS",
    dry: params.dry,
    slippageTolerance: params.slippageTolerance,
  });
}

/**
 * Confidential balance → destination chain (privacy swap + withdraw, one signed intent).
 * Use dry:true for UI preview (no depositAddress).
 */
export async function requestConfidentialSwapWithdrawQuote(params: {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  slippageTolerance: number;
  confidentialAccountId: string;
  recipient: string;
  dry?: boolean;
}): Promise<ConfidentialQuoteResponse> {
  return requestConfidentialPartnerQuote({
    originAsset: params.originAsset,
    destinationAsset: params.destinationAsset,
    amount: params.amount,
    refundTo: params.confidentialAccountId,
    recipient: params.recipient,
    depositType: "CONFIDENTIAL_INTENTS",
    refundType: "CONFIDENTIAL_INTENTS",
    recipientType: "DESTINATION_CHAIN",
    dry: params.dry,
    slippageTolerance: params.slippageTolerance,
  });
}

/** @deprecated Prefer requestConfidentialSwapWithdrawQuote */
export async function requestConfidentialQuote(params: {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  slippageTolerance: number;
  accountId: string;
  recipient?: string;
  dry?: boolean;
}): Promise<ConfidentialQuoteResponse> {
  return requestConfidentialSwapWithdrawQuote({
    originAsset: params.originAsset,
    destinationAsset: params.destinationAsset,
    amount: params.amount,
    slippageTolerance: params.slippageTolerance,
    confidentialAccountId: params.accountId,
    recipient: params.recipient || params.accountId,
    dry: params.dry,
  });
}

export async function transferToConfidentialDeposit(params: {
  walletKind: Exclude<ConfidentialWalletKind, "webauthn">;
  token: OneClickToken;
  depositAddress: string;
  amount: string;
  depositMemo?: string;
}): Promise<string> {
  const tokenAddress = params.token.contractAddress || "";
  const amount = params.amount;
  const depositAddress = params.depositAddress;

  if (params.walletKind === "evm") {
    const chainLabel = formatEvmChainName(params.token.blockchain || "");
    const chainConfig = EVM_CHAINS.find(
      (chain) => chain.label.toLowerCase() === chainLabel.toLowerCase()
    );
    if (!chainConfig) {
      throw new Error(`Unsupported EVM chain: ${chainLabel || "unknown"}`);
    }
    return transfer_evm({
      tokenAddress,
      depositAddress,
      amount,
      chain: chainLabel.toLowerCase(),
      chainId: chainConfig.id,
    });
  }
  if (params.walletKind === "solana") {
    const isNativeSol = params.token.assetId === NATIVE_SOL_INTENTS_ASSET_ID;
    if (!isNativeSol && !params.token.contractAddress) {
      throw new Error(
        `Solana token mint address is unavailable for ${params.token.symbol}.`
      );
    }
    return transfer_solana({
      tokenAddress: isNativeSol ? "" : params.token.contractAddress!,
      depositAddress,
      amount,
    });
  }
  if (params.walletKind === "near") {
    return transfer_near({
      tokenAddress,
      depositAddress,
      amount,
      msg: params.depositMemo,
    });
  }
  return transfer_tron({
    tokenAddress,
    depositAddress,
    amount,
  });
}

const DEPOSIT_ARRIVAL_POLL_MS = 5_000;
const DEPOSIT_ARRIVAL_MAX_ATTEMPTS = 120;

export async function waitForConfidentialDepositArrival(params: {
  accessToken: string;
  tokenId: string;
  baselineAvailable: string;
  depositAddress: string;
  depositMemo?: string;
  /** Fallback when status/balance have not settled yet (quote amountOut). */
  expectedAmountOut?: string;
}): Promise<{ creditedAmount: string; available: string }> {
  const baseline = BigInt(params.baselineAvailable || "0");
  for (let attempt = 0; attempt < DEPOSIT_ARRIVAL_MAX_ATTEMPTS; attempt += 1) {
    const [balancesResult, statusResult] = await Promise.allSettled([
      getConfidentialBalances(params.accessToken),
      getConfidentialSwapStatus({
        depositAddress: params.depositAddress,
        depositMemo: params.depositMemo,
      }),
    ]);

    let statusCredited: string | undefined;
    if (statusResult.status === "fulfilled") {
      const status = statusResult.value.status;
      const details = statusResult.value.swapDetails;
      const deposited =
        details?.depositedAmount ||
        details?.amountOut ||
        statusResult.value.quoteResponse?.quote?.amountOut;
      if (typeof deposited === "string" && /^\d+$/.test(deposited)) {
        statusCredited = deposited;
      }
      if (status === "SUCCESS") {
        const balances =
          balancesResult.status === "fulfilled" ? balancesResult.value : [];
        const available = getConfidentialAvailableForAsset(
          balances,
          params.tokenId
        );
        const delta = BigInt(available) - baseline;
        const creditedAmount =
          statusCredited ||
          (delta > BigInt(0) ? delta.toString() : "") ||
          params.expectedAmountOut ||
          "0";
        if (BigInt(creditedAmount) <= BigInt(0)) {
          throw new Error("Confidential deposit credited amount is missing");
        }
        return { creditedAmount, available };
      }
      if (status === "REFUNDED" || status === "FAILED") {
        throw new Error(
          status === "REFUNDED"
            ? "Deposit was refunded to the source wallet"
            : "Confidential deposit failed"
        );
      }
    }

    if (balancesResult.status === "fulfilled") {
      const available = getConfidentialAvailableForAsset(
        balancesResult.value,
        params.tokenId
      );
      const delta = BigInt(available) - baseline;
      if (delta > BigInt(0)) {
        return {
          creditedAmount: statusCredited || delta.toString(),
          available,
        };
      }
    }

    await new Promise((resolve) =>
      setTimeout(resolve, DEPOSIT_ARRIVAL_POLL_MS)
    );
  }
  throw new Error(
    "Deposit not detected yet. Your funds are safe — the balance will update once the deposit lands."
  );
}

export async function generateConfidentialIntent(params: {
  accountId: string;
  depositAddress: string;
  standard: ConfidentialSigningStandard;
}): Promise<{ intent: ConfidentialUnsignedData; correlationId: string }> {
  return oneClickFetch("/generate-intent", {
    method: "POST",
    accessToken: CONFIDENTIAL_PARTNER_JWT,
    body: JSON.stringify({
      type: "swap_transfer",
      standard: params.standard,
      signerId: params.accountId,
      depositAddress: params.depositAddress,
    }),
  });
}

export async function submitConfidentialIntent(
  signedData: ConfidentialSignedData
): Promise<{ intentHash: string; correlationId: string }> {
  return oneClickFetch("/submit-intent", {
    method: "POST",
    accessToken: CONFIDENTIAL_PARTNER_JWT,
    body: JSON.stringify({ type: "swap_transfer", signedData }),
  });
}

export async function getConfidentialSwapStatus(params: {
  depositAddress: string;
  depositMemo?: string;
}): Promise<ConfidentialSwapStatusResponse> {
  const query = new URLSearchParams({ depositAddress: params.depositAddress });
  if (params.depositMemo) query.set("depositMemo", params.depositMemo);
  return oneClickFetch(`/status?${query.toString()}`, {
    accessToken: CONFIDENTIAL_PARTNER_JWT,
  });
}
