# Native OCR module boundary

ParkEase deliberately keeps OCR behind a native module boundary. The scanner screen does not fabricate recognized text: it opens the camera and requires manual confirmation until this module is included in an Android development build.

Implementation target: Google ML Kit Text Recognition bundled on-device, with a plate crop/contrast preprocessing step and confidence surfaced to the user. The module must return `{ text, confidence }`, never silently normalize low-confidence characters, and must not make network requests.
