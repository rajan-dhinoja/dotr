import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  FolderOpen,
  FileText,
  Users,
  MessageSquare,
  Mail,
  LogOut,
  Settings,
  LayoutGrid,
  Image,
  Activity,
  Menu,
  FolderTree,
  Tag,
  ClipboardList,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'Content' },
  { href: '/admin/menus', label: 'Menus', icon: Menu },  
  { href: '/admin/pages', label: 'Pages', icon: FolderTree },
  { href: '/admin/page-sections', label: 'Page Sections', icon: LayoutGrid },
  { href: '/admin/blog', label: 'Blog Posts', icon: FileText },
  { href: '/admin/blog-categories', label: 'Blog Categories', icon: Tag },
  { href: '/admin/form-submissions', label: 'Form Submissions', icon: ClipboardList },
  { section: 'Portfolio' },
  { href: '/admin/services', label: 'Services', icon: Briefcase },
  { href: '/admin/service-categories', label: 'Service Categories', icon: Tag },
  { href: '/admin/projects', label: 'Projects', icon: FolderOpen },
  { section: 'People' },
  { href: '/admin/team', label: 'Team', icon: Users },
  { href: '/admin/testimonials', label: 'Testimonials', icon: MessageSquare },
  { href: '/admin/leads', label: 'Contact Leads', icon: Mail },
  { section: 'Appearance' },
  { href: '/admin/media', label: 'Media Library', icon: Image },
  { section: 'System' },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/activity-log', label: 'Activity Log', icon: Activity },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-card border-r border-border flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <Link to="/" className="font-bold text-xl text-foreground">DOTR Admin</Link>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item, index) => {
            if ('section' in item) {
              return (
                <div key={index} className="pt-4 pb-2 first:pt-0">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {item.section}
                  </span>
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 truncate">{user?.email}</p>
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
