import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceHero } from "@/components/services/ServiceHero";
import { ServiceFeatures } from "@/components/services/ServiceFeatures";
import { ServiceProcess } from "@/components/services/ServiceProcess";
import { ServiceTechnologies } from "@/components/services/ServiceTechnologies";
import { ServiceFAQ } from "@/components/services/ServiceFAQ";
import { ServicePricing } from "@/components/services/ServicePricing";
import { ServiceCTA } from "@/components/services/ServiceCTA";

interface Feature {
  title: string;
  description: string;
  icon?: string;
}

interface ProcessStep {
  title: string;
  description: string;
  icon?: string;
}

interface FAQ {
  question: string;
  answer: string;
}

export default function SubServiceDetail() {
  const { category, service } = useParams<{ category: string; service: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["sub-service", category, service],
    queryFn: async () => {
      // First get the category
      const { data: cat, error: catError } = await supabase
        .from("service_categories")
        .select("*")
        .eq("slug", category)
        .maybeSingle();
      
      if (catError) throw catError;
      if (!cat) return null;

      // Then get the service
      const { data: serviceData, error: serviceError } = await supabase
        .from("services")
        .select("*")
        .eq("slug", service)
        .eq("category_id", cat.id)
        .maybeSingle();

      if (serviceError) throw serviceError;
      if (!serviceData) return null;

      return { 
        category: cat, 
        service: serviceData 
      };
    },
    enabled: !!category && !!service,
  });

  // Parse JSON fields safely
  const features: Feature[] = data?.service?.features 
    ? (Array.isArray(data.service.features) ? data.service.features : []) as unknown as Feature[]
    : [];

  const processSteps: ProcessStep[] = data?.service?.process_steps
    ? (Array.isArray(data.service.process_steps) ? data.service.process_steps : []) as unknown as ProcessStep[]
    : [];

  const faqs: FAQ[] = data?.service?.faqs
    ? (Array.isArray(data.service.faqs) ? data.service.faqs : []) as unknown as FAQ[]
    : [];

  const technologies: string[] = data?.service?.technologies
    ? (Array.isArray(data.service.technologies) ? data.service.technologies : []) as unknown as string[]
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {isLoading ? (
          <div className="pt-32 pb-20 container mx-auto px-4">
            <Skeleton className="h-8 w-32 mb-6" />
            <Skeleton className="h-16 w-16 mb-6" />
            <Skeleton className="h-14 w-3/4 mb-4" />
            <Skeleton className="h-6 w-full max-w-2xl mb-8" />
            <div className="flex gap-4">
              <Skeleton className="h-12 w-36" />
              <Skeleton className="h-12 w-36" />
            </div>
          </div>
        ) : data ? (
          <>
            <ServiceHero
              title={data.service.name || data.service.title}
              summary={data.service.tagline}
              categoryName={data.category.name}
              categorySlug={data.category.slug}
              iconName={data.service.icon || data.service.icon_name}
              heroImageUrl={data.service.image_url}
            />

            {/* Description Section */}
            {data.service.description && (
              <section className="py-20">
                <div className="container mx-auto px-4">
                  <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-foreground mb-6">
                      About This Service
                    </h2>
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                        {data.service.description}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <ServiceFeatures features={features} />
            <ServiceProcess steps={processSteps} />
            <ServiceTechnologies 
              technologies={technologies} 
              description={data.service.description}
            />
            <ServiceFAQ faqs={faqs} serviceTitle={data.service.name || data.service.title} />
            <ServicePricing 
              pricingInfo={data.service.pricing}
              deliveryTime={null}
              serviceTitle={data.service.name || data.service.title}
            />
            <ServiceCTA serviceTitle={data.service.name || data.service.title} />
          </>
        ) : (
          <div className="pt-32 pb-20 container mx-auto px-4 text-center">
            <h1 className="text-3xl font-bold text-foreground mb-4">Service Not Found</h1>
            <p className="text-muted-foreground">
              The service you're looking for doesn't exist or has been removed.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}