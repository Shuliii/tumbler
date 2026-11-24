import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { ChatMessage, requestDesign } from './ai/designer';
import { BackgroundRecipe, DesignRecipe, WRAP, normalizeRecipe } from './recipe';
import { readableOn } from './color';
import { UploadedImage, loadUploadedImage } from './image';
import { RenderStats, drawWrap, prepareFonts } from './render/renderWrap';
import { downloadPng } from './render/exportPng';

let nextId = 1;
const msg = (role: ChatMessage['role'], text: string, imageUrl?: string): ChatMessage => ({ id: String(nextId++), role, text, imageUrl });

const WELCOME = msg(
  'assistant',
  'Hi! I’ll help you design your tumbler. Upload a photo or logo and I’ll create a wrap around it. Then just tell me what to change.',
);

export default function App() {
  // The full-size print canvas. Everything (3D, flat view, download) reads from it.
  const printCanvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = WRAP.widthPx;
    c.height = WRAP.heightPx;
    return c;
  }, []);
  const [version, setVersion] = useState(0);
  const [stats, setStats] = useState<RenderStats>({ photoPpi: null });

  const [image, setImage] = useState<UploadedImage | null>(null);
  const [recipe, setRecipe] = useState<DesignRecipe | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [busy, setBusy] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const push = (...m: ChatMessage[]) => setMessages((prev) => [...prev, ...m]);

  // Redraw the print canvas whenever the design or photo changes.
  useEffect(() => {
    // At most one full-size redraw per screen frame (the colour picker can fire many changes quickly).
    let cancelled = false;
    let frame = 0;
    prepareFonts(recipe)
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        frame = requestAnimationFrame(() => {
          setStats(drawWrap(printCanvas, recipe, image?.el ?? null));
          setVersion((v) => v + 1);
        });
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [recipe, image, printCanvas]);

  async function ask(text: string, img: UploadedImage, current: DesignRecipe | null) {
    setBusy(true);
    try {
      const history = messagesRef.current.slice(0, -1);
      const res = await requestDesign({ history, message: text, image: img, current });
      setRecipe(res.recipe);
      push(msg('assistant', res.reply));
    } catch (err) {
      push(msg('assistant', `Sorry, something went wrong: ${err instanceof Error ? err.message : String(err)}`));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file: File) {
    if (busy) return;
    let img: UploadedImage;
    try {
      img = await loadUploadedImage(file);
    } catch (err) {
      push(msg('assistant', err instanceof Error ? err.message : 'Couldn’t read that image.'));
      return;
    }
    const userMsg = msg('user', '', img.url);
    messagesRef.current = [...messagesRef.current, userMsg];
    push(userMsg);
    setImage(img);
    // Pass the current design so colours picked before uploading are kept.
    await ask('', img, recipe);
  }

  async function handleSend(text: string) {
    const userMsg = msg('user', text);
    messagesRef.current = [...messagesRef.current, userMsg];
    push(userMsg);
    if (!image) {
      push(msg('assistant', 'Please upload a photo or logo first (the picture button, or drag it into the chat). Then I’ll design around it.'));
      return;
    }
    await ask(text, image, recipe);
  }

  function handleBackgroundChange(background: BackgroundRecipe) {
    setRecipe((r) => {
      // No design yet (no photo): start a plain one so the colour shows on the tumbler.
      if (!r) return normalizeRecipe({ title: 'My tumbler', background, pattern: { shape: 'none' } });
      const next = { ...r, background };
      // Keep text readable on the new colour (unless it sits on its own banner).
      if (r.text && !r.text.band) {
        const under = r.text.position === 'top' ? background.colors[0] : background.colors[background.colors.length - 1];
        next.text = { ...r.text, color: readableOn(under) };
      }
      return next;
    });
  }

  async function handleDownload() {
    const name = (recipe?.title ?? 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    try {
      await downloadPng(printCanvas, `tumbler-wrap-${name}.png`, WRAP.dpi);
    } catch (err) {
      push(msg('assistant', `Download failed: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={22} height={22} />
          Tumbler Studio
        </div>
        <span className="badge">Prototype · demo AI</span>
      </header>
      <main className="workspace">
        <ChatPanel messages={messages} busy={busy} hasImage={!!image} onSend={handleSend} onUpload={handleUpload} />
        <PreviewPanel
          source={printCanvas}
          version={version}
          recipe={recipe}
          palette={image?.palette ?? []}
          stats={stats}
          onDownload={handleDownload}
          onBackgroundChange={handleBackgroundChange}
        />
      </main>
    </div>
  );
}
