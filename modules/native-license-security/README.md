# Native license security boundary

The app keeps only an Ed25519 public key. Device-bound metadata should be stored using Android Keystore-backed encryption in the production native module. The TypeScript verifier is intentionally explicit about the offline-clock limitation and should be paired with native rollback metadata before release.
