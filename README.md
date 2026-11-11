# ParkEase

ParkEase is an offline-first Android parking operations app for Pakistan. It uses React Native + Expo development builds, Expo Router, SQLite, Zustand, and a feature-oriented service boundary for camera/OCR, Bluetooth ESC/POS printing, licensing, and backups.

## What is implemented

- SQLite schema and initialization/migration seed for business settings, rates, tickets, payments, watchlist, audits, operators, and licenses.
- Transactional parking entry with duplicate active-plate prevention, rate snapshotting, QR payload generation, payment status, and exact watchlist alerts.
- QR exit flow with local payload validation, manual plate lookup, paid/pay-at-exit logic, duplicate exit protection, and duration calculation.
- Dashboard, active parking, history, daily/weekly/monthly/custom reports, receipt preview with a real QR code, rates, business settings, watchlist, license activation, referrals, backup, and printer settings screens.
- Plate capture flow with on-device ML Kit text recognition and a manual fallback when the app is running in Expo Go.
- Ed25519 signed-license verifier and a separate Node/TypeScript license generator. The private key is never part of the mobile app.
- Secure owner-only Admin Panel screens backed by `backend/`, with PostgreSQL/Prisma customer, subscription, payment, device, license, referral, audit, and notification foundations.

## Run

```bash
npm install
npx expo start
```

For the online Super Admin features, follow [backend/README.md](backend/README.md), copy the root `.env.example` to `.env`, and set only the mobile-safe API URL and Ed25519 public key. The parking workflow itself does not require the backend once the device has a valid signed license.

Use a custom Android development build for camera/QR and plate OCR:

```bash
npx expo prebuild
npx expo run:android
```

`typecheck` runs the TypeScript compiler. `test` is reserved for the unit-test suite as it is expanded.

## Verification

Run the local checks before sharing a build:

```bash
npm run typecheck
npm test -- --runInBand
npx expo export --platform android
cd backend
npm run typecheck
npx prisma validate
```

Manual acceptance checks should cover: admin login with an invalid token, customer registration, device-bound license generation, offline activation and ACK2 import, expired-license record viewing, renewal from an existing expiry, payment methods and refund reversal, referral verification and next-renewal discount, monthly/weekly/daily/custom local reports, duplicate QR exit, watchlist matching, and airplane-mode entry/exit. Customer plate and parking-ticket data must remain in local SQLite; only owner subscription data is sent to the backend.

## Native release checklist

1. Expose confidence-bearing OCR results and tune plate cropping/validation for the target plate formats.
2. Test the Kotlin Bluetooth Classic ESC/POS bridge on a physical 58 mm printer: discovery, reconnect, timeout, retry, QR readability, paper width, and cut support.
3. Replace `EXPO_PUBLIC_LICENSE_PUBLIC_KEY` with the vendor public key at build time and add Keystore-backed device metadata/clock rollback handling.
4. Test the integrity-checked document-picker backup/restore and local CSV/PDF exports on the target Android versions.
5. Test airplane-mode cold starts, app restarts, duplicate QR scans, rate changes, expired/wrong-device licenses, watchlist false positives, and thousands of tickets on low/mid-range devices.

Bluetooth printing is still unavailable in Expo Go. Plate OCR also needs the custom development build because Expo Go cannot load the ML Kit native module; the app shows a clear manual-entry fallback instead of pretending the plate was read.
