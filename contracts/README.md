# DECash BatchPayout

Standalone Foundry project. Does not depend on the repo root `package.json`.

`BatchPayout.execute` pulls ERC-20 from the caller (approve + `transferFrom`) and loops transfers to 1Click deposit addresses. Any failed transfer reverts the whole transaction. `batchId` is consumed to prevent replay.

## Setup

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
cd contracts
forge install foundry-rs/forge-std
```

## Test

```bash
forge test -vv
```

## Deploy

Copy `.env.example` to `.env` in this directory and fill in values. Foundry loads `contracts/.env` automatically.

`PRIVATE_KEY` must be the 32-byte hex secret (66 characters: `0x` + 64 hex chars), not the wallet address. The deployer needs gas on each target chain (ETH on Ethereum / Arbitrum, BNB on BNB Chain). Confirm the signer before broadcasting:

```bash
set -a && source .env && set +a
cast wallet address --private-key "$PRIVATE_KEY"
```

Then deploy the same script on each origin chain:

```bash
# Arbitrum One (chainId 42161)
forge script script/Deploy.s.sol:Deploy --rpc-url arbitrum --broadcast --verify

# Ethereum mainnet (chainId 1)
forge script script/Deploy.s.sol:Deploy --rpc-url mainnet --broadcast --verify

# BNB Chain (chainId 56)
forge script script/Deploy.s.sol:Deploy --rpc-url bsc --broadcast --verify
```

Omit `--verify` if the matching `*SCAN_API_KEY` is empty. This script uses CREATE (not CREATE2); the address matches across chains only when the deployer nonce is the same.

Copy each printed address into:

- `src/config/batch-payout-chains.ts`
- `api/src/batch-payout-chains.ts`

Restart the API Worker after changing the backend config.
