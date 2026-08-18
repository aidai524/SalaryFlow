export function formatAddress(
  address: string | null | undefined,
  prefix = 4,
  suffix = 5,
): string {
  if (!address) return "";
  if (!address.startsWith("0x") && address.length <= 32) return address;
  if (address.length <= prefix + suffix) return address;
  return `${address.slice(0, prefix)}...${address.slice(-suffix)}`;
}
