# OrcaSound Prototype

Small static prototype of the OrcaSound UI for testing audio playback, filtering by tags, and local (browser-only) comments.

## Quick start
Serve locally (recommended to avoid browser file:// restrictions):

1. Install dependencies (only dev tooling):
	```powershell
	npm install
	```
2. Start the static Node server (http://localhost:3000):
	```powershell
	npm start
	```
3. (Alternative) Start live reload dev server (http://localhost:5500):
	```powershell
	npm run dev
	```

VS Code tasks (Terminal > Run Task):
- `Run Static Server` — runs `npm start`.
- `Dev Live Reload` — runs `npm run dev` (auto reloads on file changes).

## Scripts
| Script | Purpose |
|--------|---------|
| `npm start` | Node static server defined in `server.js` on port 3000 |
| `npm run dev` | Live reload via `live-server` on port 5500 (no browser auto-open) |

## 404 page
`404.html` provides a friendly not found page. The Node server attempts to serve it whenever a requested file is missing.

## Files
- `index.html` — landing page
- `hydrophones.html` — main prototype UI (3-column layout)
- `explore.html` — placeholder explore page
- `take-action.html` — placeholder take action page
- `404.html` — not found page
- `css/styles.css` — styles (with dark landing & blue gradient nav)
- `js/app.js` — client logic: render list, filtering, playback, comments (LocalStorage)
- `sample-audio.json` — sample audio metadata (remote mp3 URLs)
- `server.js` — minimal static file server w/ MIME types & 404 fallback

## Map image
- Place Puget Sound map in `images/puget-sound-map.png` (already included).
- CSS markers overlay approximate hydrophone positions.

## Development notes
- Comments are stored in LocalStorage only. Refresh clears state only if you clear storage.
- Static map is a placeholder; upgrade to Leaflet / Mapbox for real geospatial features.
- Future ideas: audio tagging persistence, AI call classification, user auth.

## Accessibility & performance ideas (future)
- Add alt text & ARIA labels to nav and map markers.
- Convert images to optimized formats (webp/avif) & preload hero assets.
- Add focus styles for keyboard navigation.

## License
Prototype code provided for experimentation; add an explicit license if distributing.
