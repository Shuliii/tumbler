# Tumbler Studio (prototype)

A web app for the owner's friend, an Indonesian print shop that sells
custom tumblers (drinkware, e.g. 20oz skinny tumblers). The customer uploads
their own photo or logo and chats with an AI, which designs the tumbler; the
shop prints it on its own machine.

The owner is a DevOps engineer, not an app developer. Explain app/frontend
concepts plainly; infra concepts need less explaining. Reply in English.

## How the shop will use it (decided 24 Nov 2026)

One hosted web app (not a desktop install), used two ways:

- **In store:** the customer designs on the shop laptop (full-screen web app),
  then the staff prints it straight away.
- **Online:** the customer designs at home, clicks **Order** (name + WhatsApp
  number), gets an order code (e.g. #TB-0142) and a prefilled WhatsApp link.
  Payment is handled by the shop (bank transfer / QRIS / at pickup): **no
  payment gateway in the app**.
- **Staff Orders page** (password protected): list of orders with preview,
  customer, status; **Print** button; mark done.
- **Printing:** the Print button downloads the full-res file into the print
  software's **hot folder**, which prints it automatically (mirroring and
  colour handled there). Fallback if there is no hot folder: a small local
  "print helper" that receives jobs. A human always clicks Print (payment
  check, quality check); no auto-printing.
- The customer only ever sees a preview, never the full-res print file.
- Customer photos are personal: delete them automatically after ~30 days.
- Chat in English or Indonesian, including casual slang; AI tone in
  Indonesian: relaxed but polite ("Kak").
- Keep it reusable for other print shops later (multi-seller): products,
  sizes, branding and machine type are per-shop settings, no shop-specific
  hacks.

## Open question: which machine?

Not confirmed yet. It changes the design engine:

- **Sublimation** (white coated blank + heat press): full colour, photos,
  gradients, full wrap. The current demo targets this.
- **UV printer:** full colour on any bottle colour; may need a transparent
  background or a smaller print area.
- **Laser engraver:** removes coating, so one colour only (silver on a
  pre-coloured bottle). The background picker becomes "bottle colour" from
  stock; designs are text/logo/line art or dot-pattern photos; output is
  black-and-white (often SVG). Gradients only via ombre bottles or dot fades.
- If the shop has both a colour machine and a laser, add a "Colour print /
  Engraved" mode with separate design rules.

Also needed from the shop: printer brand/model and print software (hot
folder?), product list and sizes.

## Design decisions (brainstorm, 20 Nov 2026)

- The AI does NOT generate images. The customer supplies the image.
- Claude (vision) looks at the photo and returns a **design recipe** (JSON):
  layout (centred / repeating pattern / two sides / full wrap), background
  colours taken from the photo, patterns/shapes, optional text + font, and how
  to crop or place the photo.
- Code draws the recipe (canvas) at print size using the ORIGINAL photo, so
  it stays sharp and the customer's face/logo is never altered by AI.
  20oz skinny wrap ≈ 9.3 × 8.2 in at 300 DPI (≈ 2790 × 2460 px); left/right
  edges must join seamlessly.
- Optional later: background removal (rembg, open source), an image-editing
  model for "cartoonify" as a paid extra, 3 design options per customer.
- Preview: the design wrapped on a 3D tumbler (Three.js).
- Cost: roughly $0.001 (Haiku 5.5) to $0.04 (Opus 5.5) per design, so the AI
  cost is cents.
- API key: the owner has an Anthropic API key for the prototype. For the live
  shop the friend uses their own key. The key must stay server-side, never in
  the browser or on the shop laptop. Never print or commit keys.

## Build plan

1. **Frontend with mocked AI** (done): chat panel (upload + talk to the AI)
   and preview panel (3D tumbler, flat print view with seam check, background
   picker, download 300 DPI PNG).
2. **Backend** (next): small Node server that sends the image + chat to Claude
   and returns the recipe JSON (structured output), replacing the mock in
   `src/ai/designer.ts`. Holds the API key.
3. **Shop features:** QR code so customers upload photos from their phone to
   the shop laptop; Order form + WhatsApp link; staff Orders page with Print
   (hot folder); per-shop product sizes; Indonesian UI; photo auto-delete.
4. **Machine-specific output** once the machine type is known (see above).

Environment: Windows, Node 26, npm 11. Stack: Vite + React + TypeScript,
Three.js, small Node server for the Claude call.
