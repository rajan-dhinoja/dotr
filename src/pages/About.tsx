import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { usePageSections } from "@/hooks/usePageSections";
import { usePageBySlug } from "@/hooks/usePages";
import { Skeleton } from "@/components/ui/skeleton";

const About = () => {
  const { data: page } = usePageBySlug("about");
  const { data: sections, isLoading } = usePageSections("about");

  const title = page?.title ?? "About Us";
  const description = page?.description ?? null;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {isLoading && !sections?.length ? (
        <div className="pt-24 pb-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold text-foreground mb-2">{title}</h1>
            {description && <p className="text-muted-foreground mb-8">{description}</p>}
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
            <h1 className="text-4xl font-bold text-foreground mb-4">{title}</h1>
            <p className="text-muted-foreground">
              {description ?? "Add sections to this page from the admin panel."}
            </p>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default About;
