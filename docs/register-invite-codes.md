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
INSERT INTO register_invite_codes (id, code, created_at)
SELECT
  lower(hex(randomblob(16))),
  'DECASH-' || substr(upper(hex(randomblob(4))), 1, 4) || '-' || substr(upper(hex(randomblob(4))), 1, 4),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
  SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
  UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
  UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
  UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
);
```

List unused codes:

```sql
SELECT code, created_at FROM register_invite_codes WHERE used_at IS NULL ORDER BY created_at DESC;
```
