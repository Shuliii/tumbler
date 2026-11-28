import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../ai/designer';

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  hasImage: boolean;
  onSend(text: string): void;
  onUpload(file: File): void;
}

const SUGGESTIONS = [
  'Make it a repeating pattern',
  'Photo on both sides',
  'Pink with hearts',
  'Circle photo with a border',
  'Full wrap',
  'Surprise me',
];

export function ChatPanel({ messages, busy, hasImage, onSend, onUpload }: Props) {
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = (text = draft) => {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setDraft('');
  };

  const pickFile = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onUpload(f);
    if (fileRef.current) fileRef.current.value = '';
  };

  const startText = () => {
    setDraft('add text "Best Mom Ever"');
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(10, 23); // select the example words so typing replaces them
    });
  };

  return (
    <section
      className={`chat ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pickFile(e.dataTransfer.files);
      }}
    >
      <div className="chat-list" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            {m.role === 'assistant' && <div className="avatar" aria-hidden>✦</div>}
            <div className="bubble">
              {m.imageUrl && <img className="bubble-img" src={m.imageUrl} alt="Uploaded" />}
              {m.text && <p>{m.text}</p>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="msg msg-assistant">
            <div className="avatar" aria-hidden>✦</div>
            <div className="bubble typing" aria-label="Designing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        {!hasImage && !busy && (
          <button className="dropzone" onClick={() => fileRef.current?.click()}>
            <UploadIcon />
            <strong>Upload a photo or logo</strong>
            <span>or drag it here · JPG or PNG</span>
          </button>
        )}
      </div>

      {hasImage && (
        <div className="chips">
          <button className="chip" disabled={busy} onClick={startText}>
            Add text…
          </button>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" disabled={busy} onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <button type="button" className="icon-btn" title={hasImage ? 'Upload a different photo' : 'Upload a photo'} onClick={() => fileRef.current?.click()}>
          <UploadIcon />
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          placeholder={hasImage ? 'Describe what you’d like…' : 'Upload a photo to start'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="send-btn" disabled={busy || !draft.trim()}>
          Send
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files)} />
      </form>

      {dragging && <div className="drop-overlay">Drop your photo</div>}
    </section>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  );
}
