/**
 * JSON schema for Claude's answer (structured output). Claude is forced to
 * reply in exactly this shape: { reply, recipe }. The enums come from the
 * shared recipe contract, so the AI can only pick values the renderer knows.
 *
 * Number ranges are explained in the descriptions; the hard limits are
 * enforced afterwards by normalizeRecipe().
 */
import {
  BACKGROUND_STYLES,
  FONT_IDS,
  LAYOUTS,
  PATTERN_SHAPES,
  PHOTO_SHAPES,
  TEXT_POSITIONS,
} from '../../shared/recipe.ts';

const hex = { type: 'string', description: 'Hex colour, e.g. "#f4a6c1".' };
const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
const object = (properties: Record<string, object>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const num = (description: string) => ({ type: 'number', description });

const recipe = object({
  title: { type: 'string', description: 'Short name for the design, max 6 words.' },
  layout: { type: 'string', enum: [...LAYOUTS] },
  background: object({
    style: { type: 'string', enum: [...BACKGROUND_STYLES] },
    colors: { type: 'array', items: hex, description: '1 colour for solid, 2–3 for gradients.' },
  }),
  pattern: object({
    shape: { type: 'string', enum: [...PATTERN_SHAPES] },
    color: hex,
    opacity: num('0–1. Subtle patterns look best around 0.15–0.35.'),
    size: num('0.5–2, 1 = normal.'),
  }),
  photo: object({
    shape: { type: 'string', enum: [...PHOTO_SHAPES] },
    size: num('Photo height as a fraction of the wrap height, 0.15–0.95. Ignored for full-wrap.'),
    offsetY: num('-0.3–0.3, positive moves the photo down.'),
    focusX: num('0–1: horizontal point of the photo to keep in view when cropping (e.g. the face).'),
    focusY: num('0–1: vertical point of the photo to keep in view when cropping.'),
    zoom: num('1 = show as much of the photo as fits, up to 3 = crop in tightly.'),
    border: nullable(object({ color: hex, width: num('0–0.03 of the wrap height. 0.012 is a normal border.') })),
    shadow: { type: 'boolean' },
    repeatCount: { type: 'integer', description: 'Pattern layout only: photos across the wrap, 3–8.' },
  }),
  text: nullable(
    object({
      content: { type: 'string', description: 'Max 40 characters.' },
      font: { type: 'string', enum: [...FONT_IDS] },
      color: hex,
      outline: nullable(hex),
      position: { type: 'string', enum: [...TEXT_POSITIONS] },
      size: num('Font size as a fraction of the wrap height, 0.05–0.16. Long text shrinks automatically.'),
      band: nullable(hex),
    }),
  ),
});

export const designResponseSchema = object({
  reply: { type: 'string', description: 'Your chat message to the customer.' },
  recipe,
});
