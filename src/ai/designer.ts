/**
 * The one function the UI calls to "talk to the AI".
 *
 * Step 1 (now): a mock that runs in the browser and returns canned recipes.
 * Step 2: replace `requestDesign` with a fetch() to our own small server,
 * which forwards the image + chat to Claude and returns the same
 * DesignResponse. The API key lives on that server, never in the browser.
 */
import type { DesignRecipe } from '../recipe';
import type { UploadedImage } from '../image';
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

export const requestDesign: (req: DesignRequest) => Promise<DesignResponse> = mockDesign;
