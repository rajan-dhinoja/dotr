import { GlassCard } from '@/components/interactive/GlassCard';
import { Link } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import {
  useServiceCategories,
  useServicesChildrenFromPages,
  useServicesUnderCategory,
  useServicesWithCategories,
  useServicesWithCategoriesFromPages,
  type Service,
} from '@/hooks/useServices';
import { Skeleton } from '@/components/ui/skeleton';

interface ServiceItem {
  icon: string;
  title: string;
  description: string;
  link?: string;
}

interface ServicesGridSectionProps {
  title?: string | null;
  subtitle?: string | null;
  content?: Record<string, unknown>;
  /** When on a category page (e.g. /services/designing), pass category slug to show services under it */
  categorySlug?: string | null;
}

export function ServicesGridSection({
  title,
  subtitle,
  content,
  categorySlug,
}: ServicesGridSectionProps) {
  const useDynamicSource = content?.source === 'dynamic';
  const groupByCategory = content?.groupByCategory === true;
  const slugFromContent = (content?.categorySlug as string) || null;
  const effectiveCategorySlug = categorySlug ?? slugFromContent;
  const needsDynamicData = useDynamicSource || groupByCategory;

  const { data: pagesChildren, isLoading: pagesLoading } = useServicesChildrenFromPages({ enabled: needsDynamicData });
  const { data: categoriesWithServicesFromPages, isLoading: groupedFromPagesLoading } =
    useServicesWithCategoriesFromPages({ enabled: needsDynamicData });
  const { data: categories, isLoading: categoriesLoading } = useServiceCategories({ enabled: needsDynamicData });
  const { data: categoryServices, isLoading: servicesLoading } = useServicesUnderCategory(
    effectiveCategorySlug ?? '',
    { enabled: needsDynamicData }
  );
  const { data: categoriesWithServices, isLoading: groupedLoading } = useServicesWithCategories({ enabled: needsDynamicData });

  const staticItems = (content?.items as ServiceItem[] | undefined) || [];

  let dynamicItems: ServiceItem[] = [];
  let groupedData: Array<{ category: { name: string; slug: string; icon?: string }; services: ServiceItem[] }> = [];

  if (useDynamicSource) {
    if (effectiveCategorySlug) {
      // On category page: show services under this category
      dynamicItems = (categoryServices ?? []).map((s: Service) => ({
        icon: (s.icon_name ?? s.icon) || 'Briefcase',
        title: (s as { name?: string; title?: string }).name ?? (s as { name?: string; title?: string }).title ?? s.slug,
        description: (s.description ?? s.tagline ?? '').toString().slice(0, 200),
        link: effectiveCategorySlug ? `/services/${effectiveCategorySlug}/${s.slug}` : undefined,
      }));
    } else if (groupByCategory) {
      // Main services page with groupByCategory: prefer pages-based (with type filtering), fallback to service_categories/services
      const fromPages = (categoriesWithServicesFromPages ?? [])
        .filter((g) => g.services && (g.services as Service[]).length > 0)
        .map((g) => ({
          category: {
            name: g.name,
            slug: g.slug,
            icon: (g.icon as string) || 'Briefcase',
          },
          services: (g.services as Service[]).map((s: Service) => ({
            icon: (s.icon_name ?? s.icon) || 'Briefcase',
            title: (s as { name?: string; title?: string }).name ?? (s as { name?: string; title?: string }).title ?? s.slug,
            description: (s.description ?? s.tagline ?? '').toString().slice(0, 200),
            link: `/services/${g.slug}/${s.slug}`,
          })),
        }));
      const fromTables = (categoriesWithServices ?? [])
        .filter((g) => g.services && (g.services as Service[]).length > 0)
        .map((g) => ({
          category: {
            name: g.name,
            slug: g.slug,
            icon: (g.icon as string) || 'Briefcase',
          },
          services: (g.services as Service[]).map((s: Service) => ({
            icon: (s.icon_name ?? s.icon) || 'Briefcase',
            title: (s as { name?: string; title?: string }).name ?? (s as { name?: string; title?: string }).title ?? s.slug,
            description: (s.description ?? s.tagline ?? '').toString().slice(0, 200),
            link: `/services/${g.slug}/${s.slug}`,
          })),
        }));
      groupedData = fromPages.length > 0 ? fromPages : fromTables;
      // Fallback to categories list if no grouped data (e.g. services not synced yet)
      if (groupedData.length === 0) {
        const fromPages = (pagesChildren ?? []).map((p) => ({
          icon: 'Briefcase' as const,
          title: p.title,
          description: p.description || '',
          link: p.slug.startsWith('services/') ? `/${p.slug}` : `/services/${p.slug}`,
        }));
        const fromCategories = (categories ?? []).map((cat) => ({
          icon: (cat.icon as string) || 'Briefcase',
          title: cat.name,
          description: cat.description || '',
          link: `/services/${cat.slug}`,
        }));
        dynamicItems = fromPages.length > 0 ? fromPages : fromCategories;
      }
    } else {
      // Main services page: show categories - prefer Pages (Admin navigation) over service_categories
      const fromPages = (pagesChildren ?? []).map((p) => ({
        icon: 'Briefcase' as const,
        title: p.title,
        description: p.description || '',
        link: p.slug.startsWith('services/') ? `/${p.slug}` : `/services/${p.slug}`,
      }));
      const fromCategories = (categories ?? []).map((cat) => ({
        icon: (cat.icon as string) || 'Briefcase',
        title: cat.name,
        description: cat.description || '',
        link: `/services/${cat.slug}`,
      }));
      dynamicItems = fromPages.length > 0 ? fromPages : fromCategories;
    }
  }

  const items = useDynamicSource ? dynamicItems : staticItems;
  const showGrouped = useDynamicSource && groupByCategory && groupedData.length > 0;
  const isLoading =
    useDynamicSource &&
    (effectiveCategorySlug
      ? servicesLoading
      : groupByCategory
        ? groupedFromPagesLoading || groupedLoading || (groupedData.length === 0 && (pagesLoading || categoriesLoading))
        : pagesLoading || categoriesLoading);

  const getIcon = (iconName: string) => {
    const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
    return icons[iconName] || LucideIcons.Briefcase;
  };

  if (useDynamicSource && isLoading) {
    return (
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          {(title || subtitle) && (
            <div className="text-center mb-12">
              {title && <Skeleton className="h-10 w-64 mx-auto mb-4" />}
              {subtitle && <Skeleton className="h-5 w-96 mx-auto" />}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const renderServiceCard = (item: ServiceItem, index: number) => {
    const Icon = getIcon(item.icon);
    const CardContent = (
      <GlassCard className="h-full p-6 group hover:border-primary/50 transition-colors">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          {item.title}
        </h3>
        <p className="text-muted-foreground">
          {item.description}
        </p>
      </GlassCard>
    );
    return item.link ? (
      <Link key={index} to={item.link} className="block h-full">
        {CardContent}
      </Link>
    ) : (
      <div key={index}>{CardContent}</div>
    );
  };

  if (showGrouped) {
    return (
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          {(title || subtitle) && (
            <div className="text-center mb-12">
              {title && (
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          <div className="space-y-16">
            {groupedData.map(({ category, services }) => {
              const CategoryIcon = getIcon(category.icon ?? 'Briefcase');
              return (
                <div key={category.slug}>
                  <Link
                    to={`/services/${category.slug}`}
                    className="inline-flex items-center gap-3 mb-6 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <CategoryIcon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {category.name}
                    </h3>
                  </Link>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((item, index) => renderServiceCard(item, index))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        {(title || subtitle) && (
          <div className="text-center mb-12">
            {title && (
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, index) => renderServiceCard(item, index))}
        </div>
      </div>
    </section>
  );
}
