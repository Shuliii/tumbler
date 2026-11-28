# Tumbler Studio (prototype)

Upload a photo or logo, chat with the AI, and get a print-ready wrap for a 20oz skinny tumbler.

## Run it

```
npm install                                   # once, installs frontend + backend
cp backend/.env.example backend/.env          # then put your ANTHROPIC_API_KEY in backend/.env
npm run dev                                   # API on :8787, app on http://localhost:5173
```

No key or no internet? Create `frontend/.env.local` with `VITE_MOCK_AI=true` to use the offline keyword mock.

Other commands: `npm run typecheck` (both sides), `npm run build` (frontend into `frontend/dist/`).

## Layout

```
tumbler/
├─ package.json        npm workspaces: runs frontend + backend together
├─ shared/             the contract both sides use
│  ├─ recipe.ts        the design recipe + normalizeRecipe() (validates anything an AI returns)
│  └─ api.ts           request/response shapes of POST /api/design
├─ frontend/           Vite + React + TypeScript + Three.js (the screen)
│  └─ src/ai/designer.ts   calls the backend (or the mock)
└─ backend/            Node + Express + TypeScript (holds the API key, talks to Claude)
   ├─ .env.example     settings: ANTHROPIC_API_KEY, DESIGN_MODEL, DESIGN_EFFORT, PORT
   └─ src/
      ├─ server.ts     routes, error handling
      ├─ design.ts     validates the request, calls Claude, returns { reply, recipe }
      ├─ prompt.ts     the designer instructions Claude gets
      ├─ schema.ts     forces Claude's answer into the recipe shape (structured output)
      ├─ rateLimit.ts  per-visitor request limit
      └─ config.ts     reads the environment
```

## How a chat turn works

```
browser                                   backend                          Claude
───────                                   ───────                          ──────
photo (original stays here) ─┐
small 1024px copy ───────────┼─► POST /api/design ─► validate ─► photo + chat + current recipe ─►
chat + current recipe ───────┘                                    ◄─ { reply, recipe } (JSON schema)
◄─────────────────── { reply, recipe } ◄─ normalizeRecipe()
renderer draws recipe with the ORIGINAL photo ─► 3D preview / flat view / 300 DPI PNG
```

The backend runs TypeScript directly with Node (no build step); `tsc` is only used to type-check.
