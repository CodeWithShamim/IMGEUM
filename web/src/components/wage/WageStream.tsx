import {useEffect, useImperativeHandle, useRef, forwardRef} from 'react';
import {useTranslation} from 'react-i18next';
import {usePrefersReducedMotion} from '../../hooks/usePrefersReducedMotion';
import {useAnimationClock} from '../../hooks/useClock';
import {useLang} from '../../hooks/useLang';
import {earnedFloat, ratePerSecond, type Vault} from '../../lib/vault';
import {formatKRW} from '../../lib/format';

export interface WageStreamHandle {
  /** Fire a burst of coins — called when a VaultFunded event lands (~1s after payment). */
  burst: () => void;
}

interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

/**
 * THE signature element (spec §5). Earned wages render as gold particle "coins" flowing along
 * a painted dancheong beam into the balance, with the counter ticking every frame. A
 * VaultFunded event fires a burst so the user *feels* GIWA's 1-second block speed.
 *
 * Built with a lightweight canvas layer for particles + a DOM counter interpolated at 60fps.
 * Degrades to a plain animated counter under prefers-reduced-motion (no canvas mounted).
 */
export const WageStream = forwardRef<WageStreamHandle, {vault: Vault}>(function WageStream({vault}, ref) {
  const {t} = useTranslation();
  const {lang} = useLang();
  const reduced = usePrefersReducedMotion();
  const nowMs = useAnimationClock();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const coins = useRef<Coin[]>([]);
  const raf = useRef<number>();
  const lastEmit = useRef(0);

  const rate = ratePerSecond(vault); // wei/sec as float
  const rateEthPerSec = rate / 1e18;

  useImperativeHandle(ref, () => ({
    burst: () => {
      if (reduced) return;
      const c = canvasRef.current;
      if (!c) return;
      for (let i = 0; i < 46; i++) {
        coins.current.push({
          x: Math.random() * c.width * 0.3,
          y: c.height / 2 + (Math.random() - 0.5) * 30,
          vx: 2 + Math.random() * 4,
          vy: (Math.random() - 0.5) * 3,
          life: 1,
          size: 2 + Math.random() * 3,
        });
      }
    },
  }));

  // Canvas particle loop — coins spawn along the beam and flow rightward into the balance.
  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const streaming = nowMsIsStreaming(vault);
    const loop = (t: number) => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ctx.clearRect(0, 0, w, h);

      // Steady emission proportional to the wage rate while the stream is active.
      if (streaming && t - lastEmit.current > 90) {
        lastEmit.current = t;
        coins.current.push({
          x: 4,
          y: h / 2 + (Math.random() - 0.5) * 10,
          vx: 1.1 + Math.random() * 1.4,
          vy: (Math.random() - 0.5) * 0.6,
          life: 1,
          size: 2 + Math.random() * 2,
        });
      }

      coins.current = coins.current.filter((c) => c.x < w + 10 && c.life > 0);
      for (const c of coins.current) {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.02;
        if (c.x > w * 0.8) c.life -= 0.04; // fade as it reaches the balance
        ctx.globalAlpha = Math.max(0, c.life);
        ctx.fillStyle = '#FFB300';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.max(0, c.life * 0.4);
        ctx.fillStyle = '#FFE08A';
        ctx.beginPath();
        ctx.arc(c.x - c.size * 0.4, c.y - c.size * 0.4, c.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', resize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, vault.periodStart, vault.periodEnd]);

  // DOM counter — interpolate earned wage each frame. Direct textContent write avoids
  // re-rendering the tree 60x/sec.
  useEffect(() => {
    const el = counterRef.current;
    if (!el) return;
    const earned = earnedFloat(vault, nowMs);
    el.textContent = formatKRW(BigInt(Math.floor(earned)), lang);
  }, [nowMs, vault, lang]);

  return (
    <div className="relative overflow-hidden rounded border-2 border-ink bg-ink-2 p-5">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-hanji/50">
        {t('worker:streamLabel')}
      </div>

      {/* The painted dancheong beam the coins ride along. */}
      <div className="relative mt-3 h-16">
        <div className="absolute left-0 top-1/2 h-2 w-full -translate-y-1/2 rounded dancheong-band opacity-30" />
        {!reduced && (
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
        )}
        {reduced && (
          <p className="absolute bottom-0 right-0 text-[0.6rem] text-hanji/40">{t('worker:reducedMotion')}</p>
        )}
      </div>

      {/* Live counter — tabular mono, ticks every frame. */}
      <div
        ref={counterRef}
        className="mt-2 font-mono text-4xl font-bold tnum text-dan-gold sm:text-5xl"
        aria-live="off"
      >
        —
      </div>
      <div className="mt-1 font-mono text-xs text-nok">
        + {rateEthPerSec > 0 ? formatKRW(BigInt(Math.floor(rate)), lang) : '—'} {t('common:units.perSecond')}
      </div>
    </div>
  );
});

function nowMsIsStreaming(v: Vault): boolean {
  const now = Date.now() / 1000;
  return now >= Number(v.periodStart) && now < Number(v.periodEnd) && !v.closed;
}
