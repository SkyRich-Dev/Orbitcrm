import { useQuery } from "@tanstack/react-query";
import { Building2, Users, CreditCard, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Company, CompanySubscription, SubscriptionPlan } from "@shared/schema";

type PlatformStats = {
  totalTenants: number;
  totalUsers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
};

type Tenant = Company & {
  userCount: number;
  planName: string;
  subscriptionStatus: string;
  subscription: CompanySubscription | null;
};

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: rawTenants, isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
  });
  const tenants = rawTenants ?? [];

  const { data: rawPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/plans"],
  });
  const plans = rawPlans ?? [];

  const statCards = [
    { label: "Total Tenants", value: stats?.totalTenants ?? 0, icon: Building2, color: "text-chart-1" },
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-chart-2" },
    { label: "Active Subscriptions", value: stats?.activeSubscriptions ?? 0, icon: CreditCard, color: "text-chart-3" },
    { label: "Total Revenue", value: `$${(stats?.monthlyRevenue ?? 0).toLocaleString()}`, icon: DollarSign, color: "text-chart-4" },
  ];

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-admin-title">Platform Admin</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your SaaS platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Recent Tenants</h3>
            </div>
          </CardHeader>
          <CardContent>
            {tenantsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {tenants.slice(0, 8).map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`tenant-row-${tenant.id}`}>
                    <div>
                      <p className="text-sm font-medium">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{tenant.industry || "No industry"} &middot; {tenant.userCount} users</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{tenant.planName}</Badge>
                      <Badge
                        variant={tenant.subscriptionStatus === "active" ? "default" : tenant.subscriptionStatus === "trial" ? "secondary" : "destructive"}
                        className="text-xs capitalize"
                      >
                        {tenant.subscriptionStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Plan Distribution</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plans.map((plan) => {
                const count = tenants.filter((t) => t.subscription?.planId === plan.id).length;
                const pct = tenants.length > 0 ? Math.round((count / tenants.length) * 100) : 0;
                return (
                  <div key={plan.id} className="space-y-1" data-testid={`plan-dist-${plan.id}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{plan.name}</span>
                      <span className="text-xs text-muted-foreground">{count} tenants ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
