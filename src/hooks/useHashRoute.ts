import { useEffect, useState } from 'react';

/** Normalize a location.hash into a route: '' | '#' | '#/' → '/', '#/foo' → '/foo'. */
export function normalizeHash(hash: string): string {
  const route = hash.replace(/^#/, '');
  return route === '' ? '/' : route;
}

/**
 * Minimal hash router: returns the current route and re-renders on hashchange.
 * Hash routing is required because GitHub Pages has no server-side fallback;
 * internal links are plain anchors (`<a href="#/ruta">`).
 */
export function useHashRoute(): string {
  const [route, setRoute] = useState(() => normalizeHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setRoute(normalizeHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}
