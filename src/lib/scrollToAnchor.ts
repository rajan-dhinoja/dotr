const HEADER_SELECTOR = "header";
const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 120;

function getHeaderOffset(): number {
  if (typeof document === "undefined") return 0;
  const header = document.querySelector<HTMLElement>(HEADER_SELECTOR);
  if (!header) return 0;
  const rect = header.getBoundingClientRect();
  return rect.height || header.offsetHeight || 0;
}

function findAnchorElement(anchor: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(anchor) ?? null;
}

function scrollElementIntoView(el: HTMLElement) {
  const headerOffset = getHeaderOffset();
  const rect = el.getBoundingClientRect();
  const absoluteTop = window.scrollY + rect.top;
  const targetTop = Math.max(absoluteTop - headerOffset - 8, 0);

  window.scrollTo({
    top: targetTop,
    behavior: "smooth",
  });
}

/**
 * Smoothly scrolls to an anchor on the page, retrying a few times while
 * content mounts (e.g. after a route change).
 */
export function scrollToAnchor(rawHash: string) {
  if (typeof window === "undefined") return;

  const hash = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  if (!hash) return;

  let attempts = 0;

  const tryScroll = () => {
    const el = findAnchorElement(hash);
    if (el) {
      scrollElementIntoView(el);
      return;
    }

    attempts += 1;
    if (attempts >= MAX_ATTEMPTS) {
      return;
    }

    window.setTimeout(tryScroll, RETRY_DELAY_MS);
  };

  // Small delay so initial content has a chance to render
  window.setTimeout(tryScroll, 50);
}

