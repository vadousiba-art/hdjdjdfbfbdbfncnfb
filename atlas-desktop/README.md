# ATLAS desktop

Jesse's ATLAS app for Windows, macOS and Linux (Electron).

- **Default: Atlas in YORU.** `npm start` opens YORU's Atlas section (`https://yoru-social.vercel.app/atlas`) in its own window. Sign in with your YORU account; voice, photos, the model picker and your conversation all work as on the website. No keys are on this computer: they stay on YORU's server.
- **Local mode (the original).** If Jesse's Python backend sits next to this folder (`../voice-assistant/backend/server.py`), the app starts it and loads the local interface (`src/index.html`) as before. Force a mode with `ATLAS_MODE=yoru` or `ATLAS_MODE=local`. Other settings: `ATLAS_YORU_URL`, `ATLAS_BACKEND_PORT` (default 5000; on macOS, AirPlay may already use 5000), `ATLAS_PYTHON`.

```bash
npm install
npm start          # run
npm run dist       # build an installer into release/
```

## What changed from the original files

- **Works with YORU** (above), with a normal title bar in YORU mode and a single window (opening ATLAS again focuses it).
- **Security.** `sandbox: true` on top of `contextIsolation` and no Node in the page; the window can only navigate to YORU (or the local interface), and other links open in your browser; new windows are blocked; only the microphone (and camera, for the local UI) may be granted, and only to those pages. The desktop helpers in `preload.js` (system stats, file picker, window buttons) are offered only to the local interface, never to a website, and `main.js` checks the sender too.
- **Fixes.** Disk usage now uses `fs.statfs` (the old `wmic` command has been removed from current Windows 11, so the reading was broken there) and works on every OS; CPU sampling can't divide by zero; the backend port is configurable; macOS builds include the microphone permission text.
- **Not included.** The Python backend (`voice-assistant/`) and the local interface (`src/`) weren't among the files supplied, so local mode needs them added next to this folder. No credentials were found in the supplied files.
