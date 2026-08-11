# Register invite codes

Closed registration uses single-use codes in D1 table `register_invite_codes`.

## Env switch

Worker env `REGISTER_INVITE_REQUIRED`:

- `true` — `/register` requires a valid unused invite code
- `false` / unset — registration is open (no code field)

## Seed codes (migration 0020)

Twenty codes were inserted by `api/migrations/0020_register_invite_codes.sql`.

## Append 20 more codes (CF D1 Console)

Run in the Cloudflare D1 SQL console (production or local). Codes use `DECASH-` + random hex.

```sql
-- D1 rejects long UNION ALL chains ("too many terms in compound SELECT").
-- Use a recursive CTE instead. Change the final LIMIT to generate more/fewer codes.
WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 20
)
INSERT INTO register_invite_codes (id, code, created_at)
SELECT
  lower(hex(randomblob(16))),
  'DECASH-' || substr(upper(hex(randomblob(4))), 1, 4) || '-' || substr(upper(hex(randomblob(4))), 1, 4),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM seq;
```

List unused codes:

```sql
SELECT code, created_at FROM register_invite_codes WHERE used_at IS NULL ORDER BY created_at DESC;
```
