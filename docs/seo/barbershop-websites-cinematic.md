# /barbershop-websites — cinematic pass

Stacked on `barbershop-websites-v2` (PR #242). No change to URL, title, meta, canonical, JSON-LD,
form endpoints or data-track attributes.

## What changed
- **Opening film (hero + Why).** One sticky three.js layer (`src/lib/barbershopWebsite/film.ts`):
  warm dust in a projector beam aimed at the hero site; as "Why" scrolls in, the dust streams into the
  `yourshop.co.uk` domain and orbits it. Shutter-open entrance, film grain, vignette, floating
  "Google" and "New booking" chips, scroll cue.
- **Why.** Five real-looking source cards (search result, Maps, Instagram bio, a message, QR code)
  fly in from depth and beam into one domain; pulses run once lit. The profile/own-site switch now
  drives a split screen with a focus pull.
- **What to include.** A camera dollies in on each part of the example site with a reticle,
  01/08 counter and progress rail.
- **Booking.** Numbered steps, a fingertip tap on each choice, the phone in light and tilt, and a
  live diary that receives the booking on the last step with a confirmation toast.
- **Presence.** Each item says how Full KERSIVO handles it; ring score; "See it with Full KERSIVO"
  fills the gaps in red and lists how each is closed. Replaced the "covers the first four" line.
- **Offer.** Rotating light edge on the price card, pointer tilt and glare, setup steps as a
  timeline that draws on scroll.
- **Final.** "Try it with your shop's name": a local-only input that shows the domain on a
  shopfront, an Instagram bio and Google. Nothing is saved or sent.
- Film-style chapter index on wide screens.

Reduced motion: no WebGL, grain, shutter, tilt or zoom; every section is complete and static.
three.js and GSAP load after first paint.

## Open question
- Presence copy says photos are uploaded "in your KERSIVO dashboard". Onboarding has an asset
  uploader and barbers have photos, but `claimsPolicy` §3 does not list photos among dashboard
  self-config. Confirm, or reword to "send us your photos during onboarding".
