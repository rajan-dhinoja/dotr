# Marketing Services Page – Content Setup Guide

This guide explains how to use the Marketing Services page sections JSON for bulk import in the admin panel.

## File

- **`marketing-service-page-sections.json`** – Section content for the **Marketing Services** page (`page_type: "services/marketing"`), in the same wrapped format as `designing-service-page-sections.json` and `home-page-sections.json`.

## What's Included

The Marketing Services page JSON includes **48 sections** (same structure as the main Services page):

**Core (1–17):** Hero, USP Strip, Problem Statement, Value Proposition, Services Grid, Process, Feature Highlights, Differentiators, Stats, Who We Market For, Outcomes/Benefits, Success Metrics, Testimonials, Trust Badges, FAQ, CTA, Primary CTA Banner.

**Additional (18–48):** About Us, Values & Culture, Elevator Pitch, Logo Cloud, Features (Marketing Capabilities), Image Text, Video, Timeline, Newsletter, Secondary CTA, Team, Gallery, Contact Info, Blog Posts, Divider, Pricing (Marketing Plans), Form (Marketing Consultation), Portfolio Grid, Counters, KPI Strip, Social Proof Bar, Awards & Badges, Press Mentions, Ratings & Reviews, Agitate & Solve, Before & After, Video Demo, Screenshot Gallery, Device Frames, Feature List, Exit Intent CTA.

Content is derived from **`company-profile.md`** (Marketing pillar: Digital Strategy, SEO, Social Media Management, Paid Ads, Email Marketing & Automation), **`section-inventory.md`**, and **`website-vision-strategy.md`**.

## How to Import

1. Open **Admin → Page Sections**.
2. Select the **Marketing Services** page from the page dropdown (slug **`services/marketing`**).
3. Use **Import** / **Bulk Import** and upload `marketing-service-page-sections.json`.
4. Confirm import; sections will be created for the Marketing Services page.

Ensure a **Marketing Services** page exists in **Admin → Pages** with slug **`services/marketing`**. Use the Pages bulk import or **`mega-menu-pages-import.json`** if needed.

## Section Order

Sections use `display_order` 1–48. You can reorder them in the admin after import.

## References

- **Home page**: `home-page-sections.json`, `HOME-PAGE-SETUP.md`
- **Services page**: `service-page-sections.json`, `SERVICE-PAGE-SETUP.md`
- **Designing Services page**: `designing-service-page-sections.json`, `DESIGNING-SERVICE-PAGE-SETUP.md`
- **Pages & menu import**: `PAGES-BULK-IMPORT.md`
