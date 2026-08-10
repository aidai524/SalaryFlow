/** CDN logos shared with StableFlow (assets.dapdap.net). */

export const LogoHost = "https://assets.dapdap.net";
export const DefaultIcon = `${LogoHost}/tokens/default_icon.png`;

export const formatPath = (path: string) => (/^\//.test(path) ? path : `/${path}`);

export const getLogo = (path: string) => {
  path = formatPath(path);
  return `${LogoHost}${path}`;
};

export const getStableflowChainLogo = (name: string, suffix = "png") => {
  name = formatPath(name.toLowerCase());
  return getLogo(`/stableflow/networks${name}.${suffix}`);
};

export const getStableflowTokenLogo = (name: string, suffix = "png") => {
  name = formatPath(name.toLowerCase());
  return getLogo(`/stableflow/tokens${name}.${suffix}`);
};

export const getStableflowRouteLogo = (name: string) => {
  name = formatPath(name.toLowerCase());
  return getLogo(`/stableflow/routes${name}`);
};

/** Map 1Click blockchain codes / display names to CDN filenames. */
const CHAIN_LOGO_ALIAS: Record<string, string> = {
  eth: "ethereum",
  ethereum: "ethereum",
  base: "base",
  arb: "arbitrum",
  arbitrum: "arbitrum",
  op: "optimism",
  optimism: "optimism",
  pol: "polygon",
  polygon: "polygon",
  bsc: "bsc",
  "bnb chain": "bsc",
  avax: "avalanche",
  avalanche: "avalanche",
  gnosis: "gnosis",
  scroll: "scroll",
  monad: "monad",
  xlayer: "xlayer",
  "x layer": "xlayer",
  plasma: "plasma",
  bera: "berachain",
  berachain: "berachain",
  near: "near",
};

export function chainLogoUrl(blockchainOrNetwork: string): string {
  const key = String(blockchainOrNetwork || "").toLowerCase();
  const file = CHAIN_LOGO_ALIAS[key] || key.replace(/\s+/g, "");
  return getStableflowChainLogo(file);
}

export function tokenLogoUrl(symbol: string): string {
  const s = String(symbol || "").toUpperCase();
  // USDT0 shares USDT branding.
  const file = s === "USDT0" ? "usdt" : s.toLowerCase();
  return getStableflowTokenLogo(file);
}

export function routeLogoUrl(route = "nearintents"): string {
  return getStableflowRouteLogo(route);
}
