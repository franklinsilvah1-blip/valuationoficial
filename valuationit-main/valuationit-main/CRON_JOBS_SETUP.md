# Cron Jobs Configuration Guide

This document explains how to configure the automated background jobs (cron jobs) that require secret validation for security.

## Security Overview

All background job endpoints now require a `CRON_SECRET` header for authentication. This prevents unauthorized access and resource exhaustion attacks.

## Protected Endpoints

The following endpoints require the `x-cron-secret` header:

1. **auto-sync-sheets** - Automatic Google Sheets synchronization
2. **check-expiring-plans** - Sends notifications for plans expiring in 5 days
3. **process-sync-queue** - Processes the queue for batch synchronization
4. **send-admin-notification** - Sends admin notifications (also accepts service role auth)
5. **send-monthly-affiliate-report** - Sends monthly performance reports to all active affiliates

## Cron Job Configuration

To set up cron jobs with secret validation, use the following SQL to create or update your cron jobs:

### 1. Auto Sync Sheets (Every 6 hours)

```sql
SELECT cron.schedule(
  'auto-sync-sheets',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT
    net.http_post(
        url:='https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/auto-sync-sheets',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', current_setting('app.settings.cron_secret', true)
        ),
        body:='{}'::jsonb
    ) as request_id;
  $$
);
```

### 2. Check Expiring Plans (Daily at 9 AM)

```sql
SELECT cron.schedule(
  'check-expiring-plans',
  '0 9 * * *', -- Daily at 9 AM
  $$
  SELECT
    net.http_post(
        url:='https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/check-expiring-plans',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', current_setting('app.settings.cron_secret', true)
        ),
        body:='{}'::jsonb
    ) as request_id;
  $$
);
```

### 3. Process Sync Queue (Every minute)

```sql
SELECT cron.schedule(
  'process-sync-queue',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/process-sync-queue',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', current_setting('app.settings.cron_secret', true)
        ),
        body:='{}'::jsonb
    ) as request_id;
  $$
);
```

### 4. Send Monthly Affiliate Report (Day 1 of each month at 8 AM)

```sql
SELECT cron.schedule(
  'send-monthly-affiliate-report',
  '0 8 1 * *', -- Day 1 of each month at 8 AM (UTC)
  $$
  SELECT
    net.http_post(
        url:='https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/send-monthly-affiliate-report',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', current_setting('app.settings.cron_secret', true)
        ),
        body:='{}'::jsonb
    ) as request_id;
  $$
);
```

**Nota:** O horário está em UTC. Para rodar às 08:00 no horário de Brasília (BRT), considere que UTC-3 = 11:00 UTC.

### 5. Check Affiliate Activity (Daily at 9 AM)

This function checks for inactive affiliates and sends reactivation/hygiene emails:
- **30 days without revenue**: Sends motivational email
- **45 days without revenue**: Sends warning email (account will be paused in 15 days)
- **60 days without revenue**: Deactivates the affiliate and sends deactivation email

```sql
SELECT cron.schedule(
  'check-affiliate-activity',
  '0 9 * * *', -- Daily at 9 AM (UTC)
  $$
  SELECT
    net.http_post(
        url:='https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/check-affiliate-activity',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', current_setting('app.settings.cron_secret', true)
        ),
        body:='{}'::jsonb
    ) as request_id;
  $$
);
```

### 6. Backup Database (Daily at 3 AM UTC)

This function performs a complete database backup to GitHub, creating two separate backups:
- **Critical tables** (profiles, wallets, affiliates, blog posts, etc.) → `backups/YYYY-MM-DD/critical/`
- **Full database** (all public tables) → `backups/YYYY-MM-DD/full/`

Requires `GITHUB_BACKUP_TOKEN` and `GITHUB_BACKUP_REPO` secrets.

```sql
SELECT cron.schedule(
  'backup-database',
  '0 3 * * *', -- Daily at 3 AM (UTC)
  $$
  SELECT
    net.http_post(
        url:='https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/backup-database',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', current_setting('app.settings.cron_secret', true)
        ),
        body:='{}'::jsonb
    ) as request_id;
  $$
);
```

## Setting the Cron Secret in Database

Before creating the cron jobs, you need to store the CRON_SECRET in your database settings:

```sql
-- Set the cron secret (use the same value as your CRON_SECRET environment variable)
ALTER DATABASE postgres SET app.settings.cron_secret = 'your-secret-value-here';
```

**IMPORTANT:** Replace `'your-secret-value-here'` with the actual value of your CRON_SECRET.

## Verification

To verify that the secret is set correctly:

```sql
SELECT current_setting('app.settings.cron_secret', true);
```

## Manual Testing

You can test the endpoints manually using curl:

```bash
# Test auto-sync-sheets
curl -X POST \
  https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/auto-sync-sheets \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: your-secret-value-here"

# Test monthly affiliate report
curl -X POST \
  https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/send-monthly-affiliate-report \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: your-secret-value-here"
```

## Security Notes

1. **Never commit the secret value** to version control
2. The `send-admin-notification` endpoint accepts both cron secret AND service role authentication, allowing it to be called by other edge functions
3. All endpoints return `401 Unauthorized` if the secret is missing or invalid
4. The secret is validated on every request before processing

## Troubleshooting

### Cron job fails with 401 Unauthorized

- Check that the database setting `app.settings.cron_secret` is set correctly
- Verify the secret matches the `CRON_SECRET` environment variable
- Ensure the `x-cron-secret` header is included in the cron job definition

### Function not triggering

- Check cron job logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
- Verify the cron schedule syntax is correct
- Ensure `pg_cron` and `pg_net` extensions are enabled

## Monitoring

To view all scheduled cron jobs:

```sql
SELECT * FROM cron.job;
```

To view recent cron job executions:

```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

## Affiliate Report Details

The monthly affiliate report sends a personalized email to each active affiliate containing:

- **New referrals count** for the previous month
- **Total commissions generated** in the previous month
- **Motivational phrase** based on performance level
- **Affiliate code** for easy reference
- **CTA button** to access the full affiliate panel

The report logs success/failure statistics for monitoring purposes.
