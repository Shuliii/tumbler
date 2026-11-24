# Tumbler Studio (prototype)

Upload a photo or logo, chat with the AI, and get a print-ready wrap for a 20oz skinny tumbler.
The AI is **mocked** for now (step 1 of the build plan in `CLAUDE.md`).

## Run it

```
npm install
npm run dev        # opens http://localhost:5173
npm run build      # type-check + production build into dist/
```

## How it fits together

```
photo ──► chat ──► requestDesign() ──► design recipe (JSON) ──► renderer ──► print canvas (2790×2460)
                   (mock today,                                  draws with        ├─► 3D tumbler preview
                    Claude later)                                the ORIGINAL      ├─► flat print view
                                                                 photo             └─► PNG download (300 DPI)
```

| File | What it does |
| --- | --- |
| `src/recipe.ts` | **The contract.** Shape of the design recipe + `normalizeRecipe()` which validates/clamps anything an AI returns. |
| `src/ai/designer.ts` | The single function the UI calls. Swap the mock for a `fetch()` to the backend here. |
| `src/ai/mockDesigner.ts` | Fake AI: keyword rules ("pattern", "hearts", `add text "…"`, colours, "surprise me"). |
| `src/render/renderWrap.ts` | Draws a recipe onto a canvas; keeps the left/right edges seamless. |
| `src/render/exportPng.ts` | PNG download tagged as 300 DPI so print software opens it at 9.3 × 8.2 in. |
| `src/components/Tumbler3D.tsx` | Three.js tumbler using the print canvas as its texture. |
| `src/color.ts` | Palette extraction from the photo, colour helpers. |

## Things to try in the chat

`add text "Best Dog Mom"` · `pink with hearts` · `make it a repeating pattern` · `photo on both sides` ·
`full wrap` · `circle` / `arch` / `soft edges` · `bold font` · `banner` · `darker` · `surprise me`

## Next (step 2)

Small Node server with one endpoint: receives image + chat + current recipe, calls Claude with
structured output matching `DesignRecipe`, returns `{ reply, recipe }`. The API key stays on the server.
