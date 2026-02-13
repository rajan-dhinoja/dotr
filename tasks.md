## Admin: Pages & Navigation

- **Consolidate legacy vs new nav flags**
  - Audit all uses of `show_in_nav` vs `show_in_navigation` and decide deprecation plan for the legacy flag.
  - Update `useSyncPagesToMenu` and `useNavPages` to rely only on the chosen flag, then remove the other from UI (`Show in Legacy Navigation`) once safe.

- **Validate page → menu sync behaviour**
  - Verify that syncing from `AdminPages` produces the expected structure in `menu_items` for header, mobile, and footer (levels, `menu_type`, and ordering).
  - Confirm that hidden pages (`show_in_navigation = false`) are not regenerated during sync and that manual section-link items (with `section_anchor`) are never touched.

- **Improve Pages & Navigation UX**
  - Add inline help text or a short guide explaining how `display_order`, `parent_id`, and `show_in_navigation` together determine menu hierarchy.
  - In `PagesNavigationList`, visually distinguish top-level, category, and leaf items (level badges exist; confirm they match your information architecture).
  - Ensure bulk delete and single delete flows clearly communicate side effects when pages are linked to services or categories.

- **Admin filters and search**
  - Extend `adminModules` config for `pages` to include filters for `show_in_navigation`, template, and page type where helpful.
  - Confirm list/search results stay in sync with the tree/card view (no mismatch between `admin-pages` and `admin-pages-tree` queries).

- **Sections & section-link management**
  - Validate that the “Add Section Link” dialog correctly loads sections for the selected page and that anchors match the IDs rendered by `SectionRenderer`.
  - Document the expected `anchor` field format in section content so admins can predict the generated `section_anchor` and resulting URL.

## Frontend: Header & Navigation

- **Align system routes with pages table**
  - Ensure every system route key in `Header` (`home`, `about`, `services`, `portfolio`, `blog`, `contact`, `testimonials`, `privacy-policy`, `terms-of-service`) has a corresponding active row in `pages` with the same slug.
  - Confirm there are no conflicting slugs that would cause the `/:slug` `DynamicPage` route to shadow or duplicate hard-coded routes.

- **Database-driven navigation defaults**
  - Verify that when `menu_items` is populated, the header and mobile menus always prefer DB-driven navigation, falling back to `useNavPages` only when empty.
  - Spot-check that `getItemHref` and `transformToMegaMenu` generate correct URLs for page-linked items, plain URLs, and section-anchor links.

- **Anchor scrolling and hash handling**
  - Confirm `HashScrollHandler` is mounted once and correctly triggers `scrollToAnchor` on route + hash changes.
  - Test section-anchor links from the header and mega-menu on desktop and mobile to ensure smooth scrolling positions sections below the fixed header.

- **Mobile mega menu behaviour**
  - Exercise mobile navigation for simple, nested, and mega menus to verify accordions open/close correctly and highlight active routes.
  - Ensure that mega menu definitions derived from `menu_items` (summary, sections, items, icons) render consistently with the desktop mega menu component.

- **Future cleanup**
  - Remove the old `/admin/menus` implementation (now redirected) from the codebase and docs once all functionality is covered by `AdminPages`.
  - Add brief admin-facing docs linking `Pages & Navigation`, menu sync, and mega menu configuration so future changes remain consistent.

