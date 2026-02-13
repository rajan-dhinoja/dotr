# Service Page Content Setup Guide

This guide explains how to use the Service page sections JSON for bulk import in the admin panel.

## File

- **`service-page-sections.json`** – Section content for the **Services** page (`page_type: "services"`), in the same wrapped format as `home-page-sections.json`.

## What's Included

The Service page JSON includes **48 sections** (same section types as the Home page):

1. **Hero** – "9 Specialized Pillars, One Unified Solution" with CTA to contact  
2. **USP Strip** – Weeks not months, Security, AI-first, 24/7, 9 pillars  
3. **Value Proposition** – Why DOTR for services (end-to-end, AI-first, CMS-driven, etc.)  
4. **Services Grid** – All 9 pillars with links to category pages  
5. **Process** – How we deliver (4 steps)  
6. **Feature Highlights** – AI-first capabilities (6 items)  
7. **Differentiators** – DOTR vs Traditional Agencies  
8. **Stats** – 9 Pillars, 48 Section Types, 100% AI, 24/7 Support  
9. **Who We Serve** – Startups, Enterprises, Agencies  
10. **Outcomes/Benefits** – Efficiency, CX, Revenue, Competitive Edge  
11. **Success Metrics** – Client results  
12. **Testimonials** – 3 client quotes  
13. **Trust Badges** – AI platform, Modern stack, Scalable infra, Security  
14. **FAQ** – 5 service-specific questions  
15. **CTA** – "Ready to Get Started?"  
16. **Primary CTA Banner** – Final conversion block  
17. **Problem Statement** – Pain points + empathy  
18. **About Us** – Story, mission, vision  
19. **Values & Culture** – 6 core values  
20. **Elevator Pitch** – Tagline and pitch  
21. **Logo Cloud** – Trusted by / client logos  
22. **Features** – Core capabilities (6 items)  
23. **Image + Text** – Our approach  
24. **Video** – See DOTR in action  
25. **Timeline** – DOTR journey milestones  
26. **Newsletter** – Email signup  
27. **Secondary CTA** – Book a consultation  
28. **Team** – Meet the team  
29. **Gallery** – Work in action  
30. **Contact Info** – Email, phone, address, social  
31. **Blog Posts** – Latest from blog  
32. **Divider** – Visual break  
33. **Pricing** – Starter / Professional / Enterprise  
34. **Form** – Free AI consultation form  
35. **Portfolio Grid** – Our work  
36. **Counters** – By the numbers  
37. **KPI Strip** – Key metrics strip  
38. **Social Proof Bar** – Ratings, platforms  
39. **Awards & Badges** – Recognition  
40. **Press Mentions** – As seen in  
41. **Ratings & Reviews** – Platform ratings  
42. **Agitate & Solve** – Cost of waiting → solution  
43. **Before & After** – Transformation  
44. **Video Demo** – Platform walkthrough  
45. **Screenshot Gallery** – Key screens  
46. **Device Frames** – Responsive preview  
47. **Feature List** – What’s included  
48. **Exit Intent CTA** – Last-chance offer  

Content is derived from **`company-profile.md`**, **`section-inventory.md`**, and **`website-vision-strategy.md`**.

## How to Import

1. Open **Admin → Page Sections**.
2. Select the **Services** page from the page dropdown (slug `services`).
3. Use **Import** / **Bulk Import** and upload `service-page-sections.json`.
4. Confirm import; sections will be created for the Services page.

Ensure a **Services** page exists in **Admin → Pages** (slug `services`) so it appears in the Page Sections dropdown. Use the Pages bulk import or **`mega-menu-pages-import.json`** if needed.

## Section Order

Sections use `display_order` 1–48. You can reorder, enable, or disable them in the admin after import.

## References

- **Home page**: `home-page-sections.json`, `HOME-PAGE-SETUP.md`
- **Portfolio page**: `portfolio-page-sections.json`, `PORTFOLIO-PAGE-SETUP.md`
- **Designing Services page**: `designing-service-page-sections.json`, `DESIGNING-SERVICE-PAGE-SETUP.md`
- **Development Services page**: `development-service-page-sections.json`
- **Marketing Services page**: `marketing-service-page-sections.json`, `MARKETING-SERVICE-PAGE-SETUP.md`
- **Pages & menu import**: `PAGES-BULK-IMPORT.md`
