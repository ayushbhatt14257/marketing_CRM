import { useEffect, useRef } from 'react';
import gsap from 'gsap';

// Animates a number from 0 (or its previous value) up to `value` whenever `value` changes.
// Returns a ref to attach to the element that should display the number.
export function useCountUp(value, { duration = 0.9 } = {}) {
  const elRef = useRef(null);
  const valueRef = useRef({ n: 0 });

  useEffect(() => {
    if (typeof value !== 'number') return;
    const ctx = gsap.context(() => {
      gsap.to(valueRef.current, {
        n: value,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          if (elRef.current) elRef.current.textContent = Math.round(valueRef.current.n);
        },
      });
    });
    return () => ctx.revert();
  }, [value, duration]);

  return elRef;
}
