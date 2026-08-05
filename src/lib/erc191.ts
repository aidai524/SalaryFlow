// ERC-191 (Ethereum personal_sign) signed-intent encoding for NEAR Intents.
// Verifier expects: signature = secp256k1:r(32)||s(32)||v(1, 0/1) in base58.

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function bytesToBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const input = Array.from(bytes);
  const base = 58;
  let output: number[] = [];
  for (const b of input) {
    let carry = b;
    let i = 0;
    for (let j = output.length - 1; j >= 0 || carry !== 0; j--, i++) {
      if (j >= 0) {
        carry += output[j] << 8;
        output[j] = carry % base;
        carry = Math.floor(carry / base);
      } else {
        output = [carry % base, ...output];
        carry = Math.floor(carry / base);
      }
    }
  }
  let result = "1".repeat(zeros);
  for (const digit of output) result += BASE58_ALPHABET[digit];
  return result;
}

/**
 * Convert a hex signature from an EVM wallet (e.g. MetaMask signMessage, 65 bytes,
 * v = 27/28) into the NEAR Intents `secp256k1:...` base58 form with v normalized to {0,1}.
 */
export function encodeErc191Signature(hexSignature: string): string {
  const clean = hexSignature.startsWith("0x") ? hexSignature.slice(2) : hexSignature;
  if (clean.length !== 130) throw new Error(`Expected 65-byte signature, got ${clean.length / 2} bytes`);
  const r = clean.slice(0, 64);
  const s = clean.slice(64, 128);
  let v = parseInt(clean.slice(128, 130), 16);
  if (v >= 27) v -= 27; // normalize 27/28 → 0/1
  const bytes = new Uint8Array(65);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(r.slice(i * 2, i * 2 + 2), 16);
    bytes[32 + i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  bytes[64] = v;
  return `secp256k1:${bytesToBase58(bytes)}`;
}

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
