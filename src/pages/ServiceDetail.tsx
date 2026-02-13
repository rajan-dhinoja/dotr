import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { ServicesGridSection } from "@/components/sections/ServicesGridSection";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useServiceCategorySections } from "@/hooks/usePageSections";
import NotFound from "./NotFound";

export default function ServiceDetail() {
  const { category } = useParams<{ category: string }>();

  // 1. Validate category exists: try service_categories first, then pages (children of Services)
  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ["service-category", category],
    queryFn: async () => {
      if (!category) return null;
      const { data: cat, error: catError } = await supabase
        .from("service_categories")
        .select("*")
        .eq("slug", category)
        .maybeSingle();
      if (catError) throw catError;
      if (cat) return { category: cat };

      // Fallback: check if page exists under Services (Pages & Navigation)
      const { data: page, error: pageErr } = await supabase
        .from("pages")
        .select("id, title, slug, description")
        .eq("slug", `services/${category}`)
        .eq("is_active", true)
        .maybeSingle();
      if (pageErr || !page) return null;
      return {
        category: {
          id: page.id,
          name: page.title,
          slug: category,
          description: page.description,
        },
      };
    },
    enabled: !!category,
  });

  // 2. Fetch dynamic sections from Admin → Page Sections
  const { data: sections = [], isLoading: sectionsLoading } = useServiceCategorySections(category ?? "");

  const sectionsReady = !sectionsLoading;
  const hasDynamicSections = sectionsReady && sections.length > 0;
  const categoryNotFound = !categoryLoading && category && !categoryData;
  const noSectionsYet = sectionsReady && !hasDynamicSections && categoryData;

  if (categoryNotFound) {
    return <NotFound />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Dynamic content from Admin → Page Sections (DB) */}
        {hasDynamicSections && (
          <>
            <div className="container mx-auto px-4 pt-24 pb-4">
              <Link
                to="/services"
                className="text-primary hover:text-primary/80 inline-flex items-center text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Services
              </Link>
            </div>
            <SectionRenderer
              sections={sections}
              pageContext={{ categorySlug: category ?? undefined }}
            />
          </>
        )}

        {/* Loading: while sections are loading and category exists */}
        {categoryData && sectionsLoading && (
          <>
            <div className="container mx-auto px-4 pt-24 pb-4">
              <Link to="/services" className="text-primary hover:text-primary/80 inline-flex items-center text-sm font-medium">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Services
              </Link>
            </div>
            <div className="container mx-auto px-4 py-20">
              <Skeleton className="h-[40vh] w-full" />
              <Skeleton className="h-64 w-full mt-8" />
            </div>
          </>
        )}

        {/* No sections yet: show dynamic services from DB + prompt to add more sections */}
        {noSectionsYet && (
          <>
            <div className="container mx-auto px-4 pt-24 pb-4">
              <Link
                to="/services"
                className="text-primary hover:text-primary/80 inline-flex items-center text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Services
              </Link>
            </div>
            <div className="pt-12 pb-8 text-center">
              <h1 className="text-4xl font-bold text-foreground mb-4">
                {categoryData.category.name}
              </h1>
              {categoryData.category.description && (
                <p className="text-muted-foreground max-w-xl mx-auto mb-8">
                  {categoryData.category.description}
                </p>
              )}
            </div>
            <ServicesGridSection
              title="Our Services"
              subtitle="Explore what we offer in this category"
              content={{ source: "dynamic", categorySlug: category }}
              categorySlug={category ?? undefined}
            />
            <p className="text-center text-sm text-muted-foreground pb-16">
              Add more sections in Admin → Page Sections → {category}
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
