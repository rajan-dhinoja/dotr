import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { ServicesGridSection } from "@/components/sections/ServicesGridSection";
import { usePageSections } from "@/hooks/usePageSections";
import { Skeleton } from "@/components/ui/skeleton";

const Services = () => {
  const { data: sections, isLoading } = usePageSections("services");
  const hasSections = sections && sections.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {isLoading ? (
        <div className="pt-20">
          <Skeleton className="h-[40vh] w-full" />
          <div className="container mx-auto px-4 py-20">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      ) : hasSections ? (
        <SectionRenderer sections={sections} />
      ) : (
        /* Fallback: when no sections configured, show dynamic services from DB */
        <>
          <div className="pt-32 pb-12 text-center">
            <div className="container mx-auto px-4">
              <h1 className="text-4xl font-bold text-foreground mb-4">Our Services</h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Explore our comprehensive digital solutions—from design to development, marketing, and beyond.
              </p>
            </div>
          </div>
          <ServicesGridSection
            title="All Services"
            subtitle="Select a category to explore our offerings"
            content={{ source: "dynamic", groupByCategory: true }}
          />
          <p className="text-center text-sm text-muted-foreground pb-16">
            Customize this page in Admin → Page Sections → Services
          </p>
        </>
      )}

      <Footer />
    </div>
  );
};

export default Services;
