# Tumbler Studio (prototype)

A web app for a friend's client who sells custom-printed tumblers (drinkware,
e.g. 20oz skinny tumblers). The shopper uploads their own photo or logo and
chats with an AI, which designs a nice wrap for a plain white tumbler.

The owner is a DevOps engineer, not an app developer. Explain app/frontend
concepts plainly; infra concepts need less explaining.

## Decisions so far (brainstorm, 20 Nov 2026)

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
- Preview: the design wrapped on a 3D white tumbler (Three.js).
- Cost: roughly $0.001 (Haiku 5.5) to $0.04 (Opus 5.5) per design, so the AI
  cost is cents.
- API key: the owner has an Anthropic API key for the prototype. For the live
  shop the friend should use their own key. The key must stay server-side,
  never in the browser. Never print or commit keys.
- Not decided yet: who the client sells to (gifts/pets vs business logos),
  and whether it ends up standalone or inside a shop (Shopify etc.).

## Build plan

1. **Frontend first** (current step), with a mocked AI that returns fixed
   recipes, so there's something to demo quickly and the recipe "contract" is
   pinned down. Single page, one nav: a chat panel (talk to the AI + upload an
   image) and a preview panel (3D tumbler + flat print view + download PNG).
2. Backend: a small endpoint that sends the image + chat to Claude and returns
   the recipe JSON (structured output), replacing the mock.

Environment: Windows, Node 26, npm 11. Suggested stack: Vite + React +
TypeScript, Three.js, small Node server for the Claude call.
