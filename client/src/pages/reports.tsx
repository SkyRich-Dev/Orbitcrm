import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, Target, Briefcase, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lead, Contact, Deal } from "@shared/schema";

export default function ReportsPage() {
  const { data: rawLeads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });
  const leads = rawLeads ?? [];

  const { data: rawContacts, isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });
  const contacts = rawContacts ?? [];

  const { data: rawDeals, isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });
  const deals = rawDeals ?? [];

  const isLoading = leadsLoading || contactsLoading || dealsLoading;

  const totalLeadValue = leads.reduce((sum, l) => sum + parseFloat(l.value || "0"), 0);
  const totalDealValue = deals.reduce((sum, d) => sum + parseFloat(d.value || "0"), 0);
  const wonDeals = deals.filter(d => d.status === "won");
  const wonValue = wonDeals.reduce((sum, d) => sum + parseFloat(d.value || "0"), 0);
  const lostDeals = deals.filter(d => d.status === "lost");
  const activeDeals = deals.filter(d => d.status === "active" || d.status === "open");
  const winRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;

  const leadsBySource = leads.reduce((acc, l) => {
    const src = l.source || "Unknown";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const leadsByStatus = leads.reduce((acc, l) => {
    const st = l.status || "new";
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dealsByStatus = deals.reduce((acc, d) => {
    const st = d.status || "active";
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Reports & Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your CRM performance and metrics</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="stat-total-leads">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Total Leads</p>
                <p className="text-lg font-bold">${totalLeadValue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-total-contacts">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-4 h-4 text-green-500" />
                  <Badge variant="secondary" className="text-xs">{contacts.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Total Contacts</p>
                <p className="text-lg font-bold">{contacts.length}</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-total-deals">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Briefcase className="w-4 h-4 text-purple-500" />
                  <Badge variant="secondary" className="text-xs">{deals.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Total Deals</p>
                <p className="text-lg font-bold">${totalDealValue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-win-rate">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <Badge variant={winRate >= 50 ? "default" : "secondary"} className="text-xs">{winRate}%</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="text-lg font-bold">${wonValue.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Leads by Source</h3>
                </div>
              </CardHeader>
              <CardContent>
                {Object.keys(leadsBySource).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lead data</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(leadsBySource)
                      .sort((a, b) => b[1] - a[1])
                      .map(([source, count]) => (
                        <div key={source} className="flex items-center justify-between" data-testid={`report-source-${source}`}>
                          <span className="text-sm capitalize">{source}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary rounded-full h-2"
                                style={{ width: `${Math.round((count / leads.length) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
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
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Leads by Status</h3>
                </div>
              </CardHeader>
              <CardContent>
                {Object.keys(leadsByStatus).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lead data</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(leadsByStatus)
                      .sort((a, b) => b[1] - a[1])
                      .map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between" data-testid={`report-status-${status}`}>
                          <span className="text-sm capitalize">{status}</span>
                          <Badge variant="secondary" className="text-xs">{count}</Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Deal Pipeline Summary</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50" data-testid="report-deals-active">
                  <p className="text-2xl font-bold">{activeDeals.length}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20" data-testid="report-deals-won">
                  <p className="text-2xl font-bold text-green-600">{wonDeals.length}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-green-500" /> Won
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20" data-testid="report-deals-lost">
                  <p className="text-2xl font-bold text-red-600">{lostDeals.length}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <ArrowDownRight className="w-3 h-3 text-red-500" /> Lost
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50" data-testid="report-deals-total">
                  <p className="text-2xl font-bold">{deals.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
