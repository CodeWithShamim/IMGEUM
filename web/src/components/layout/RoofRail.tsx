import {useEffect, useState} from 'react';

/**
 * The thick vertical dancheong-striped rail down the left edge (spec §5 layout). Doubles as a
 * scroll-progress indicator; the section label rotates 90° along it. Desktop only.
 */
export function RoofRail({label}: {label: string}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? window.scrollY / h : 0);
    };
    on();
    window.addEventListener('scroll', on, {passive: true});
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, []);

  return (
    <div className="fixed left-0 top-0 z-20 hidden h-full w-10 lg:flex" aria-hidden>
      <div className="relative h-full w-full border-r-2 border-ink dancheong-band-v opacity-90">
        {/* Scroll progress fill: an ink veil that recedes as you scroll. */}
        <div
          className="absolute bottom-0 left-0 w-full bg-ink/70 transition-[height] duration-150"
          style={{height: `${(1 - progress) * 100}%`}}
        />
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap font-display text-xs font-bold uppercase tracking-[0.4em] text-ink mix-blend-hard-light"
        >
          {label}
        </span>
      </div>
    </div>
  );
}
