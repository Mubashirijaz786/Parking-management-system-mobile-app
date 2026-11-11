# ParkEase Admin API

This service is the online owner/customer/subscription layer. Parking tickets, OCR, QR exits, rates, reports, and printing remain in the mobile app's local SQLite database.

## Local setup

1. Install PostgreSQL and create an empty `parkease` database.
2. Copy `.env.example` to `.env` and replace every secret. Generate a 32-byte Ed25519 private key and its public key; never put the private key in the mobile app or commit `.env`.

You can generate a pair with `npm run keys:generate`, then copy the two printed values into the backend `.env` and copy only the public value into the mobile `.env`.
3. Install and generate Prisma:

```powershell
npm install
npm run prisma:generate
```

4. Apply the committed database migrations and create all tables:

```powershell
npm run prisma:deploy
```

The committed migrations are stored under `prisma/migrations/` and are safe to apply repeatedly; Prisma records which migrations have already run.

When changing the schema during development, use `npm run prisma:migrate -- --name <change-name>` to create a new migration, then commit it.

5. Set a real `SEED_ADMIN_PASSWORD` (12+ characters), configure plan prices, then seed:

```powershell
npm run prisma:seed
```

6. Start the API:

```powershell
npm run dev
```

The health check is `http://127.0.0.1:4000/health`. The mobile development build uses `EXPO_PUBLIC_ADMIN_API_URL`; Android Emulator normally reaches the host at `http://10.0.2.2:4000`. For a physical phone, use the computer's LAN IP (for example `http://192.168.1.20:4000`) and allow the port through the local firewall.

See [API.md](API.md) for the protected route surface.

## Production deployment

Run the API on a private server/container with PostgreSQL reachable only from the API process. Inject `DATABASE_URL`, `ADMIN_JWT_SECRET`, and the Ed25519 key pair from a secret manager; do not bake them into the mobile build. Run `npm ci`, `npm run prisma:generate`, `npm run prisma:deploy`, and `npm start` during deployment. Put a TLS reverse proxy in front of the API, set `ADMIN_ORIGIN` to the real admin origin instead of `*`, restrict inbound database access, and configure automated encrypted PostgreSQL backups. The first owner account should be created with a one-time strong `SEED_ADMIN_PASSWORD`, then rotated through the deployment secret manager.

## Security boundary

Admin endpoints require a server-issued JWT and `SUPER_ADMIN` authorization. Passwords are bcrypt-hashed. License signatures are created only by this backend using `LICENSE_PRIVATE_KEY_HEX`; the mobile build receives only `EXPO_PUBLIC_LICENSE_PUBLIC_KEY`. All customer changes, payments, licenses, and activation acknowledgements are persisted or audited centrally.

Do not expose PostgreSQL directly to the phone. Put the API behind HTTPS and a reverse proxy before production, add rate limiting/MFA, and store secrets in the deployment secret manager.
