import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { PortfolioGridSection } from "@/components/sections/PortfolioGridSection";
import { usePageSections } from "@/hooks/usePageSections";
import { useProjectsWithFilter } from "@/hooks/useProjects";
import { Skeleton } from "@/components/ui/skeleton";

const Portfolio = () => {
  const { data: sections, isLoading } = usePageSections("portfolio");

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
      ) : sections && sections.length > 0 ? (
        <SectionRenderer sections={sections} />
      ) : (
        <>
          <div className="pt-32 pb-12 text-center">
            <div className="container mx-auto px-4">
              <h1 className="text-4xl font-bold text-foreground mb-4">Our Portfolio</h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Explore our work and case studies across design, development, and digital solutions.
              </p>
            </div>
          </div>
          <PortfolioGridSection
            title="Our Projects"
            subtitle="Explore what we've built"
            content={{ source: "dynamic" }}
          />
          <p className="text-center text-sm text-muted-foreground pb-16">
            Customize this page in Admin → Page Sections → Portfolio
          </p>
        </>
      )}

      <Footer />
    </div>
  );
};

export default Portfolio;
