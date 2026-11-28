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
2. **Backend** (built 28 Nov 2026, needs a first real test with an API key):
   Express server, `POST /api/design` sends a 1024 px copy of the photo + chat
   + current recipe to Claude with a JSON-schema structured output and returns
   `{ reply, recipe }`. Model and effort are settings (`DESIGN_MODEL`,
   `DESIGN_EFFORT` in `backend/.env`; don't use `CLAUDE_*` names, Claude Code
   sets `CLAUDE_EFFORT`). Plan: compare Opus 5.5 vs Haiku 5.5 on real photos,
   then pick. `VITE_MOCK_AI=true` keeps the offline mock available.
3. **Shop features.** Done (rough, 28 Nov 2026): customer "Order this design"
   (name + WhatsApp → code TB-0001 + wa.me link to `SHOP_WHATSAPP`), original
   photo uploaded to `POST /api/photos`; admin page at `/admin` (list, filter,
   search, detail with 3D/flat, mark paid, Print = PNG download only when
   paid, printed/done/cancel, notes). Storage is behind interfaces
   (`backend/src/storage/`): JSON file + local folder in `backend/data/` for
   now; MySQL (owner's k8s cluster) and S3-compatible storage (MinIO or R2)
   later. **No login yet**: `requireStaff` in `backend/src/auth.ts` is a
   pass-through; add auth there before exposing /api/admin publicly.
   Still to do: QR phone upload, hot-folder printing, per-shop product sizes,
   Indonesian UI, photo auto-delete (k8s CronJob), remove the customer
   "Download PNG" button once ordering is live.
4. **Machine-specific output** once the machine type is known (see above).

Environment: Windows, Node 26, npm 11.

Repo layout (npm workspaces): `frontend/` (Vite + React + TypeScript +
Three.js), `backend/` (Node + Express + TypeScript, run directly by Node's
type stripping: relative imports need the `.ts` extension and type-only
imports must use `import type`), `shared/` (recipe contract + API types used
by both). `npm run dev` at the root starts both; `npm run typecheck` checks
both.
