# Iron Requiem — WWII FPS

A World War II first-person shooter for **Android**, **Windows** and the **web**. It's built with Three.js and packaged with Capacitor (Android) and Electron (Windows).

## Mission 1: Dawn at Omaha
Storm Omaha Beach, clear the trench line and destroy the MG42 bunker.

## How builds work (no PC needed)
Every push to `main` triggers GitHub Actions (the **Actions** tab), which builds:
- **IronRequiem-Android**: an installable `.apk` for testing on your phone (plus an `.aab` for Google Play once signing is set up)
- **IronRequiem-Windows**: a Windows installer `.exe` and a portable `.exe`
- **Web version**: deployed to GitHub Pages

Download the files from the latest workflow run → **Artifacts**.

## Realistic characters
Put rigged GLB character models in `public/models/`:
- `us_soldier.glb`: American soldier
- `axis_soldier.glb`: German soldier

Include animations named `Idle` and `Run` (Walk is optional). The game loads them automatically. Without them it falls back to simple placeholder soldiers.

## Publishing on Google Play
1. Create a Google Play developer account ($25 one-time).
2. Add these repository secrets (Settings → Secrets → Actions): `KEYSTORE_B64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
3. Upload the generated `.aab` in the Play Console.

## Local development (optional)
```
npm install
npm run dev
```
