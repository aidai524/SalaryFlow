/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_API_PROXY?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_NEAR_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
