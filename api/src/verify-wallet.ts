import nacl from "tweetnacl";
import { verifyMessage, type Address, type Hex } from "viem";
import { decodeBase58, resolveChainKind, sameAddress, type WalletChainKind } from "./address-validation";

const NEP413_TAG = 2147484061; // 2^31 + 413
export const NEAR_SIGN_RECIPIENT = "salaryflow.app";

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeU32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function encodeBorshString(value: string): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  return concatBytes(encodeU32(encoded.length), encoded);
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodeSignatureBytes(value: string): Uint8Array | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("0x") && trimmed.length === 130) {
    const hex = trimmed.slice(2);
    const out = new Uint8Array(65);
    for (let i = 0; i < 65; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  return decodeBase64(trimmed) || decodeBase58(trimmed);
}

function decodeNearPublicKey(value: string): Uint8Array | null {
  const raw = value.startsWith("ed25519:") ? value.slice("ed25519:".length) : value;
  return decodeBase58(raw);
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

export function randomNonceBase64(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function verifyNep413(opts: {
  message: string;
  nonceB64: string;
  recipient: string;
  signature: string;
  publicKey: string;
  accountId: string;
  expectedAddress: string;
}): Promise<boolean> {
  if (!sameAddress(opts.accountId, opts.expectedAddress, "near")) return false;
  const nonce = decodeBase64(opts.nonceB64);
  if (!nonce || nonce.length !== 32) return false;
  const signature = decodeSignatureBytes(opts.signature);
  const publicKey = decodeNearPublicKey(opts.publicKey);
  if (!signature || signature.length !== 64 || !publicKey || publicKey.length !== 32) return false;

  const payload = concatBytes(
    encodeU32(NEP413_TAG),
    encodeBorshString(opts.message),
    nonce,
    encodeBorshString(opts.recipient),
    new Uint8Array([0]),
  );
  const hash = await sha256(payload);
  return nacl.sign.detached.verify(hash, signature, publicKey);
}

function verifySolanaMessage(opts: {
  message: string;
  signature: string;
  publicKey: string;
  expectedAddress: string;
}): boolean {
  if (!sameAddress(opts.publicKey || opts.expectedAddress, opts.expectedAddress, "solana")) return false;
  const signature = decodeSignatureBytes(opts.signature);
  const publicKey = decodeBase58(opts.expectedAddress);
  const message = new TextEncoder().encode(opts.message);
  if (!signature || signature.length !== 64 || !publicKey || publicKey.length !== 32) return false;
  return nacl.sign.detached.verify(message, signature, publicKey);
}

export async function verifyWalletOwnership(opts: {
  chainKind: WalletChainKind | string | null | undefined;
  address: string;
  message: string;
  signature: string;
  publicKey?: string | null;
  nonce?: string | null;
  recipient?: string | null;
  accountId?: string | null;
}): Promise<boolean> {
  const kind = resolveChainKind(opts.chainKind);
  if (!kind) return false;

  if (kind === "evm") {
    if (!/^0x[a-fA-F0-9]{130}$/.test(opts.signature)) return false;
    try {
      return await verifyMessage({
        address: opts.address as Address,
        message: opts.message,
        signature: opts.signature as Hex,
      });
    } catch {
      return false;
    }
  }

  if (kind === "near") {
    if (!opts.publicKey || !opts.nonce || !opts.recipient) return false;
    return verifyNep413({
      message: opts.message,
      nonceB64: opts.nonce,
      recipient: opts.recipient,
      signature: opts.signature,
      publicKey: opts.publicKey,
      accountId: opts.accountId || opts.address,
      expectedAddress: opts.address,
    });
  }

  return verifySolanaMessage({
    message: opts.message,
    signature: opts.signature,
    publicKey: opts.publicKey || opts.address,
    expectedAddress: opts.address,
  });
}
