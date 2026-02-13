import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Search, Download, RefreshCw } from 'lucide-react';

interface ActivityLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  login: 'outline',
  logout: 'outline',
};

export default function AdminActivityLog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  const { toast } = useToast();
  const { data: logs = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as ActivityLog[];
    },
    staleTime: 60 * 1000,
  });

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    
    return matchesSearch && matchesAction && matchesEntity;
  });

  const uniqueEntityTypes = [...new Set(logs.map(l => l.entity_type))];
  const uniqueActions = [...new Set(logs.map(l => l.action))];

  const exportToCsv = () => {
    const headers = ['Date', 'User', 'Action', 'Entity Type', 'Entity Name', 'Details'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.user_email || 'Unknown',
      log.action,
      log.entity_type,
      log.entity_name || '-',
      JSON.stringify(log.details || {}),
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Activity Log</h1>
          <p className="text-muted-foreground">Track all admin actions and changes</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              refetch().then(() => {
                toast({ title: 'Activity log refreshed' });
              }).catch(() => {
                toast({ title: 'Refresh failed', variant: 'destructive' });
              });
            }}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user or entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map(action => (
              <SelectItem key={action} value={action}>{action}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {uniqueEntityTypes.map(entity => (
              <SelectItem key={entity} value={entity}>{entity}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-foreground/70">Loading activity log...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-foreground/70">No activity logs found</div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={ACTION_COLORS[log.action] || 'outline'}>
                        {log.action}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {log.entity_type}
                      </span>
                    </div>
                    <p className="text-sm">
                      <span className="font-medium">{log.user_email || 'Unknown user'}</span>
                      {' '}
                      {log.action === 'create' && 'created'}
                      {log.action === 'update' && 'updated'}
                      {log.action === 'delete' && 'deleted'}
                      {log.action === 'login' && 'logged in'}
                      {log.action === 'logout' && 'logged out'}
                      {' '}
                      {log.entity_name && <span className="font-medium">"{log.entity_name}"</span>}
                    </p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-2 p-2 bg-muted/50 rounded-md border border-border">
                        <p className="text-xs font-medium text-foreground mb-1">Details:</p>
                        <pre className="text-xs text-foreground font-mono overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-foreground/70 whitespace-nowrap">
                    <p>{format(new Date(log.created_at), 'MMM d, yyyy')}</p>
                    <p>{format(new Date(log.created_at), 'HH:mm:ss')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
