import { GlassCard } from '@/components/interactive/GlassCard';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { useBlogPostsWithFilter } from '@/hooks/useBlogPosts';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface BlogPostsSectionProps {
  title?: string | null;
  subtitle?: string | null;
  content?: Record<string, unknown>;
}

export function BlogPostsSection({ title, subtitle, content }: BlogPostsSectionProps) {
  const count = (content?.count as number) || 3;
  const showFeaturedOnly = content?.show_featured_only === true;
  const layout = (content?.layout as string) || 'grid';

  const { data: posts, isLoading } = useBlogPostsWithFilter(count);

  const displayPosts = posts?.slice(0, count) || [];

  if (isLoading) {
    return (
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(count)].map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-lg" />
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

        <div className={`grid gap-6 ${layout === 'list' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {displayPosts.map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`}>
              <GlassCard className="h-full overflow-hidden group hover:border-primary/50 transition-colors">
                {post.cover_image && (
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={post.cover_image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    {post.published_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(post.published_at), 'MMM d, yyyy')}
                      </span>
                    )}
                    {post.read_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {post.read_time} min read
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-muted-foreground line-clamp-2 mb-4">
                      {post.excerpt}
                    </p>
                  )}
                  <span className="inline-flex items-center text-primary text-sm font-medium">
                    Read more
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
