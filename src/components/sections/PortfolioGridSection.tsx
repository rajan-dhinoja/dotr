import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useProjectsWithFilter } from '@/hooks/useProjects';
import { Skeleton } from '@/components/ui/skeleton';

interface PortfolioItem {
  image: string;
  title: string;
  category: string;
  link?: string;
}

interface PortfolioGridSectionProps {
  title?: string | null;
  subtitle?: string | null;
  content?: Record<string, unknown>;
}

export function PortfolioGridSection({ title, subtitle, content }: PortfolioGridSectionProps) {
  const useDynamicSource = content?.source === 'dynamic';
  const { data: projects, isLoading: dynamicLoading } = useProjectsWithFilter(undefined, { enabled: useDynamicSource });

  const staticItems = (content?.items as PortfolioItem[]) || [];
  const dynamicItems: PortfolioItem[] = (projects ?? []).map((p) => ({
    image: p.cover_image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
    title: p.title,
    category: p.client || 'Project',
    link: `/portfolio/${p.slug}`,
  }));

  const items = useDynamicSource ? dynamicItems : staticItems;
  const showFilters = content?.show_filters !== false;
  const isLoading = useDynamicSource && dynamicLoading;

  const categories = ['All', ...new Set(items.map(item => item.category).filter(Boolean))];
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredItems = activeCategory === 'All' 
    ? items 
    : items.filter(item => item.category === activeCategory);

  if (isLoading) {
    return (
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
            ))}
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

        {showFilters && categories.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => (
            <div key={index} className="group relative overflow-hidden rounded-lg aspect-[4/3]">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <p className="text-sm text-primary mb-1">{item.category}</p>
                  <h3 className="text-xl font-semibold text-foreground">
                    {item.link ? (
                      <Link to={item.link} className="hover:text-primary transition-colors">
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
