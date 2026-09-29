# Vercel preview and rollback

Phase 1 requires no environment variables, authentication services, database, or paid services. Use separate Vercel preview and production environments. Never add production credentials to a preview.

1. Push this fresh project to a new repository after reviewing the files.
2. Import it into Vercel with the Next.js preset, Node 22, install command `npm ci`, and build command `npm run build`.
3. Deploy a preview (not production), then check `/api/health`, `/play`, both victory paths, keyboard/mobile play, refresh recovery, and browser console output.
4. Record the immutable preview URL and the source commit before promotion.

The local workspace initially had no Git repository, remote, Vercel project, or deployment credentials. A hosted preview requires a connected Vercel account/project. No production deployment is authorized by the Phase 1 work.

Before production, review accessibility with assistive technology and real devices, select a product license, complete required legal/privacy pages, configure error monitoring without personal data, domain/HTTPS, and operational ownership. There is no analytics collector in this phase.

Rollback: retain the last verified immutable Vercel deployment and promote it through Vercel’s rollback flow after checking its health. There are no Phase 1 migrations or server player data to roll back. Do not silently change the local-save schema: version changes require explicit compatibility or a user-visible recovery path. Local saves are browser conveniences, not backed-up cloud archives.

## Online preview

For private casual online rooms, follow [multiplayer setup](multiplayer.md) using a separate development Supabase project. Apply the additive room migration before deploying the app and set all three environment variables before the preview build. Verify both browsers against real Supabase Auth/Realtime; the automated fixture suite does not replace that check. Database migration and production promotion have not been performed. Retain backups and roll back application code without dropping the audit tables.
