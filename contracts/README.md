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

## Deploy (Arbitrum mainnet only for this release)

Copy `.env.example` to `.env` in this directory and fill in values. Foundry loads `contracts/.env` automatically.

`PRIVATE_KEY` must be the 32-byte hex secret (66 characters: `0x` + 64 hex chars), not the wallet address. Confirm the signer before broadcasting:

```bash
set -a && source .env && set +a
cast wallet address --private-key "$PRIVATE_KEY"
```

Then deploy:

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url arbitrum --broadcast --verify
```

Omit `--verify` if `ARBISCAN_API_KEY` is empty.

Copy the printed address into:

- `src/config/batch-payout-chains.ts`
- `api/src/batch-payout-chains.ts`
