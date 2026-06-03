# Security Runbook

Before staging or production changes, confirm there is a verified backup and a manual approval from the repository owner.

For restore, use the latest verified backup, validate the restored state in staging, and only then continue toward production.

For rollback, redeploy the last known good release and verify login, Supabase connectivity, and core booking flows.
