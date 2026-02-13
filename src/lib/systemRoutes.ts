/**
 * Central mapping of known page slugs to their public URL paths.
 * Used for menu items, section links, and sync so all consumers get consistent URLs.
 */
export const SYSTEM_ROUTES: Record<string, string> = {
  home: '/',
  about: '/about',
  services: '/services',
  portfolio: '/portfolio',
  blog: '/blog',
  contact: '/contact',
  testimonials: '/testimonials',
  'privacy-policy': '/privacy-policy',
  'terms-of-service': '/terms-of-service',
};

/**
 * Returns the public URL path for a page slug.
 * Falls back to `/${slug}` for custom/unknown slugs.
 */
export function getSystemRouteForSlug(slug: string): string {
  return SYSTEM_ROUTES[slug] ?? `/${slug}`;
}
