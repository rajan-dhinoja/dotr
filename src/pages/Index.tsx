import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { usePageSections } from "@/hooks/usePageSections";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { data: sections, isLoading } = usePageSections("home");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {isLoading && !sections?.length ? (
        <div className="flex-1 pt-24 pb-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold text-foreground mb-2">Welcome</h1>
            <div className="flex justify-center gap-2 mt-6" aria-hidden>
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
            <h1 className="text-4xl font-bold text-foreground mb-4">Welcome</h1>
            <p className="text-muted-foreground">
              Add sections to this page from the admin panel.
            </p>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Index;
