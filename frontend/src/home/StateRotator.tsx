import { useEffect, useState } from 'react';

// The state name in the states page title, swapping upward every `interval` ms. All names share one grid
// cell as invisible sizers, so the line keeps the widest name's width and nothing reflows. With reduced
// motion it shows "by state" and doesn't move.
// Each name gets a taller slot than the line so descenders (Wyoming's y and g) show and the next name stays out of view.
const STEP = 1.45;

export function StateRotator({ names, interval = 2600 }: { names: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (reduced) return undefined;
    const timer = window.setInterval(() => {
      setAnimate(true);
      setIndex((current) => current + 1);
    }, interval);
    return () => window.clearInterval(timer);
  }, [interval, reduced]);

  // After sliding onto the repeated first name at the end, jump back to the top without animating.
  useEffect(() => {
    if (index !== names.length) return undefined;
    const reset = window.setTimeout(() => {
      setAnimate(false);
      setIndex(0);
    }, 900);
    return () => window.clearTimeout(reset);
  }, [index, names.length]);

  if (reduced) return <span className="text-steel">by state</span>;

  const strip = [...names, names[0]];
  return (
    <span aria-hidden="true">
      for{' '}
      <span className="relative inline-grid overflow-hidden text-steel" style={{ height: '1.1em', paddingBottom: '0.18em', marginBottom: '-0.18em' }}>
        {names.map((name) => (
          <span key={name} className="invisible col-start-1 row-start-1 whitespace-nowrap leading-[1.1]">
            {name}
          </span>
        ))}
        <span
          className="absolute left-0 top-0 flex flex-col"
          style={{
            transform: `translateY(-${index * STEP}em)`,
            transition: animate ? 'transform 850ms cubic-bezier(.45,0,.25,1)' : 'none'
          }}
        >
          {strip.map((name, position) => (
            <span key={`${name}-${position}`} className="whitespace-nowrap leading-[1.1]" style={{ height: `${STEP}em` }}>
              {name}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
