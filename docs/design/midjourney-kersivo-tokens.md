# Tokeny Midjourney — paleta Kersivo (opisy kolorów, bez hex)

Midjourney słabo rozumie `#0b0d10` itd. Używaj **tych samych sformułowań** w każdym prompcie.

## Mapowanie kolorów (z `src/styles/tokens.css`)

| Rola na stronie | Hex (CSS) | Opis dla Midjourney |
|-----------------|-----------|---------------------|
| Tło strony, export PNG | `#0b0d10` | **very dark charcoal gray**, cool near-black with a subtle blue-gray undertone, **not pure black** |
| Tekst / highlight UI | `#f1eee8` | **warm ivory cream**, soft off-white with a slight beige warmth, like warm paper |
| Akcent marki (CTA, badge) | `#d72638` | **vivid crimson red**, saturated barber-brand red, single accent only |

## Stały suffix stylu (wklej na końcu każdego promptu)

```
flat vector marketing illustration for premium barber shop booking software landing page, independent UK barbershop brand, clean geometric shapes, smooth controlled strokes, soft subtle gradients not flat clipart, dark mode UI aesthetic, limited palette very dark charcoal gray background warm ivory cream highlights vivid crimson red brand accent only, floating layered composition, soft vignette edges fading into the same dark charcoal gray background, generous negative space for web layout, professional modern not playful cartoon, no photorealism --style raw --stylize 80 --ar 4:5
```

## Jedna linia „style lock”

```
flat vector, premium barber SaaS landing, very dark charcoal gray background, warm ivory cream, vivid crimson red accent, dark mode, floating layers, edges dissolving into dark charcoal gray, --style raw --stylize 80 --ar 4:5
```

## Stały `--no`

```
--no Booksy, Fresha, competitor app, photograph, photorealistic, camera, stock photo, 3D render, glossy plastic, white background, bright pastel, childish cartoon, clipart sticker, harsh black outline, rustic vintage barbershop cliché, readable text, watermark, logo text, gibberish letters, square frame, polaroid, neon pink, purple gradient, marketplace grid mockup photo
```

## Tło pod przezroczysty PNG (po MJ)

W prompcie zamiast hex dopisz:

```
solid flat very dark charcoal gray background, no gradient sky, edges fade into same charcoal
```

Potem wytnij tło (remove.bg / Figma) — kolor tła w pliku powinien być blisko **very dark charcoal**, nie czysta czerń.

## Parametry MJ (stałe w serii)

| Parametr | Wartość |
|----------|---------|
| `--style raw` | zawsze |
| `--stylize` | `70–90` (ta sama liczba dla wszystkich 5) |
| `--chaos` | `0–10` |
| `--ar` | `4:5` lub `3:2` (jedna proporcja na całą serię) |

## Szablon promptu

```
[TEMAT: 1–2 zdania]. [SUFFIX STYLU]. [--no]
```

Przykład tematu (reszta z suffixu):

```
Independent barber shop with custom domain storefront and client list, one owned brand not anonymous tiles
```
