-- Persist employee destination-chain settlement tx from 1Click status.
-- History APIs must expose this receive tx, never admin funding/deposit hashes.

ALTER TABLE payment_attempts ADD COLUMN destination_tx_hash TEXT;
ALTER TABLE payment_attempts ADD COLUMN destination_tx_explorer_url TEXT;

-- Backfill from stored provider_response when 1Click already returned destination hashes.
UPDATE payment_attempts
SET
  destination_tx_hash = json_extract(
    provider_response,
    '$.swapDetails.destinationChainTxHashes[0].hash'
  ),
  destination_tx_explorer_url = json_extract(
    provider_response,
    '$.swapDetails.destinationChainTxHashes[0].explorerUrl'
  )
WHERE state = 'confirmed'
  AND destination_tx_hash IS NULL
  AND provider_response IS NOT NULL
  AND json_extract(
    provider_response,
    '$.swapDetails.destinationChainTxHashes[0].hash'
  ) IS NOT NULL;
