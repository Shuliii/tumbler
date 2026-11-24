import { useState } from 'react';
import { BackgroundRecipe, DesignRecipe, WRAP } from '../recipe';
import type { RenderStats } from '../render/renderWrap';
import { Tumbler3D } from './Tumbler3D';
import { FlatView } from './FlatView';
import { BackgroundPicker } from './BackgroundPicker';

interface Props {
  source: HTMLCanvasElement;
  version: number;
  recipe: DesignRecipe | null;
  palette: string[];
  stats: RenderStats;
  onDownload(): void;
  onBackgroundChange(bg: BackgroundRecipe): void;
}

function quality(ppi: number | null) {
  if (ppi === null) return null;
  const n = Math.round(ppi);
  if (ppi >= 200) return { level: 'good', label: `Sharp print (${n} ppi)` };
  if (ppi >= 130) return { level: 'ok', label: `OK print quality (${n} ppi)` };
  return { level: 'low', label: `Low resolution (${n} ppi): may print blurry, a larger original photo would help` };
}

export function PreviewPanel({ source, version, recipe, palette, stats, onDownload, onBackgroundChange }: Props) {
  const [tab, setTab] = useState<'3d' | 'flat'>('3d');
  const [autoRotate, setAutoRotate] = useState(true);
  const [seamCheck, setSeamCheck] = useState(false);
  const q = quality(stats.photoPpi);

  return (
    <section className="preview">
      <div className="preview-head">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === '3d'} className={tab === '3d' ? 'active' : ''} onClick={() => setTab('3d')}>
            3D preview
          </button>
          <button role="tab" aria-selected={tab === 'flat'} className={tab === 'flat' ? 'active' : ''} onClick={() => setTab('flat')}>
            Flat print
          </button>
        </div>
        {tab === '3d' ? (
          <label className="toggle">
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
            Spin
          </label>
        ) : (
          <label className="toggle">
            <input type="checkbox" checked={seamCheck} onChange={(e) => setSeamCheck(e.target.checked)} />
            Check seam
          </label>
        )}
      </div>

      <div className="stage">
        {tab === '3d' ? (
          <Tumbler3D source={source} version={version} autoRotate={autoRotate} />
        ) : (
          <FlatView source={source} version={version} seamCheck={seamCheck} />
        )}
        {recipe && <div className="design-title">{recipe.title}</div>}
        {!recipe && <div className="stage-empty">Your design will appear on the tumbler here</div>}
        {tab === '3d' && <div className="stage-hint">Drag to turn · scroll to zoom</div>}
      </div>

      <BackgroundPicker
        background={recipe?.background ?? { style: 'solid', colors: ['#ffffff'] }}
        palette={palette}
        onChange={onBackgroundChange}
      />

      <div className="preview-foot">
        <div className="foot-info">
          <div className="meta">
            <span>
              20oz skinny · {WRAP.widthIn} × {WRAP.heightIn} in · {WRAP.widthPx} × {WRAP.heightPx} px · {WRAP.dpi} DPI
            </span>
            {q && <span className={`quality quality-${q.level}`}>{q.label}</span>}
          </div>
        </div>
        <button className="download-btn" disabled={!recipe} onClick={onDownload}>
          Download print PNG
        </button>
      </div>

      {recipe && (
        <details className="recipe-json">
          <summary>Design recipe (what the AI returned)</summary>
          <pre>{JSON.stringify(recipe, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
