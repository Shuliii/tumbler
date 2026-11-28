/**
 * The one function the UI calls to "talk to the AI".
 *
 * Normally it calls our backend (POST /api/design), which asks Claude. The API
 * key lives on the server, never in the browser.
 * Set VITE_MOCK_AI=true (e.g. in frontend/.env.local) to use the offline
 * keyword mock instead: handy for demos without a key or internet.
 */
import { normalizeRecipe, type DesignRecipe } from '../recipe';
import type { UploadedImage } from '../image';
import type { ApiError, DesignApiRequest, DesignApiResponse } from '../../../shared/api.ts';
import { mockDesign } from './mockDesigner';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
}

export interface DesignRequest {
  /** Earlier messages, oldest first (not including `message`). */
  history: ChatMessage[];
  /** What the customer just typed. Empty string = "they just uploaded a photo". */
  message: string;
  image: UploadedImage;
  /** The design on screen right now, so the AI can tweak rather than restart. */
  current: DesignRecipe | null;
}

export interface DesignResponse {
  reply: string;
  recipe: DesignRecipe;
}

async function apiDesign(req: DesignRequest): Promise<DesignResponse> {
  const body: DesignApiRequest = {
    history: req.history.slice(-30).map((m) => ({ role: m.role, text: m.text })),
    message: req.message,
    image: {
      ...req.image.ai,
      width: req.image.width,
      height: req.image.height,
      hasTransparency: req.image.hasTransparency,
      palette: req.image.palette,
    },
    current: req.current,
  };

  let res: Response;
  try {
    res = await fetch('/api/design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Can’t reach the design server. Check your internet connection and try again.');
  }
  const data = (await res.json().catch(() => null)) as DesignApiResponse | ApiError | null;
  if (!res.ok || !data || 'error' in data) {
    throw new Error(data && 'error' in data ? data.error : `The design server had a problem (${res.status}).`);
  }
  // Validate again on this side: the network is a trust boundary too.
  return { reply: String(data.reply), recipe: normalizeRecipe(data.recipe) };
}

export const USING_MOCK_AI = import.meta.env.VITE_MOCK_AI === 'true';

export const requestDesign: (req: DesignRequest) => Promise<DesignResponse> = USING_MOCK_AI ? mockDesign : apiDesign;
