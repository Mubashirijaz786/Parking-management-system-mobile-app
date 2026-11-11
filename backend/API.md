# ParkEase Admin API surface

All `/admin/*` routes require `Authorization: Bearer <admin JWT>` and are authorized server-side as `SUPER_ADMIN`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Service health |
| POST | `/auth/login` | Owner login and 8-hour JWT |
| GET | `/admin/dashboard` | Database-backed business totals |
| GET/POST | `/admin/plans` | Read or create subscription plans |
| GET | `/admin/customers` | Search active/archived customers |
| POST | `/admin/customers` | Register customer, subscription, invoice, device, optional referral claim, and optional payment transactionally |
| GET | `/admin/customers/:id` | Customer, device, subscription, license, payment and referral history |
| PUT | `/admin/customers/:id` | Edit customer information |
| POST | `/admin/customers/:id/archive` | Soft-archive customer while preserving financial history |
| POST | `/admin/customers/:id/devices` | Replace active device binding and preserve old device history |
| POST | `/admin/customers/:id/payments` | Record a manual payment |
| POST | `/admin/customers/:id/payments/:paymentId/refund` | Mark a paid payment refunded and add a ledger reversal adjustment |
| POST | `/admin/customers/:id/adjustments` | Record an immutable ledger adjustment and recalculate invoice status |
| POST | `/admin/customers/:id/referrals` | Create one of up to two active referral codes |
| POST | `/admin/subscriptions/:id/renew` | Create an explicit renewal period and invoice |
| POST | `/admin/subscriptions/:id/suspend-renewals` | Stop automatic/future renewal status |
| POST | `/admin/subscriptions/:id/suspend` | Suspend the current subscription |
| POST | `/admin/subscriptions/:id/licenses` | Issue a device-bound Ed25519 license |
| GET | `/admin/notifications` | Expiry, unpaid-invoice alerts, and recent audited admin activity |
| GET | `/admin/referrals` | Referral claims and rewards |
| POST | `/admin/referral-claims/:id/verify` | Verify a qualifying referral reward amount |
| POST | `/admin/referral-rewards/:id/issue` | Finalize an approved referral reward; it is applied as an immutable discount adjustment on the customer's next renewal invoice |
| POST | `/activation/acknowledge` | Validate and persist a device-signed ACK2 license-bound offline acknowledgement |

The API intentionally does not receive parking tickets or vehicle plate data. Those remain in the customer's local SQLite database.

Outstanding balances are calculated from invoice charges, invoice discounts, immutable adjustments, and recorded payments. They are not derived from license issuance or plan prices alone.
