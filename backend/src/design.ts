/**
 * POST /api/design logic: check the request, ask Claude, return { reply, recipe }.
 */
import Anthropic from '@anthropic-ai/sdk';
import { normalizeRecipe } from '../../shared/recipe.ts';
import { AI_IMAGE_TYPES } from '../../shared/api.ts';
import type { ApiChatMessage, ApiImage, DesignApiRequest, DesignApiResponse } from '../../shared/api.ts';
import { config } from './config.ts';
import { SYSTEM_PROMPT } from './prompt.ts';
import { designResponseSchema } from './schema.ts';
import { UserFacingError } from './errors.ts';

const client = new Anthropic();

const MAX_IMAGE_BASE64 = 6_000_000; // ≈ 4.5 MB; the browser sends ~1024 px, usually < 400 KB
const MAX_HISTORY = 30;
const MAX_TEXT = 1000;

// ---------------------------------------------------------------------------
// Request validation: the body comes from the internet, so check everything.
// ---------------------------------------------------------------------------

const bad = (msg: string) => new UserFacingError(400, msg);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function parseDesignRequest(body: unknown): DesignApiRequest {
  if (!isObj(body)) throw bad('Invalid request.');
  const { history, message, image, current } = body;

  if (typeof message !== 'string' || message.length > MAX_TEXT) throw bad('Message is missing or too long.');
  if (!Array.isArray(history)) throw bad('Invalid chat history.');
  const chat: ApiChatMessage[] = history.slice(-MAX_HISTORY).map((m) => {
    if (!isObj(m) || (m.role !== 'user' && m.role !== 'assistant') || typeof m.text !== 'string') {
      throw bad('Invalid chat history.');
    }
    return { role: m.role, text: m.text.slice(0, MAX_TEXT) };
  });

  if (!isObj(image)) throw bad('Please upload a photo first.');
  const { mediaType, data, width, height, hasTransparency, palette } = image;
  if (!AI_IMAGE_TYPES.includes(mediaType as ApiImage['mediaType'])) throw bad('Unsupported image type.');
  if (typeof data !== 'string' || !data || data.length > MAX_IMAGE_BASE64 || !/^[A-Za-z0-9+/]+=*$/.test(data)) {
    throw bad('The image could not be read. Please try another one.');
  }

  return {
    history: chat,
    message: message.trim(),
    image: {
      mediaType: mediaType as ApiImage['mediaType'],
      data,
      width: Number(width) || 0,
      height: Number(height) || 0,
      hasTransparency: hasTransparency === true,
      palette: (Array.isArray(palette) ? palette : [])
        .filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))
        .slice(0, 8),
    },
    current: current ? normalizeRecipe(current) : null,
  };
}

// ---------------------------------------------------------------------------
// The Claude call
// ---------------------------------------------------------------------------

function buildMessages(req: DesignApiRequest): Anthropic.Beta.BetaMessageParam[] {
  const { image } = req;
  const facts = [
    `This is the customer's photo. Original size: ${image.width} × ${image.height} px.`,
    `Transparent background: ${image.hasTransparency ? 'yes (logo or cut-out)' : 'no'}.`,
    image.palette.length ? `Main colours we measured: ${image.palette.join(', ')}.` : '',
  ].join(' ');

  const last = [
    req.current
      ? `The design currently on screen (JSON):\n${JSON.stringify(req.current)}`
      : 'There is no design yet.',
    req.message
      ? `The customer says:\n<customer_message>\n${req.message}\n</customer_message>`
      : req.current
        ? 'The customer just uploaded this photo. They already chose the background on screen, so keep it and design around the photo.'
        : 'The customer just uploaded this photo. Create a first design for it.',
  ].join('\n\n');

  return [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.data },
          // The photo + instructions are the same on every turn of a chat: cache them.
          cache_control: { type: 'ephemeral' },
        },
        { type: 'text', text: facts },
      ],
    },
    // Earlier chat (consecutive messages with the same role are merged by the API).
    ...req.history.map((m): Anthropic.Beta.BetaMessageParam => ({
      role: m.role,
      content: m.text.trim() || (m.role === 'user' ? '(uploaded a photo)' : '(no reply)'),
    })),
    { role: 'user', content: last },
  ];
}

export async function designWithClaude(req: DesignApiRequest): Promise<DesignApiResponse> {
  if (!config.hasApiKey) {
    console.error('[design] ANTHROPIC_API_KEY is not set. Add it to backend/.env');
    throw new UserFacingError(503, 'The AI designer isn’t set up yet. Please tell the shop.');
  }
  const started = Date.now();
  // Server-side fallback (retry on another model if a request is declined) exists for Opus/Sonnet/Fable, not Haiku.
  const fallback = /^claude-(opus|sonnet|fable)/.test(config.model)
    ? { betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[], fallbacks: 'default' as const }
    : {};

  const response = await client.beta.messages.create({
    model: config.model,
    max_tokens: 16000,
    ...fallback,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: config.effort,
      format: { type: 'json_schema', schema: designResponseSchema },
    },
    messages: buildMessages(req),
  });

  const u = response.usage;
  console.log(
    `[design] ${response.model} ${Date.now() - started}ms in=${u.input_tokens} cached=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens} stop=${response.stop_reason}`,
  );

  if (response.stop_reason === 'refusal') {
    throw new UserFacingError(422, 'Sorry, I can’t help with that one. Could you try a different photo or request?');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new UserFacingError(502, 'The designer got stuck on that one. Please try again.');
  }

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UserFacingError(502, 'The designer sent something I couldn’t read. Please try again.');
  }
  const out = isObj(parsed) ? parsed : {};
  return {
    reply: typeof out.reply === 'string' && out.reply.trim() ? out.reply.trim().slice(0, 1000) : 'Here you go!',
    // Never trust AI output: clamp everything to values the renderer supports.
    recipe: normalizeRecipe(out.recipe),
  };
}
