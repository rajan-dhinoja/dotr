import { lazy, Suspense } from "react";
import { PageSection } from "@/hooks/usePageSections";
import { AnimateInView, type AnimateInViewPreset } from "@/components/interactive/AnimateInView";
import { SectionObserverProvider } from "@/contexts/SectionObserverContext";
import { Skeleton } from "@/components/ui/skeleton";

export interface SectionAnimationConfig {
  enabled?: boolean;
  preset?: AnimateInViewPreset;
  stagger?: boolean;
}

export interface SectionPageContext {
  /** Category slug when rendering sections for a service category page (e.g. /services/designing) */
  categorySlug?: string | null;
}

export interface SectionComponentProps {
  title?: string | null;
  subtitle?: string | null;
  content?: Record<string, unknown>;
  sectionId?: string;
  categorySlug?: string | null;
}

/** Minimal fallback while a section chunk loads */
function SectionLoadFallback() {
  return (
    <div className="py-12 container mx-auto px-4">
      <Skeleton className="h-32 w-full rounded-lg animate-pulse" />
    </div>
  );
}

// Lazy-loaded section components (code-split by section type)
const sectionTypeToLazy: Record<string, React.LazyExoticComponent<React.ComponentType<SectionComponentProps>>> = {
  hero: lazy(() => import("./HeroSection").then((m) => ({ default: m.HeroSection }))),
  features: lazy(() => import("./FeaturesSection").then((m) => ({ default: m.FeaturesSection }))),
  process: lazy(() => import("./ProcessSection").then((m) => ({ default: m.ProcessSection }))),
  testimonials: lazy(() => import("./TestimonialsSection").then((m) => ({ default: m.TestimonialsSection }))),
  stats: lazy(() => import("./StatsSection").then((m) => ({ default: m.StatsSection }))),
  faq: lazy(() => import("./FAQSection").then((m) => ({ default: m.FAQSection }))),
  cta: lazy(() => import("./CTASection").then((m) => ({ default: m.CTASection }))),
  gallery: lazy(() => import("./GallerySection").then((m) => ({ default: m.GallerySection }))),
  team: lazy(() => import("./TeamSection").then((m) => ({ default: m.TeamSection }))),
  pricing: lazy(() => import("./PricingSection").then((m) => ({ default: m.PricingSection }))),
  form: lazy(() => import("./FormSection").then((m) => ({ default: m.FormSection }))),
  "logo-cloud": lazy(() => import("./LogoCloudSection").then((m) => ({ default: m.LogoCloudSection }))),
  "services-grid": lazy(() => import("./ServicesGridSection").then((m) => ({ default: m.ServicesGridSection }))),
  "portfolio-grid": lazy(() => import("./PortfolioGridSection").then((m) => ({ default: m.PortfolioGridSection }))),
  video: lazy(() => import("./VideoSection").then((m) => ({ default: m.VideoSection }))),
  "image-text": lazy(() => import("./ImageTextSection").then((m) => ({ default: m.ImageTextSection }))),
  timeline: lazy(() => import("./TimelineSection").then((m) => ({ default: m.TimelineSection }))),
  counters: lazy(() => import("./CountersSection").then((m) => ({ default: m.CountersSection }))),
  newsletter: lazy(() => import("./NewsletterSection").then((m) => ({ default: m.NewsletterSection }))),
  "blog-posts": lazy(() => import("./BlogPostsSection").then((m) => ({ default: m.BlogPostsSection }))),
  "contact-info": lazy(() => import("./ContactInfoSection").then((m) => ({ default: m.ContactInfoSection }))),
  divider: lazy(() => import("./DividerSection").then((m) => ({ default: m.DividerSection }))),
  "usp-strip": lazy(() => import("./UspStripSection").then((m) => ({ default: m.UspStripSection }))),
  "kpi-strip": lazy(() => import("./KpiStripSection").then((m) => ({ default: m.KpiStripSection }))),
  "social-proof-bar": lazy(() => import("./SocialProofBarSection").then((m) => ({ default: m.SocialProofBarSection }))),
  "success-metrics": lazy(() => import("./SuccessMetricsSection").then((m) => ({ default: m.SuccessMetricsSection }))),
  "awards-badges": lazy(() => import("./AwardsBadgesSection").then((m) => ({ default: m.AwardsBadgesSection }))),
  "press-mentions": lazy(() => import("./PressMentionsSection").then((m) => ({ default: m.PressMentionsSection }))),
  "ratings-reviews": lazy(() => import("./RatingsReviewsSection").then((m) => ({ default: m.RatingsReviewsSection }))),
  "trust-badges": lazy(() => import("./TrustBadgesSection").then((m) => ({ default: m.TrustBadgesSection }))),
  differentiators: lazy(() => import("./DifferentiatorsSection").then((m) => ({ default: m.DifferentiatorsSection }))),
  "problem-statement": lazy(() => import("./ProblemStatementSection").then((m) => ({ default: m.ProblemStatementSection }))),
  "agitate-solve": lazy(() => import("./AgitateSolveSection").then((m) => ({ default: m.AgitateSolveSection }))),
  "value-proposition": lazy(() => import("./ValuePropositionSection").then((m) => ({ default: m.ValuePropositionSection }))),
  "elevator-pitch": lazy(() => import("./ElevatorPitchSection").then((m) => ({ default: m.ElevatorPitchSection }))),
  "outcomes-benefits": lazy(() => import("./OutcomesBenefitsSection").then((m) => ({ default: m.OutcomesBenefitsSection }))),
  "who-its-for": lazy(() => import("./WhoItsForSection").then((m) => ({ default: m.WhoItsForSection }))),
  "before-after": lazy(() => import("./BeforeAfterSection").then((m) => ({ default: m.BeforeAfterSection }))),
  "video-demo": lazy(() => import("./VideoDemoSection").then((m) => ({ default: m.VideoDemoSection }))),
  "screenshot-gallery": lazy(() => import("./ScreenshotGallerySection").then((m) => ({ default: m.ScreenshotGallerySection }))),
  "device-frames": lazy(() => import("./DeviceFramesSection").then((m) => ({ default: m.DeviceFramesSection }))),
  "feature-list": lazy(() => import("./FeatureListSection").then((m) => ({ default: m.FeatureListSection }))),
  "feature-highlights": lazy(() => import("./FeatureHighlightsSection").then((m) => ({ default: m.FeatureHighlightsSection }))),
  "primary-cta-banner": lazy(() => import("./PrimaryCtaBannerSection").then((m) => ({ default: m.PrimaryCtaBannerSection }))),
  "secondary-cta": lazy(() => import("./SecondaryCtaSection").then((m) => ({ default: m.SecondaryCtaSection }))),
  "exit-intent-cta": lazy(() => import("./ExitIntentCtaSection").then((m) => ({ default: m.ExitIntentCtaSection }))),
  "about-us": lazy(() => import("./AboutUsSection").then((m) => ({ default: m.AboutUsSection }))),
  "values-culture": lazy(() => import("./ValuesCultureSection").then((m) => ({ default: m.ValuesCultureSection }))),
};

function getSectionAnimationConfig(section: PageSection): {
  enabled: boolean;
  preset: AnimateInViewPreset;
  stagger: boolean;
} {
  const raw = (section.content as Record<string, unknown>)?.animation as SectionAnimationConfig | undefined;
  const preset = raw?.preset ?? "subtle";
  const validPreset: AnimateInViewPreset =
    preset === "smooth" || preset === "scale" || preset === "none" ? preset : "subtle";
  const formNoAnimation = section.section_type === "form";
  return {
    enabled: formNoAnimation ? false : (raw?.enabled !== false),
    preset: formNoAnimation ? "none" : validPreset,
    stagger: raw?.stagger !== false,
  };
}

interface SectionRendererProps {
  sections: PageSection[];
  pageContext?: SectionPageContext;
}

function getSectionAnchorId(section: PageSection): string {
  const content = (section.content || {}) as Record<string, unknown>;
  const rawAnchor = typeof content.anchor === "string" ? content.anchor.trim() : "";
  if (rawAnchor) return rawAnchor;
  return `section-${section.id}`;
}

export function SectionRenderer({ sections, pageContext }: SectionRendererProps) {
  return (
    <SectionObserverProvider>
      {sections.map((section) => {
        const anchorId = getSectionAnchorId(section);
        return (
          <div key={section.id} id={anchorId}>
            <SectionAnimationWrapper section={section} pageContext={pageContext} />
          </div>
        );
      })}
    </SectionObserverProvider>
  );
}

interface SectionAnimationWrapperProps {
  section: PageSection;
  pageContext?: SectionPageContext;
}

function SectionAnimationWrapper({ section, pageContext }: SectionAnimationWrapperProps) {
  const config = getSectionAnimationConfig(section);
  const child = <DynamicSection section={section} pageContext={pageContext} />;

  if (!config.enabled || config.preset === "none") {
    return child;
  }

  return (
    <AnimateInView
      animation={config.preset}
      disabled={!config.enabled}
      staggerMax={config.stagger ? 6 : 0}
    >
      {child}
    </AnimateInView>
  );
}

interface DynamicSectionProps {
  section: PageSection;
  pageContext?: SectionPageContext;
}

function DynamicSection({ section, pageContext }: DynamicSectionProps) {
  const { section_type, title, subtitle, content, id } = section;
  const contentObj = (content || {}) as Record<string, unknown>;

  const LazySection = sectionTypeToLazy[section_type];
  if (!LazySection) return null;

  const sectionProps: SectionComponentProps = {
    title,
    subtitle,
    content: contentObj,
    sectionId: id,
    categorySlug: pageContext?.categorySlug,
  };

  return (
    <Suspense fallback={<SectionLoadFallback />}>
      <LazySection {...sectionProps} />
    </Suspense>
  );
}
