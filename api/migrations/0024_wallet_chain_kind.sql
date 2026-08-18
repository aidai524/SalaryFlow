-- Multi-chain payment wallets (EVM / Near / Solana).

ALTER TABLE users ADD COLUMN wallet_chain_kind TEXT;

UPDATE users
SET wallet_chain_kind = 'evm'
WHERE wallet_address IS NOT NULL AND (wallet_chain_kind IS NULL OR wallet_chain_kind = '');

ALTER TABLE payment_wallet_challenges ADD COLUMN chain_kind TEXT NOT NULL DEFAULT 'evm';
ALTER TABLE payment_wallet_challenges ADD COLUMN nonce TEXT;
ALTER TABLE payment_wallet_challenges ADD COLUMN recipient TEXT;

ALTER TABLE payout_verification_challenges ADD COLUMN nonce TEXT;
ALTER TABLE payout_verification_challenges ADD COLUMN recipient TEXT;
