# Section Type Inventory

Complete inventory of all section types in the Page Builder system.

## Summary

- **Total Sections**: 48
- **Last Updated**: 2025-01-23
- **Source**: Database `section_types` table + `SectionRenderer.tsx`

## Section List

| Slug | Name | Component | Complexity | Has Array | Fields |
|------|------|-----------|------------|-----------|--------|
| hero | Hero | HeroSection.tsx | Simple | No | 5 |
| features | Features | FeaturesSection.tsx | Medium | Yes | 1 |
| process | Process | ProcessSection.tsx | Medium | Yes | 1 |
| testimonials | Testimonials | TestimonialsSection.tsx | Medium | Yes | 1 |
| stats | Stats | StatsSection.tsx | Simple | Yes | 1 |
| faq | FAQ | FAQSection.tsx | Simple | Yes | 1 |
| cta | CTA | CTASection.tsx | Simple | No | 6 |
| gallery | Gallery | GallerySection.tsx | Medium | Yes | 1 |
| team | Team | TeamSection.tsx | Medium | Yes | 1 |
| pricing | Pricing | PricingSection.tsx | Complex | Yes | 1 |
| form | Form | FormSection.tsx | Complex | Yes | 5 |
| logo-cloud | Logo Cloud | LogoCloudSection.tsx | Simple | Yes | 1 |
| services-grid | Services Grid | ServicesGridSection.tsx | Medium | Yes | 1 |
| portfolio-grid | Portfolio Grid | PortfolioGridSection.tsx | Medium | Yes | 2 |
| video | Video | VideoSection.tsx | Simple | No | 3 |
| image-text | Image Text | ImageTextSection.tsx | Simple | No | 5 |
| timeline | Timeline | TimelineSection.tsx | Medium | Yes | 1 |
| counters | Counters | CountersSection.tsx | Simple | Yes | 1 |
| newsletter | Newsletter | NewsletterSection.tsx | Simple | No | 3 |
| blog-posts | Blog Posts | BlogPostsSection.tsx | Simple | No | 3 |
| contact-info | Contact Info | ContactInfoSection.tsx | Medium | Yes | 5 |
| divider | Divider | DividerSection.tsx | Simple | No | 4 |
| usp-strip | USP Strip | UspStripSection.tsx | Simple | Yes | 2 |
| kpi-strip | KPI Strip | KpiStripSection.tsx | Simple | Yes | 2 |
| social-proof-bar | Social Proof Bar | SocialProofBarSection.tsx | Medium | Yes | 4 |
| success-metrics | Success Metrics | SuccessMetricsSection.tsx | Medium | Yes | 1 |
| awards-badges | Awards & Badges | AwardsBadgesSection.tsx | Medium | Yes | 1 |
| press-mentions | Press Mentions | PressMentionsSection.tsx | Medium | Yes | 1 |
| ratings-reviews | Ratings & Reviews | RatingsReviewsSection.tsx | Medium | Yes | 2 |
| trust-badges | Trust Badges | TrustBadgesSection.tsx | Simple | Yes | 1 |
| differentiators | Differentiators | DifferentiatorsSection.tsx | Medium | Yes | 4 |
| problem-statement | Problem Statement | ProblemStatementSection.tsx | Medium | Yes | 2 |
| agitate-solve | Agitate & Solve | AgitateSolveSection.tsx | Simple | No | 3 |
| value-proposition | Value Proposition | ValuePropositionSection.tsx | Medium | Yes | 4 |
| elevator-pitch | Elevator Pitch | ElevatorPitchSection.tsx | Simple | No | 4 |
| outcomes-benefits | Outcomes/Benefits | OutcomesBenefitsSection.tsx | Medium | Yes | 2 |
| who-its-for | Who Its For | WhoItsForSection.tsx | Medium | Yes | 1 |
| before-after | Before & After | BeforeAfterSection.tsx | Simple | No | 4 |
| video-demo | Video Demo | VideoDemoSection.tsx | Medium | Yes | 3 |
| screenshot-gallery | Screenshot Gallery | ScreenshotGallerySection.tsx | Medium | Yes | 2 |
| device-frames | Device Frames | DeviceFramesSection.tsx | Medium | Yes | 2 |
| feature-list | Feature List | FeatureListSection.tsx | Simple | Yes | 2 |
| feature-highlights | Feature Highlights | FeatureHighlightsSection.tsx | Complex | Yes | 1 |
| primary-cta-banner | Primary CTA Banner | PrimaryCtaBannerSection.tsx | Simple | No | 6 |
| secondary-cta | Secondary CTA | SecondaryCtaSection.tsx | Simple | No | 3 |
| exit-intent-cta | Exit Intent CTA | ExitIntentCtaSection.tsx | Simple | No | 5 |
| about-us | About Us | AboutUsSection.tsx | Medium | No | 7 |
| values-culture | Values & Culture | ValuesCultureSection.tsx | Medium | Yes | 2 |

## Categories

### Core Sections (10)
hero, features, process, testimonials, stats, faq, cta, gallery, team, pricing

### Visual & Media Sections (6)
logo-cloud, services-grid, portfolio-grid, video, image-text, timeline

### Utility Sections (6)
divider, usp-strip, kpi-strip, counters, newsletter, blog-posts, contact-info

### Trust & Social Proof (7)
social-proof-bar, success-metrics, awards-badges, press-mentions, ratings-reviews, trust-badges, differentiators

### Value Communication (6)
problem-statement, agitate-solve, value-proposition, elevator-pitch, outcomes-benefits, who-its-for

### Visual Showcase (4)
before-after, video-demo, screenshot-gallery, device-frames

### Feature Sections (2)
feature-list, feature-highlights

### CTA Sections (3)
primary-cta-banner, secondary-cta, exit-intent-cta

### Company Sections (2)
about-us, values-culture

### Form Sections (1)
form

## Complexity Distribution

- **Simple**: 21 sections
- **Medium**: 24 sections
- **Complex**: 3 sections

## Array-Based Sections

32 sections use arrays for their primary content structure.

## Section animation (`content.animation`)

All sections support optional animation via `content.animation` (JSONB). SectionRenderer wraps each section with `AnimateInView` when enabled. Configurable per section in the admin form (Animation card) or JSON. See [JSON_CONTENT_LAYER](JSON_CONTENT_LAYER.md#page-section-animation-contentanimation) for the full schema. Form sections always use `enabled: false` and `preset: "none"`.

## Notes

- All sections have corresponding React components
- All sections have JSON examples in `examples/sections/`
- Schema definitions stored in database `section_types.schema` JSONB field
- Components located in `src/components/sections/`
