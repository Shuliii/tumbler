/**
 * The HTTP contract between the frontend and the backend.
 * POST /api/design   body: DesignApiRequest   → 200 DesignApiResponse | 4xx/5xx ApiError
 */
import type { DesignRecipe } from './recipe.ts';

export interface ApiChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export const AI_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;

export interface ApiImage {
  /** A downscaled copy for the AI to look at (the print always uses the original, which never leaves the browser). */
  mediaType: (typeof AI_IMAGE_TYPES)[number];
  /** Base64, no "data:" prefix. */
  data: string;
  /** Size of the ORIGINAL photo, so the AI knows how sharp it will print. */
  width: number;
  height: number;
  hasTransparency: boolean;
  /** Main colours measured in the browser, as hex. */
  palette: string[];
}

export interface DesignApiRequest {
  /** Earlier chat, oldest first, not including `message`. */
  history: ApiChatMessage[];
  /** What the customer just typed. Empty = they just uploaded a photo. */
  message: string;
  image: ApiImage;
  /** The design on screen right now, or null for the first design. */
  current: DesignRecipe | null;
}

export interface DesignApiResponse {
  reply: string;
  recipe: DesignRecipe;
}

export interface ApiError {
  /** Safe to show to the customer. */
  error: string;
}
