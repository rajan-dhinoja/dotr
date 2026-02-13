import { useParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { usePageSections } from "@/hooks/usePageSections";
import { usePageBySlug } from "@/hooks/usePages";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "./NotFound";

const DynamicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading: pageLoading } = usePageBySlug(slug || "");
  const { data: sections, isLoading: sectionsLoading } = usePageSections(slug || "");

  const isLoading = pageLoading || sectionsLoading;

  // If page doesn't exist after loading, show 404
  if (!pageLoading && !page) {
    return <NotFound />;
  }

  const title = page?.title ?? slug;
  const description = page?.description ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {isLoading && !sections?.length ? (
        <div className="flex-1 pt-24 pb-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold text-foreground mb-2">{title || "…"}</h1>
            {description && <p className="text-muted-foreground mb-6">{description}</p>}
            <div className="flex justify-center gap-2" aria-hidden>
              <Skeleton className="h-2 w-24 rounded-full animate-pulse" />
              <Skeleton className="h-2 w-16 rounded-full animate-pulse" />
              <Skeleton className="h-2 w-20 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      ) : sections && sections.length > 0 ? (
        <SectionRenderer sections={sections} />
      ) : (
        <div className="pt-32 pb-20 text-center">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold text-foreground mb-4">{page?.title}</h1>
            {page?.description && (
              <p className="text-muted-foreground">{page.description}</p>
            )}
            {!page?.description && (
              <p className="text-muted-foreground">
                Add sections to this page from the admin panel.
              </p>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default DynamicPage;
