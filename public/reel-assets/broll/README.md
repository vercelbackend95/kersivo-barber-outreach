# B-roll folder

Remotion reads from `public/reel-assets/broll/`.

| File | Status | Notes |
|------|--------|-------|
| `busy-shop.mp4` | Drop-in | 2s vertical — clippers + client in chair |
| `fotel-wideo.webm` | Deprecated | Superseded by Remotion-animated `ddd.png` in chair scene |
| `ccc.webm` | Replaced | Superseded by `ddd.png` chair animation |
| `spinning-chair.mp4` | Optional | Remotion-generated fallback |

## Chair scene (NoShowReel scene 3)

Active approach: **Remotion animation** of `public/reel-assets/ddd.png` (source: `images/Ilustracje/ddd.png`, Adobe-cut alpha).

- Component: `FloatingChairBroll` — rotateY wobble + `HandheldCamera` + drop-shadow on black `RawBackground`
- No FFmpeg keying required

Optional legacy pipeline (`fotel wideo.mp4` → `npm run assets:fotel-video-key`) remains for other clips.

## Busy shop

Drop `busy-shop.mp4` here when ready, then `npm run reel:render:no-show`.
