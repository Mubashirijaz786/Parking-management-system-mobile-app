# Native ESC/POS printer module

The Android bridge is implemented in `android/app/src/main/java/com/parkease/app/ParkeasePrinterModule.kt`. It supports paired Bluetooth Classic printer discovery, SPP connection, ESC/POS text, native QR commands, and paper cut. The JavaScript boundary is `src/services/printer.ts`.

The receipt workflow persists the ticket before invoking printing, so retries use the existing ticket ID and never insert a second ticket.

Expo Go cannot provide this capability. Use `expo prebuild` / `expo run:android` with a custom development build and verify against a physical 58 mm printer.
