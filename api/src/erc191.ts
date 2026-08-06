const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function bytesToBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits: number[] = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.unshift(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return "1".repeat(zeros) + digits.map((digit) => BASE58_ALPHABET[digit]).join("");
}

export function encodeErc191Signature(hexSignature: string): string {
  const clean = hexSignature.startsWith("0x") ? hexSignature.slice(2) : hexSignature;
  if (!/^[a-fA-F0-9]{130}$/.test(clean)) throw new Error("Expected a 65-byte EVM signature");
  const bytes = new Uint8Array(65);
  for (let index = 0; index < 65; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  if (bytes[64] >= 27) bytes[64] -= 27;
  if (bytes[64] !== 0 && bytes[64] !== 1) throw new Error("Invalid EVM recovery byte");
  return `secp256k1:${bytesToBase58(bytes)}`;
}
