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

## Second pass
- **Hero sparks in KERSIVO style.** The warm projector beam and sand dust are gone: the field is now
  red and white sparks (a few near ones read as soft red stars) under a red light. The sparks follow
  the scroll: they stream down the page and are fully settled when the Scene 02 hub reaches the
  middle of the screen.
- **Scene 02 is a system, not an orbit.** Six sources (Google search, Maps, Instagram bio, a link you
  send, the QR code at the till and, new, a product you post) are wired by lines into the address
  card. The card is the lead figure: the domain, then what runs from it (website, online booking,
  retail pickup shop), Book now and Shop. Lines are routed from each card's port to a port on the
  hub, so they stay exact at every width; the sparks travel the same lines and hug the hub.
  Retail also appears in the intro and as a compare row ("Products you sell").
- **Cut to · Two ways to be found.** The two split-screen browser mock-ups are gone. The toggle now
  drives one card: an address bar that switches between the platform URL and your domain, and the
  five rows with a tick or a dash.
- **Scene 03 walkthrough.** The reticle is measured from layout offsets, so it lands on the right
  part when the section is entered mid-transition, while images load and on step 08 (it now tracks
  the frame as it narrows). It carries a "03 · Book now" tag; a workflow line runs through the steps
  and fills to the current one, and finished steps stay ticked.
- **Scene 04 booking.** No phone hardware: a polished dark screen with a progress bar, the step, and
  a summary bar with Continue. The diary sits under the screen instead of covering it.
- **Final.** The three places are premium cards: a lit shopfront fascia, an Instagram bio with
  avatar and link, and a dark Google result with the shop's initial and Website / Book online chips.

Screenshots: `C:/tmp/kersivo-shots/bw-cinematic-2/before` and `.../after` (375, 768, 1024, 1440).
