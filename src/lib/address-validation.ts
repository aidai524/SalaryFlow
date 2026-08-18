/**
 * Address validation for EVM, Near, and Solana.
 * Near/Solana rules follow stableflow-x; Solana also checks 32-byte base58 decode.
 */

import { getAddress, isAddress } from "viem";
import type { ChainKind } from "@/config/chains";
import { getChainByNetwork } from "@/config/chains";

export type WalletChainKind = Exclude<ChainKind, "other">;

export interface AddressValidationResult {
  isValid: boolean;
  error?: string;
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decodeBase58(input: string): Uint8Array | null {
  if (!input) return null;
  let zeros = 0;
  while (zeros < input.length && input[zeros] === "1") zeros++;
  const size = Math.ceil(input.length * 0.733);
  const bytes = new Uint8Array(size);
  let length = 0;
  for (let i = zeros; i < input.length; i++) {
    let carry = BASE58_ALPHABET.indexOf(input[i]);
    if (carry < 0) return null;
    for (let j = 0; j < length; j++) {
      carry += bytes[size - 1 - j] * 58;
      bytes[size - 1 - j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes[size - 1 - length] = carry & 0xff;
      length++;
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + length);
  for (let i = 0; i < length; i++) out[zeros + i] = bytes[size - length + i];
  return out;
}

export function resolveChainKind(networkOrKind: string | null | undefined): WalletChainKind | null {
  const raw = String(networkOrKind || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "evm" || lower === "near" || lower === "solana") return lower;
  if (lower === "sol") return "solana";
  const chain = getChainByNetwork(raw);
  if (!chain || chain.chainKind === "other") return null;
  return chain.chainKind;
}

function validateEvmAddress(address: string): AddressValidationResult {
  if (!isAddress(address)) {
    return { isValid: false, error: "Invalid EVM address" };
  }
  return { isValid: true };
}

function validateNearAddress(address: string): AddressValidationResult {
  if (address.length < 2 || address.length > 64) {
    return { isValid: false, error: "NEAR address must be 2-64 characters long" };
  }
  if (address.startsWith(".") || address.endsWith(".")) {
    return { isValid: false, error: "NEAR address cannot start or end with a dot" };
  }
  if (address.includes("..")) {
    return { isValid: false, error: "NEAR address cannot contain consecutive dots" };
  }
  if (/^[0-9a-f]{64}$/i.test(address)) {
    return { isValid: true };
  }
  if (address.startsWith("0x") || address.startsWith("0X")) {
    return { isValid: false, error: "Invalid NEAR address" };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(address)) {
    return { isValid: false, error: "Invalid NEAR address" };
  }
  const labelPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;
  if (!address.split(".").every((label) => labelPattern.test(label))) {
    return { isValid: false, error: "NEAR address labels must start/end with letters or numbers" };
  }
  if (/^\d+$/.test(address)) {
    return { isValid: false, error: "NEAR address cannot be purely numeric" };
  }
  if (!/[a-zA-Z]/.test(address)) {
    return { isValid: false, error: "NEAR address must contain at least one letter" };
  }
  return { isValid: true };
}

function validateSolanaAddress(address: string): AddressValidationResult {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return { isValid: false, error: "Invalid Solana address" };
  }
  const decoded = decodeBase58(address);
  if (!decoded || decoded.length !== 32) {
    return { isValid: false, error: "Invalid Solana address" };
  }
  return { isValid: true };
}

export function validateAddress(
  address: string,
  chainKind: WalletChainKind | string | null | undefined,
): AddressValidationResult {
  const trimmed = String(address || "").trim();
  if (!trimmed) return { isValid: false, error: "Address cannot be empty" };
  const kind = resolveChainKind(chainKind);
  if (!kind) return { isValid: false, error: "Unsupported network" };
  if (kind === "evm") return validateEvmAddress(trimmed);
  if (kind === "near") return validateNearAddress(trimmed);
  return validateSolanaAddress(trimmed);
}

export function isAddressValid(
  address: string,
  chainKind: WalletChainKind | string | null | undefined,
): boolean {
  return validateAddress(address, chainKind).isValid;
}

export function normalizeAddress(
  address: string,
  chainKind: WalletChainKind | string | null | undefined,
): string | null {
  const trimmed = String(address || "").trim();
  const kind = resolveChainKind(chainKind);
  if (!kind || !validateAddress(trimmed, kind).isValid) return null;
  if (kind === "evm") return getAddress(trimmed);
  if (kind === "near") return trimmed.toLowerCase();
  return trimmed;
}

export function sameAddress(
  a: string | null | undefined,
  b: string | null | undefined,
  chainKind?: WalletChainKind | string | null,
): boolean {
  if (!a || !b) return false;
  const kind = resolveChainKind(chainKind);
  if (kind === "solana") return a.trim() === b.trim();
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function getAddressPlaceholder(chainKind: WalletChainKind | string | null | undefined): string {
  const kind = resolveChainKind(chainKind);
  if (kind === "near") return "alice.near";
  if (kind === "solana") return "Solana address";
  return "0x…";
}
