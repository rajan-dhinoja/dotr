import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { SectionClipboardProvider } from "@/contexts/SectionClipboardContext";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";
import { HashScrollHandler } from "@/components/routing/HashScrollHandler";
import { PrefetchNavSections } from "@/components/routing/PrefetchNavSections";
import { ScrollToEnds } from "@/components/interactive/ScrollToEnds";

// Public pages - lazy loaded for smaller initial bundle
const Index = lazy(() => import("./pages/Index"));
const About = lazy(() => import("./pages/About"));
const Services = lazy(() => import("./pages/Services"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail"));
const SubServiceDetail = lazy(() => import("./pages/SubServiceDetail"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Testimonials = lazy(() => import("./pages/Testimonials"));
const Contact = lazy(() => import("./pages/Contact"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DynamicPage = lazy(() => import("./pages/DynamicPage"));

// Admin pages - lazy loaded for better performance
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminServices = lazy(() => import("./pages/admin/Services"));
const AdminServiceCategories = lazy(() => import("./pages/admin/ServiceCategories"));
const AdminProjects = lazy(() => import("./pages/admin/Projects"));
const AdminBlogPosts = lazy(() => import("./pages/admin/BlogPosts"));
const AdminTeam = lazy(() => import("./pages/admin/Team"));
const AdminTestimonials = lazy(() => import("./pages/admin/Testimonials"));
const AdminLeads = lazy(() => import("./pages/admin/Leads"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminPageSections = lazy(() => import("./pages/admin/PageSections"));
const AdminPages = lazy(() => import("./pages/admin/Pages"));
const AdminMedia = lazy(() => import("./pages/admin/Media"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminActivityLog = lazy(() => import("./pages/admin/ActivityLog"));
const AdminBlogCategories = lazy(() => import("./pages/admin/BlogCategories"));
const AdminFormSubmissions = lazy(() => import("./pages/admin/FormSubmissions"));
const AdminAbout = lazy(() => import("./pages/admin/AdminAbout"));
const AdminContact = lazy(() => import("./pages/admin/AdminContact"));
const AdminBlogPage = lazy(() => import("./pages/admin/AdminBlogPage"));

// Light fallback for public (lazy) pages
const PublicPageFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-4">
      <Skeleton className="h-3 w-48 rounded-full animate-pulse" />
      <Skeleton className="h-3 w-64 rounded-full animate-pulse" />
    </div>
  </div>
);

// Loading fallback for admin pages
const AdminLoadingFallback = () => (
  <div className="min-h-screen flex bg-background">
    <div className="w-64 bg-card border-r border-border p-4">
      <Skeleton className="h-8 w-32 mb-6" />
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
    <div className="flex-1 p-6">
      <Skeleton className="h-10 w-48 mb-6" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  </div>
);

/** Renders ScrollToEnds on public routes only (not under /admin). */
function PublicScrollToEnds() {
  const location = useLocation();
  if (location.pathname.startsWith("/admin")) return null;
  return <ScrollToEnds />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // Default 1 minute stale time
      retry: 1,
      // Avoid aggressive refetching when switching tabs/windows, which was causing
      // the UI to appear like it's "loading forever" on every focus change.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <SectionClipboardProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <HashScrollHandler />
              <PrefetchNavSections />
              <PublicScrollToEnds />
              <Routes>
                <Route path="/" element={<Suspense fallback={<PublicPageFallback />}><Index /></Suspense>} />
                <Route path="/about" element={<Suspense fallback={<PublicPageFallback />}><About /></Suspense>} />
                <Route path="/services" element={<Suspense fallback={<PublicPageFallback />}><Services /></Suspense>} />
                <Route path="/services/:category" element={<Suspense fallback={<PublicPageFallback />}><ServiceDetail /></Suspense>} />
                <Route path="/services/:category/:service" element={<Suspense fallback={<PublicPageFallback />}><SubServiceDetail /></Suspense>} />
                <Route path="/portfolio" element={<Suspense fallback={<PublicPageFallback />}><Portfolio /></Suspense>} />
                <Route path="/portfolio/:slug" element={<Suspense fallback={<PublicPageFallback />}><ProjectDetail /></Suspense>} />
                <Route path="/blog" element={<Suspense fallback={<PublicPageFallback />}><Blog /></Suspense>} />
                <Route path="/blog/:slug" element={<Suspense fallback={<PublicPageFallback />}><BlogPost /></Suspense>} />
                <Route path="/testimonials" element={<Suspense fallback={<PublicPageFallback />}><Testimonials /></Suspense>} />
                <Route path="/contact" element={<Suspense fallback={<PublicPageFallback />}><Contact /></Suspense>} />
                <Route path="/privacy" element={<Suspense fallback={<PublicPageFallback />}><PrivacyPolicy /></Suspense>} />
                <Route path="/terms" element={<Suspense fallback={<PublicPageFallback />}><TermsOfService /></Suspense>} />
                
                {/* Admin Routes - wrapped in Suspense for lazy loading */}
                <Route path="/admin/login" element={<Suspense fallback={<AdminLoadingFallback />}><AdminLogin /></Suspense>} />
                <Route path="/admin" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminDashboard /></Suspense></ProtectedRoute>} />
                <Route path="/admin/pages" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminPages /></Suspense></ProtectedRoute>} />
                <Route path="/admin/page-sections" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminPageSections /></Suspense></ProtectedRoute>} />
                <Route path="/admin/about" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminAbout /></Suspense></ProtectedRoute>} />
                <Route path="/admin/contact" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminContact /></Suspense></ProtectedRoute>} />
                <Route path="/admin/blog-page" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminBlogPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/services" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminServices /></Suspense></ProtectedRoute>} />
                <Route path="/admin/service-categories" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminServiceCategories /></Suspense></ProtectedRoute>} />
                <Route path="/admin/projects" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminProjects /></Suspense></ProtectedRoute>} />
                <Route path="/admin/blog" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminBlogPosts /></Suspense></ProtectedRoute>} />
                <Route path="/admin/blog-categories" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminBlogCategories /></Suspense></ProtectedRoute>} />
                <Route path="/admin/form-submissions" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminFormSubmissions /></Suspense></ProtectedRoute>} />
                <Route path="/admin/team" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminTeam /></Suspense></ProtectedRoute>} />
                <Route path="/admin/testimonials" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminTestimonials /></Suspense></ProtectedRoute>} />
                <Route path="/admin/leads" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminLeads /></Suspense></ProtectedRoute>} />
                <Route path="/admin/menus" element={<Navigate to="/admin/pages" replace />} />
                <Route path="/admin/media" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminMedia /></Suspense></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminUsers /></Suspense></ProtectedRoute>} />
                <Route path="/admin/activity-log" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminActivityLog /></Suspense></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute><Suspense fallback={<AdminLoadingFallback />}><AdminSettings /></Suspense></ProtectedRoute>} />
                
                {/* Dynamic pages - matches any slug from the pages table */}
                <Route path="/:slug" element={<Suspense fallback={<PublicPageFallback />}><DynamicPage /></Suspense>} />
                
                <Route path="*" element={<Suspense fallback={<PublicPageFallback />}><NotFound /></Suspense>} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </SectionClipboardProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
