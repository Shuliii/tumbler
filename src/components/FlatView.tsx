/**
 * The flat print file, scaled down. "Check seam" swaps the left and right
 * halves so the seam lands in the middle, making it easy to see that the
 * edges join cleanly.
 */
import { useEffect, useRef } from 'react';

interface Props {
  source: HTMLCanvasElement;
  version: number;
  seamCheck: boolean;
}

export function FlatView({ source, version, seamCheck }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const sw = source.width, sh = source.height;
    ctx.imageSmoothingQuality = 'high';
    if (seamCheck) {
      ctx.drawImage(source, sw / 2, 0, sw / 2, sh, 0, 0, W / 2, H);
      ctx.drawImage(source, 0, 0, sw / 2, sh, W / 2, 0, W / 2, H);
    } else {
      ctx.drawImage(source, 0, 0, W, H);
    }
  }, [source, version, seamCheck]);

  return (
    <div className="flat">
      <div className="flat-frame">
        <canvas ref={ref} width={1116} height={984} />
        <div className={`flat-marker ${seamCheck ? 'seam' : 'front'}`}>
          <span>{seamCheck ? 'seam' : 'front'}</span>
        </div>
      </div>
      <p className="flat-hint">
        {seamCheck
          ? 'The halves are swapped so the seam is in the middle. Nothing should look cut off along the line.'
          : 'This is the print file, flattened. The left and right edges meet at the back of the tumbler.'}
      </p>
    </div>
  );
}
