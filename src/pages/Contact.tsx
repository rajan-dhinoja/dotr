import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { usePageSections } from "@/hooks/usePageSections";
import { usePageBySlug } from "@/hooks/usePages";
import { Skeleton } from "@/components/ui/skeleton";

const Contact = () => {
  const { data: page } = usePageBySlug("contact");
  const { data: sections, isLoading } = usePageSections("contact");

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
        <div className="pt-32 pb-20 text-center">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold text-foreground mb-4">{page?.title ?? "Contact Us"}</h1>
            <p className="text-muted-foreground">
              {page?.description ?? "Add sections to this page from the admin panel."}
            </p>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Contact;
