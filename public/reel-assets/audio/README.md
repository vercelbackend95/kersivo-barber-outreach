# No-Show Reel audio

Add licensed audio files here for `npm run reel:mix:no-show`.

| File | When | Notes |
|------|------|-------|
| `beat.mp3` | 0.0s → end | UK drill/rap bed — you supply (royalty-free or licensed) |
| `tick.mp3` | 0.0s | Ticking clock, loop under first 3s |
| `buzzer.mp3` | 1.5s (frame 45) | Error buzzer on "NO SHOW" |
| `cash-fail.mp3` | 3.0s (frame 90) | Cash register fail on loss counter |
| `ding.mp3` | 6.0s (frame 180) | Notification ding on SMS scene |

## Mix command

```bash
npm run reel:mix:no-show
```

Input: `public/videos/no-show-reel.mp4` (muted render)  
Output: `public/videos/no-show-reel-final.mp4`

Missing files are skipped with a warning. At least one audio file is required.
