import { useQuery, useMutation } from "@tanstack/react-query";
import {
  TrendingUp,
  Users,
  Briefcase,
  DollarSign,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Brain,
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AiInsight } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

interface DashboardStats {
  totalLeads: number;
  totalContacts: number;
  totalDeals: number;
  totalTasks: number;
  totalRevenue: number;
  conversionRate: number;
  leadsBySource: { name: string; value: number }[];
  dealsByStage: { name: string; value: number; color: string }[];
  revenueByMonth: { month: string; revenue: number }[];
  recentActivities: { id: number; type: string; title: string; createdAt: string }[];
  avgAiScore?: number;
  predictedPipeline?: number;
}

const CHART_COLORS = [
  "hsl(217, 91%, 35%)",
  "hsl(142, 76%, 30%)",
  "hsl(280, 65%, 35%)",
  "hsl(25, 95%, 35%)",
  "hsl(340, 82%, 35%)",
];

function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  testId,
}: {
  title: string;
  value: string;
  icon: any;
  change?: number;
  changeLabel?: string;
  testId: string;
}) {
  const isPositive = (change || 0) >= 0;
  return (
    <Card data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {isPositive ? (
                  <ArrowUpRight className="w-3 h-3 text-chart-2" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-destructive" />
                )}
                <span className={`text-xs font-medium ${isPositive ? "text-chart-2" : "text-destructive"}`}>
                  {Math.abs(change)}%
                </span>
                {changeLabel && (
                  <span className="text-xs text-muted-foreground">{changeLabel}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsLoading() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const severityConfig: Record<string, { icon: any; color: string; bg: string }> = {
  critical: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  warning: { icon: AlertTriangle, color: "text-chart-4", bg: "bg-chart-4/10" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10" },
  positive: { icon: CheckCircle, color: "text-chart-2", bg: "bg-chart-2/10" },
};

function AiInsightsWidget() {
  const { toast } = useToast();
  const { data: rawInsights, isLoading } = useQuery<AiInsight[]>({
    queryKey: ["/api/ai/insights"],
  });
  const insights = rawInsights ?? [];

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/generate-insights"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/insights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Insights Generated", description: "New AI insights are available." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate insights", variant: "destructive" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/ai/insights/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/insights"] });
    },
  });

  const unreadInsights = insights.filter((i) => !i.isRead);
  const displayInsights = insights.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-chart-4" />
            <div>
              <h3 className="text-sm font-semibold">AI Insights</h3>
              <p className="text-xs text-muted-foreground">
                {unreadInsights.length > 0 ? `${unreadInsights.length} new` : "All caught up"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-insights"
          >
            <Brain className="w-3 h-3 mr-1" />
            {generateMutation.isPending ? "Generating..." : "Generate"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : displayInsights.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">No insights yet</p>
            <p className="text-xs text-muted-foreground mt-1">Click Generate to create AI insights</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayInsights.map((insight) => {
              const config = severityConfig[insight.severity] || severityConfig.info;
              const SeverityIcon = config.icon;
              return (
                <div
                  key={insight.id}
                  className={`flex items-start gap-3 p-3 rounded-md border ${!insight.isRead ? "bg-muted/30" : ""}`}
                  data-testid={`insight-${insight.id}`}
                >
                  <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${config.bg}`}>
                    <SeverityIcon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{insight.title}</p>
                    {insight.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{insight.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{insight.insightType}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(insight.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                  {!insight.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 w-7 h-7"
                      onClick={() => markReadMutation.mutate(insight.id)}
                      data-testid={`button-mark-read-${insight.id}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of your CRM performance</p>
        </div>
        <StatsLoading />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card><CardContent className="p-5"><Skeleton className="h-64 w-full" /></CardContent></Card>
          <Card><CardContent className="p-5"><Skeleton className="h-64 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your CRM performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={String(stats?.totalLeads || 0)}
          icon={Users}
          change={12}
          changeLabel="vs last month"
          testId="stat-total-leads"
        />
        <StatCard
          title="Total Deals"
          value={String(stats?.totalDeals || 0)}
          icon={Briefcase}
          change={8}
          changeLabel="vs last month"
          testId="stat-total-deals"
        />
        <StatCard
          title="Revenue"
          value={`$${((stats?.totalRevenue || 0) / 1000).toFixed(1)}k`}
          icon={DollarSign}
          change={15}
          changeLabel="vs last month"
          testId="stat-revenue"
        />
        <StatCard
          title="Conversion"
          value={`${stats?.conversionRate || 0}%`}
          icon={TrendingUp}
          change={3}
          changeLabel="vs last month"
          testId="stat-conversion"
        />
      </div>

      {(stats?.avgAiScore || stats?.predictedPipeline) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats?.avgAiScore !== undefined && stats.avgAiScore > 0 && (
            <Card data-testid="stat-avg-ai-score">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg AI Lead Score</p>
                    <p className="text-2xl font-bold mt-1">{Math.round(stats.avgAiScore)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Out of 100</p>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 rounded-md bg-chart-4/10">
                    <Sparkles className="w-5 h-5 text-chart-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {stats?.predictedPipeline !== undefined && stats.predictedPipeline > 0 && (
            <Card data-testid="stat-predicted-pipeline">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <p className="text-sm text-muted-foreground">AI Predicted Pipeline</p>
                    <p className="text-2xl font-bold mt-1">${(stats.predictedPipeline / 1000).toFixed(1)}k</p>
                    <p className="text-xs text-muted-foreground mt-1">Weighted forecast</p>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 rounded-md bg-chart-2/10">
                    <Brain className="w-5 h-5 text-chart-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-1">
              <div>
                <h3 className="text-sm font-semibold">Revenue Trend</h3>
                <p className="text-xs text-muted-foreground">Last 6 months</p>
              </div>
              <Badge variant="secondary">Monthly</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats?.revenueByMonth || []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 35%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(217, 91%, 35%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(217, 91%, 35%)"
                  strokeWidth={2}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-1">
              <div>
                <h3 className="text-sm font-semibold">Deals by Stage</h3>
                <p className="text-xs text-muted-foreground">Pipeline distribution</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stats?.dealsByStage || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(stats?.dealsByStage || []).map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {(stats?.dealsByStage || []).map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-1">
              <div>
                <h3 className="text-sm font-semibold">Leads by Source</h3>
                <p className="text-xs text-muted-foreground">Where leads come from</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats?.leadsBySource || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="value" fill="hsl(217, 91%, 35%)" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <AiInsightsWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-1">
              <div>
                <h3 className="text-sm font-semibold">Recent Activity</h3>
                <p className="text-xs text-muted-foreground">Latest actions</p>
              </div>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {(stats?.recentActivities || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
              ) : (
                (stats?.recentActivities || []).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 py-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {activity.type}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            title="Open Tasks"
            value={String(stats?.totalTasks || 0)}
            icon={CheckSquare}
            testId="stat-tasks"
          />
          <StatCard
            title="Contacts"
            value={String(stats?.totalContacts || 0)}
            icon={Users}
            testId="stat-contacts"
          />
          <StatCard
            title="Active Deals"
            value={String(stats?.totalDeals || 0)}
            icon={Briefcase}
            testId="stat-active-deals"
          />
          <StatCard
            title="Win Rate"
            value={`${stats?.conversionRate || 0}%`}
            icon={TrendingUp}
            testId="stat-win-rate"
          />
        </div>
      </div>
    </div>
  );
}
