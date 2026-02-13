# Designing Services Page – Content Setup Guide

This guide explains how to use the Designing Services page sections JSON for bulk import in the admin panel.

## File

- **`designing-service-page-sections.json`** – Section content for the **Designing Services** page (`page_type: "services/designing"`), in the same wrapped format as `service-page-sections.json` and `home-page-sections.json`.

## What's Included

The Designing Services page JSON includes **40 sections**:

1. **Hero** – "Design That Drives Results—UI/UX, Branding, Motion & More" with CTA to design consultation
2. **Elevator Pitch** – Short design pitch and tagline
3. **USP Strip** – Fast Turnaround, AI-Assisted Design, Design Systems, Brand Consistency, UI to Motion
4. **KPI Strip** – Design disciplines, weeks to prototype, brand-consistent, 24/7 support
5. **Problem Statement** – Design challenges (Inconsistent Branding, Slow Cycles, Generic Output, Poor UX)
6. **Agitate & Solve** – Design pain → agitation → DOTR solution
7. **Value Proposition** – Why DOTR for design (full stack, AI-assisted, design systems, CMS-driven)
8. **Services Grid** – 4 design disciplines: UI/UX, Graphic Design, Branding & Identity, Motion / Visual Design (links to sub-service pages)
9. **Process** – How we design (Discovery → Concepts & Prototypes → Design System & Handoff → Iterate & Scale)
10. **Timeline** – Design journey (Week 1–4 + ongoing)
11. **Divider** – Visual break
12. **Feature Highlights** – Design + AI (AI-Assisted Design, Design Systems, Rapid Prototyping, Brand Consistency, Motion, Dev-Ready Handoff)
13. **Video** – "See Our Design Process" video section
14. **Image Text** – "From Concept to Launch" capability highlight with image
15. **Before & After** – Design transformation (before/after)
16. **Differentiators** – DOTR vs Traditional Design Agencies
17. **Features** – Design fundamentals (User-Centered Research, Design Systems, Accessible Design, Rapid Prototyping, Dev-Ready Handoff, Ongoing Support)
18. **Feature List** – Included in every project (research, design systems, prototypes, accessibility, handoff, support)
19. **Stats** – 4 Disciplines, 2 Weeks to First Prototype, 100% Brand-Consistent, 24/7 Support
20. **Counters** – Design projects, client satisfaction, support hours, disciplines
21. **Who We Design For** – Startups, Enterprises, Agencies & Product Teams
22. **Outcomes/Benefits** – Stronger Brand, Better UX, Faster Time to Market, Design That Scales
23. **Success Metrics** – Design impact (engagement, iteration speed, satisfaction, consistency)
24. **Portfolio Grid** – "Our Design Work" – 6 sample design projects (UI/UX, Branding, Graphic, Motion)
25. **Gallery** – "Design in Action" – 6 design work images
26. **Testimonials** – 3 design-focused client quotes
27. **Social Proof Bar** – User count, rating, review count, platforms
28. **About Us** – Our Design Philosophy (story, mission, vision)
29. **Values & Culture** – Design values (User-First, Consistency at Scale, Speed, Collaboration, etc.)
30. **Trust Badges** – AI-Assisted Design, Design Systems, Modern Stack, Brand-First
31. **Awards & Badges** – Recognition (Design Excellence, UI/UX Innovation, Brand Identity)
32. **Logo Cloud** – Tools & Trust (Figma, Adobe, Supabase, React, Tailwind, Lovable)
33. **Secondary CTA** – Mid-page "Get a Design Consultation" CTA
34. **FAQ** – 5 design-specific questions
35. **Divider** – Visual break before final CTAs
36. **Newsletter** – Subscribe for design insights
37. **Contact Info** – Get in Touch (email, phone, address, social links)
38. **CTA** – "Ready to Level Up Your Design?" with primary/secondary CTAs
39. **Exit Intent CTA** – "Wait! Before you go—" offer
40. **Primary CTA Banner** – Final conversion block

Content is derived from **`company-profile.md`** (Designing pillar: UI/UX, Graphic Design, Branding & Identity, Motion / Visual Design), **`section-inventory.md`**, and **`website-vision-strategy.md`**.

## How to Import

1. Open **Admin → Page Sections**.
2. Select the **Designing Services** page from the page dropdown (slug **`services/designing`**).
3. Use **Import** / **Bulk Import** and upload `designing-service-page-sections.json`.
4. Confirm import; sections will be created for the Designing Services page.

Ensure a **Designing Services** page exists in **Admin → Pages** with slug **`services/designing`**. Use the Pages bulk import or **`mega-menu-pages-import.json`** if needed.

## Section Order

Sections use `display_order` 1–40. You can reorder them in the admin after import.

## References

- **Home page**: `home-page-sections.json`, `HOME-PAGE-SETUP.md`
- **Services page**: `service-page-sections.json`, `SERVICE-PAGE-SETUP.md`
- **Pages & menu import**: `PAGES-BULK-IMPORT.md`
