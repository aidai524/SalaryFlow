import { describe, expect, it } from "vitest";
import { isAddressValid, sameAddress, validateAddress } from "./address-validation";

describe("address validation", () => {
  it("accepts checksum EVM addresses", () => {
    expect(isAddressValid("0x1111111111111111111111111111111111111111", "evm")).toBe(true);
  });

  it("accepts named Near accounts and implicit hex accounts", () => {
    expect(isAddressValid("alice.near", "near")).toBe(true);
    expect(isAddressValid("a".repeat(64), "near")).toBe(true);
    expect(isAddressValid("0x1111111111111111111111111111111111111111", "near")).toBe(false);
  });

  it("accepts 32-byte Solana pubkeys and rejects EVM hex", () => {
    expect(isAddressValid("11111111111111111111111111111111", "solana")).toBe(true);
    expect(isAddressValid("0x1111111111111111111111111111111111111111", "solana")).toBe(false);
  });

  it("treats Solana addresses as case-sensitive", () => {
    const a = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
    expect(validateAddress(a, "solana").isValid).toBe(true);
    expect(sameAddress(a, a, "solana")).toBe(true);
    expect(sameAddress(a, a.toLowerCase(), "solana")).toBe(false);
  });

  it("treats EVM addresses as case-insensitive", () => {
    const a = "0x1111111111111111111111111111111111111111";
    expect(sameAddress(a, a.toUpperCase(), "evm")).toBe(true);
  });
});
