# Vercel preview and rollback

Phase 1 requires no environment variables, authentication services, database, or paid services. Use separate Vercel preview and production environments. Never add production credentials to a preview.

1. Push this fresh project to a new repository after reviewing the files.
2. Import it into Vercel with the Next.js preset, Node 22.x (declared in `package.json`), install command `npm ci`, and build command `npm run build`.
3. Deploy a preview (not production), then check `/api/health`, `/play`, both victory paths, keyboard/mobile play, refresh recovery, and browser console output.
4. Record the immutable preview URL and the source commit before promotion.

The local workspace initially had no Git repository, remote, Vercel project, or deployment credentials. A hosted preview requires a connected Vercel account/project. No production deployment is authorized by the Phase 1 work.

Before production, review accessibility with assistive technology and real devices, select a product license, complete required legal/privacy pages, configure error monitoring without personal data, domain/HTTPS, and operational ownership. There is no analytics collector in this phase.

Rollback: retain the last verified immutable Vercel deployment and promote it through Vercel’s rollback flow after checking its health. There are no Phase 1 migrations or server player data to roll back. Do not silently change the local-save schema: version changes require explicit compatibility or a user-visible recovery path. Local saves are browser conveniences, not backed-up cloud archives.

## Online preview

For private casual multiplayer, follow [multiplayer setup](multiplayer.md) with a separate PostgreSQL database for preview. Apply the migrations and application-role grants before deployment. Configure the server-only `DATABASE_URL` and the exact HTTPS `APP_ORIGIN`. Verify two browsers against the preview database. Back up the database before applying future migrations and retain the audit tables during an application rollback.
