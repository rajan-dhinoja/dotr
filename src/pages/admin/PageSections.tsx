import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SectionManager } from "@/components/admin/SectionManager";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutGrid } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminPageSections() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = searchParams.get("page");
  const sectionFromUrl = searchParams.get("section") || undefined;
  const [selectedPageType, setSelectedPageType] = useState<string>("");

  const clearSectionParam = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("section");
        return next;
      },
      { replace: true }
    );
  };

  // Fetch all pages from the database
  const { data: pages, isLoading } = useQuery({
    queryKey: ["admin-pages-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("id, title, slug")
        .order("display_order");
      
      if (error) throw error;
      return data;
    },
  });

  // Set selected page: from URL ?page= slug if valid, otherwise first page
  useEffect(() => {
    if (!pages || pages.length === 0) return;
    if (pageFromUrl && pages.some((p) => p.slug === pageFromUrl)) {
      setSelectedPageType(pageFromUrl);
    } else if (!selectedPageType) {
      setSelectedPageType(pages[0].slug);
    }
  }, [pages, pageFromUrl, selectedPageType]);

  const selectedPage = pages?.find(p => p.slug === selectedPageType);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <LayoutGrid className="h-8 w-8" />
              Page Sections
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage dynamic sections for each page of your website
            </p>
          </div>
          
          <div className="w-full md:w-64">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedPageType} onValueChange={setSelectedPageType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a page" />
                </SelectTrigger>
                <SelectContent>
                  {pages?.map((page) => (
                    <SelectItem key={page.id} value={page.slug}>
                      {page.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {selectedPageType && (
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedPage?.title} Sections
              </CardTitle>
              <CardDescription>
                Add, edit, reorder, and remove sections for this page. Changes are saved automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SectionManager
                pageType={selectedPageType}
                initialSectionId={sectionFromUrl}
                onEditDialogClose={clearSectionParam}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
