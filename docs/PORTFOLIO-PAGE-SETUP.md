# Portfolio Page Content Setup Guide

This guide explains how to use the Portfolio page sections JSON for bulk import in the admin panel.

## File

- **`portfolio-page-sections.json`** – Section content for the **Portfolio** page (`page_type: "portfolio"`), in the same wrapped format as the service page JSONs.

## What's Included

The Portfolio page JSON includes **40 sections**:

1. **Hero** – "Work That Drives Results—Design, Development & Marketing" with CTA  
2. **Elevator Pitch** – Our work in one line  
3. **USP Strip** – Weeks not months, AI-first, Design to Dev to Marketing, etc.  
4. **KPI Strip** – Projects delivered, satisfaction, pillars, support (animated)  
5. **Value Proposition** – Why our work stands out  
6. **Problem Statement** – Project challenges we solve (4 problems + empathy)  
7. **Agitate & Solve** – Problem → agitation → solution  
8. **Portfolio Grid** – 12 projects across UI/UX, Branding, Development, Marketing, AI & Automation, Motion, Graphic Design  
9. **Services Grid** – Links to Designing, Development, Marketing service pages  
10. **Process** – How we deliver projects (4 steps)  
11. **Timeline** – Project journey (Week 1 → Ongoing)  
12. **Divider** – Visual break  
13. **Feature Highlights** – Portfolio + AI capabilities (6 items)  
14. **Video** – See our work in action  
15. **Image Text** – From brief to launch  
16. **Before & After** – Project transformation  
17. **Differentiators** – DOTR vs. Traditional Agencies  
18. **Features** – What we bring to every project (6 items)  
19. **Feature List** – Included in every project  
20. **Stats** – Portfolio by the numbers  
21. **Counters** – By the numbers (icons)  
22. **Who It's For** – Startups, Enterprises, Agencies & Product Teams  
23. **Outcomes/Benefits** – What you'll achieve (4 items)  
24. **Success Metrics** – Portfolio impact (4 metrics)  
25. **Testimonials** – 3 client quotes  
26. **Gallery** – Work in action (6 images)  
27. **Social Proof Bar** – Ratings and platforms  
28. **About Us** – Our approach to work  
29. **Values & Culture** – What we stand for (6 values)  
30. **Trust Badges** – Work built right (4 badges)  
31. **Awards & Badges** – Recognition (3 items)  
32. **Logo Cloud** – Tools & trust (Figma, Supabase, React, etc.)  
33. **Secondary CTA** – Start a project  
34. **FAQ** – 5 portfolio/project questions  
35. **Divider** – Visual break  
36. **Newsletter** – Email signup  
37. **Contact Info** – Email, phone, address, social links  
38. **CTA** – Get free consultation / Explore services  
39. **Exit Intent CTA** – Last-chance offer  
40. **Primary CTA Banner** – Final conversion block  

Content is derived from **`company-profile.md`**, **`section-inventory.md`**, and **`website-vision-strategy.md`**.

## Services List (Reference)

The JSON also includes a **`services_list`** object at the root for reference (not imported as sections):

- **`designing`** – 4 services: UI/UX Design, Graphic Design, Branding & Identity, Motion / Visual Design  
- **`development`** – 5 services: Full-Stack, Web Apps & Websites, Mobile Applications, Admin Panels & Dashboards, APIs & SaaS Platforms  
- **`marketing`** – 5 services: Digital Strategy, SEO, Social Media Management, Paid Ads, Email Marketing & Automation  
- **`all_flat`** – All 14 services in a single array with pillar and link  

Use this list when linking portfolio items to services, building filters, or populating service dropdowns.

## How to Import

1. Open **Admin → Page Sections**.
2. Select the **Portfolio** page from the page dropdown (slug `portfolio`).
3. Use **Import** / **Bulk Import** and upload `portfolio-page-sections.json`.
4. Confirm import; sections will be created for the Portfolio page.

Ensure a **Portfolio** page exists in **Admin → Pages** (slug `portfolio`) so it appears in the Page Sections dropdown. Use the Pages bulk import or **`mega-menu-pages-import.json`** if needed.

## Section Order

Sections use `display_order` 1–40. You can reorder, enable, or disable them in the admin after import.

## References

- **Home page**: `home-page-sections.json`, `HOME-PAGE-SETUP.md`
- **Services page**: `service-page-sections.json`, `SERVICE-PAGE-SETUP.md`
- **Designing / Development / Marketing**: `designing-service-page-sections.json`, `development-service-page-sections.json`, `marketing-service-page-sections.json`
