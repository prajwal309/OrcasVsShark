# Deploy Orcas vs Sharks on one Node.js server

Use one Linux server running Node.js 22, with a writable, persistent local
volume formatted for Linux and mounted at `/srv/orcas-data`. The examples
use systemd and Caddy. Install Node and npm system-wide so the service can
find them in `/usr/local/bin` or `/usr/bin`. On Ubuntu or Debian, install the
other dependencies with:

```sh
sudo apt-get update
sudo apt-get install -y git build-essential python3 sqlite3 caddy
node --version
npm --version
```

Point the production DNS record at the host. Allow inbound TCP 80 and
443 for Caddy. Next.js listens on loopback port 3000. Set the clock to
synchronize with a reliable time source so persisted ranked deadlines
remain accurate. [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)

## Prepare the host and build a release

Attach the persistent volume, use `lsblk -f` to identify its filesystem UUID,
and add a persistent mount entry in `/etc/fstab`. For an ext4 volume, use the
following after replacing `VOLUME_UUID`:

```text
UUID=VOLUME_UUID /srv/orcas-data ext4 defaults,nofail 0 2
```

Mount that volume before setting ownership. The service checks that the mount
is present and that the database is writable before it starts.

```sh
getent passwd orcas >/dev/null || sudo useradd --system --user-group --shell /usr/sbin/nologin orcas
sudo install -d -m 0755 /srv/orcas-data
sudo mount /srv/orcas-data
mountpoint -q /srv/orcas-data &&
  sudo chown orcas:orcas /srv/orcas-data &&
  sudo chmod 0700 /srv/orcas-data
sudo install -d -o "$USER" -g "$(id -gn)" -m 0755 /opt/orcas /opt/orcas/releases
sudo install -d -m 0750 /etc/orcas
```

Set `ORCAS_REF` to the verified commit containing the deployment changes.
Build as your release user so the SQLite native module matches the host.

```sh
umask 022
ORCAS_REF=YOUR_VERIFIED_COMMIT_SHA
release="/opt/orcas/releases/$ORCAS_REF"
git clone https://github.com/prajwal309/OrcasVsShark.git "$release"
git -C "$release" checkout --detach "$ORCAS_REF"
cd "$release"
npm ci
npm run build
```

## Configure the service and preserve the database

Copy the environment template on the first install. On later releases retain
the existing environment file.

```sh
sudo test -e /etc/orcas/orcas.env ||
  sudo install -m 0600 deploy/orcas.env.example /etc/orcas/orcas.env
sudoedit /etc/orcas/orcas.env
```

- Set `APP_ORIGIN=https://your-domain.example` to the exact public origin with
  no trailing slash. It is used for same-origin checks, secure session cookies,
  and optional Google sign-in.
- Keep `SQLITE_PATH=/srv/orcas-data/orcas.db` as the same absolute file path
  across releases. HTTPS production requires a prepared database file. The
  service opens that file and applies pending SQLite migrations.
- If Google is enabled, register the new exact origin plus
  `/api/account/google/callback` with the OAuth provider. Browsers generally
  need a new login if the hostname changes.

If the target already contains the production database, retain it and back it
up before starting the new release. To migrate a live database from another
host, stop writers on the source and create a consistent SQLite backup. Transfer
the snapshot securely to the new host as `/path/to/verified-orcas.db`.
Check the file exists, run `sqlite3 /path/to/verified-orcas.db 'PRAGMA quick_check;'`,
and confirm the result is `ok` and the expected accounts are present. Install the file only into
an empty destination, with the app stopped:

```sh
sudo -u orcas sh -c '
  mountpoint -q /srv/orcas-data &&
  test ! -e "$1" && test ! -e "$1-wal" && test ! -e "$1-shm"
' sh /srv/orcas-data/orcas.db &&
  sudo install -o orcas -g orcas -m 0600 /path/to/verified-orcas.db /srv/orcas-data/orcas.db
```

For a genuinely new installation with no account data, initialize the empty
volume explicitly from the built release directory:

```sh
mountpoint -q /srv/orcas-data &&
  sudo -u orcas env SQLITE_PATH=/srv/orcas-data/orcas.db npm run db:prepare
```

## Start and verify

From the release directory, install the supplied unit and switch the symlink to
this release. Install the Caddy site block and replace `play.example.com`
with the same hostname configured in `APP_ORIGIN`. Add the line
`import /etc/caddy/orcas.caddy` once at the top level of `/etc/caddy/Caddyfile`.
If the hostname is already configured there, use the supplied reverse proxy
in its existing site block.

```sh
sudo install -m 0644 deploy/orcas.service /etc/systemd/system/orcas.service
ln -sfn "$release" /opt/orcas/current.next
mv -Tf /opt/orcas/current.next /opt/orcas/current
sudo systemctl daemon-reload
sudo systemctl enable orcas
sudo systemctl restart orcas

sudo test -e /etc/caddy/orcas.caddy ||
  sudo install -m 0644 deploy/Caddyfile /etc/caddy/orcas.caddy
sudoedit /etc/caddy/orcas.caddy /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

```sh
curl --fail --show-error http://127.0.0.1:3000/api/health
curl --fail --show-error http://127.0.0.1:3000/api/ready
curl --fail --show-error https://play.example.com/api/ready
sudo journalctl -u orcas -n 50 --no-pager
```

Use your production hostname in the HTTPS check. `/api/health` answers independently of SQLite. `/api/ready` returns HTTP
503 until the database and schema are available. Sign in with an existing
account, check its progress or rating, and match two browsers to verify
online play. Ranked deadlines keep running through service restarts. At
startup the worker catches up from SQLite and atomically records each result
and both Elo changes. Requests also reconcile an overdue match.

For later deploys, build a new release, back up SQLite, switch `current`,
and restart the single service. Keep the volume mounted and leave
`SQLITE_PATH` unchanged. Roll back application code only to a release
compatible with the current database schema. Restoring a snapshot rolls back
writes made after that snapshot.

## Backups

Use SQLite's online backup command to capture a consistent database, including
committed WAL changes. Store a protected copy off the server and verify
restores on a separate volume. Run this before an upgrade and on a regular
schedule. [SQLite online backup documentation](https://www.sqlite.org/backup.html)

```sh
sudo install -d -o orcas -g orcas -m 0700 /srv/orcas-backups
backup="/srv/orcas-backups/orcas-$(date -u +%Y%m%dT%H%M%SZ).db"
sudo -u orcas sh -ec '
  umask 077
  test -s "$1"
  test ! -e "$2"
  sqlite3 "$1" ".timeout 5000" ".backup $2"
  test -s "$2"
  sqlite3 "$2" "PRAGMA quick_check;"
' sh /srv/orcas-data/orcas.db "$backup"
```

For a production restore, stop the service first. Move the existing database
and any WAL or SHM sidecars to a protected recovery location as a set, then
install the verified snapshot at `SQLITE_PATH` with owner `orcas` and mode
`0600`. Start the service and verify readiness and account data.

## Vercel previews

Vercel functions have a read-only deployment filesystem and temporary writable
storage. With Vercel system variables exposed, the app disables SQLite and
the ranked clock worker there. If those variables are hidden, set
`ORCAS_DISABLE_SQLITE=1` explicitly. The homepage, local games, guest
Academy, and `/api/health` can still load. Use the single-server deployment
above for sign-in, ranked games, and synced progress.
[Vercel function runtimes](https://vercel.com/docs/functions/runtimes)
[Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
