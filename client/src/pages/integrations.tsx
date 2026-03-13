import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Puzzle, Search, Plug, Unplug, RefreshCw, Settings2,
  MessageSquare, Mail, CreditCard, ShoppingCart, Megaphone, Calendar,
  Calculator, Hash, Users, Send, MessageCircle, FileText,
  AlertTriangle, CheckCircle2, Clock, ExternalLink, Lock,
} from "lucide-react";
import type { IntegrationApp } from "@shared/schema";

type ConfigField = { name: string; type: string; label: string; required?: boolean; placeholder?: string };

const categoryIcons: Record<string, any> = {
  "Communication & Messaging": MessageSquare,
  "Email Platforms": Mail,
  "Payment Gateways": CreditCard,
  "Accounting Software": Calculator,
  "E-commerce Platforms": ShoppingCart,
  "Marketing & Advertising": Megaphone,
  "Calendar & Productivity": Calendar,
};

const categoryColors: Record<string, string> = {
  "Communication & Messaging": "bg-blue-500/10 text-blue-600 border-blue-200",
  "Email Platforms": "bg-purple-500/10 text-purple-600 border-purple-200",
  "Payment Gateways": "bg-green-500/10 text-green-600 border-green-200",
  "Accounting Software": "bg-orange-500/10 text-orange-600 border-orange-200",
  "E-commerce Platforms": "bg-pink-500/10 text-pink-600 border-pink-200",
  "Marketing & Advertising": "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  "Calendar & Productivity": "bg-teal-500/10 text-teal-600 border-teal-200",
};

export default function IntegrationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [connectDialog, setConnectDialog] = useState<IntegrationApp | null>(null);
  const [configDialog, setConfigDialog] = useState<any>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const { data: marketplaceData, isLoading: loadingApps, error: appsError } = useQuery<{ apps: IntegrationApp[]; grouped: Record<string, IntegrationApp[]> }>({
    queryKey: ["/api/integrations"],
  });

  const { data: connectedIntegrations, isLoading: loadingConnected } = useQuery<any[]>({
    queryKey: ["/api/integrations/connected"],
  });

  const { data: logs } = useQuery<any[]>({
    queryKey: ["/api/integrations/logs"],
  });

  const connectMutation = useMutation({
    mutationFn: (data: { integrationId: number; credentials?: Record<string, string> }) =>
      apiRequest("POST", "/api/integrations/connect", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/logs"] });
      setConnectDialog(null);
      setCredentials({});
      toast({ title: "Connected", description: "Integration connected successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/integrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/logs"] });
      toast({ title: "Disconnected", description: "Integration disconnected" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/integrations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      setConfigDialog(null);
      setCredentials({});
      toast({ title: "Updated", description: "Integration updated successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/integrations/${id}/sync`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/logs"] });
      toast({ title: "Sync triggered", description: "Data sync has been initiated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (appsError) {
    const is403 = (appsError as any)?.message?.includes("paid plans") || (appsError as any)?.status === 403;
    if (is403) {
      return (
        <div className="p-6 max-w-2xl mx-auto mt-16 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold" data-testid="text-integrations-locked">Integration Marketplace</h2>
          <p className="text-muted-foreground">
            The Integration Marketplace is available only on paid plans. Upgrade your subscription to connect third-party apps.
          </p>
          <Button variant="default" onClick={() => window.location.href = "/billing"} data-testid="button-upgrade-for-integrations">
            Upgrade Plan
          </Button>
        </div>
      );
    }
  }

  const apps = marketplaceData?.apps || [];
  const grouped = marketplaceData?.grouped || {};
  const categories = Object.keys(grouped);
  const connectedAppIds = new Set((connectedIntegrations || []).map((c: any) => c.integrationAppId));

  const filteredApps = apps.filter(app => {
    const matchesSearch = !searchQuery || app.name.toLowerCase().includes(searchQuery.toLowerCase()) || app.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || app.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredGrouped: Record<string, IntegrationApp[]> = {};
  for (const app of filteredApps) {
    if (!filteredGrouped[app.category]) filteredGrouped[app.category] = [];
    filteredGrouped[app.category].push(app);
  }

  const handleConnect = (app: IntegrationApp) => {
    setCredentials({});
    setConnectDialog(app);
  };

  const handleSubmitConnect = () => {
    if (!connectDialog) return;
    const fields = (connectDialog.configSchema as any)?.fields as ConfigField[] || [];
    const requiredFields = fields.filter(f => f.required);
    const missing = requiredFields.filter(f => !credentials[f.name]?.trim());
    if (missing.length > 0) {
      toast({ title: "Missing fields", description: `Please fill in: ${missing.map(f => f.label).join(", ")}`, variant: "destructive" });
      return;
    }
    connectMutation.mutate({ integrationId: connectDialog.id, credentials: Object.keys(credentials).length > 0 ? credentials : undefined });
  };

  const handleConfigure = (connection: any) => {
    const app = connection.app;
    setCredentials({});
    setConfigDialog(connection);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-integrations-title">
            <Puzzle className="w-6 h-6 text-primary" />
            Integration Marketplace
          </h1>
          <p className="text-muted-foreground mt-1">Connect your CRM with third-party apps and services</p>
        </div>
        <Badge variant="secondary" className="text-sm" data-testid="badge-total-apps">
          {apps.length} apps available
        </Badge>
      </div>

      <Tabs defaultValue="marketplace" className="space-y-4">
        <TabsList data-testid="tabs-integrations">
          <TabsTrigger value="marketplace" data-testid="tab-marketplace">
            <Puzzle className="w-4 h-4 mr-1" />
            Marketplace
          </TabsTrigger>
          <TabsTrigger value="connected" data-testid="tab-connected">
            <Plug className="w-4 h-4 mr-1" />
            Connected ({connectedIntegrations?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <Clock className="w-4 h-4 mr-1" />
            Activity Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-integrations"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge
                variant={selectedCategory === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedCategory("all")}
                data-testid="filter-all"
              >
                All
              </Badge>
              {categories.map(cat => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(cat)}
                  data-testid={`filter-${cat.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          </div>

          {loadingApps ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-10 w-10 rounded-lg" /><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-full" /><Skeleton className="h-8 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : (
            Object.entries(filteredGrouped).map(([category, catApps]) => {
              const CatIcon = categoryIcons[category] || Puzzle;
              const colorClass = categoryColors[category] || "bg-muted text-foreground";
              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${colorClass}`}>
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-lg" data-testid={`heading-${category.replace(/\s+/g, "-").toLowerCase()}`}>{category}</h3>
                    <Badge variant="outline" className="text-xs">{catApps.length}</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {catApps.map(app => {
                      const isConnected = connectedAppIds.has(app.id);
                      return (
                        <Card key={app.id} className="group hover:shadow-md transition-shadow" data-testid={`card-integration-${app.id}`}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className={`p-2 rounded-lg ${colorClass}`}>
                                <CatIcon className="w-5 h-5" />
                              </div>
                              {isConnected && (
                                <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-300">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Connected
                                </Badge>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold" data-testid={`text-app-name-${app.id}`}>{app.name}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5">by {app.providerName}</p>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{app.description}</p>
                            <div className="flex items-center justify-between pt-1">
                              <Badge variant="outline" className="text-xs">
                                {app.authType === "api_key" ? "API Key" : app.authType === "oauth" ? "OAuth" : "Webhook"}
                              </Badge>
                              {isAdmin && !isConnected && (
                                <Button size="sm" onClick={() => handleConnect(app)} data-testid={`button-connect-${app.id}`}>
                                  <Plug className="w-3 h-3 mr-1" />
                                  Connect
                                </Button>
                              )}
                              {!isAdmin && !isConnected && (
                                <span className="text-xs text-muted-foreground">Admin only</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="connected" className="space-y-4">
          {loadingConnected ? (
            <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
          ) : !connectedIntegrations?.length ? (
            <Card>
              <CardContent className="p-8 text-center space-y-3">
                <Unplug className="w-12 h-12 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-semibold">No Connected Integrations</h3>
                <p className="text-sm text-muted-foreground">Browse the marketplace to connect third-party apps to your CRM</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {connectedIntegrations.map((conn: any) => {
                const app = conn.app;
                const CatIcon = categoryIcons[app?.category] || Puzzle;
                const colorClass = categoryColors[app?.category] || "bg-muted text-foreground";
                return (
                  <Card key={conn.id} data-testid={`connected-integration-${conn.id}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${colorClass}`}>
                          <CatIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold" data-testid={`text-connected-name-${conn.id}`}>{app?.name || "Unknown"}</h4>
                          <div className="flex items-center gap-3 mt-0.5">
                            <Badge variant={conn.status === "active" ? "default" : "secondary"} className="text-xs" data-testid={`badge-status-${conn.id}`}>
                              {conn.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {conn.lastSyncAt ? `Last sync: ${new Date(conn.lastSyncAt).toLocaleString()}` : "Never synced"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Connected {new Date(conn.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncMutation.mutate(conn.id)}
                            disabled={syncMutation.isPending || conn.status !== "active"}
                            data-testid={`button-sync-${conn.id}`}
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                            Sync
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfigure(conn)}
                            data-testid={`button-configure-${conn.id}`}
                          >
                            <Settings2 className="w-3 h-3 mr-1" />
                            Configure
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => disconnectMutation.mutate(conn.id)}
                            disabled={disconnectMutation.isPending}
                            data-testid={`button-disconnect-${conn.id}`}
                          >
                            <Unplug className="w-3 h-3 mr-1" />
                            Disconnect
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {!logs?.length ? (
            <Card>
              <CardContent className="p-8 text-center space-y-3">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-semibold">No Activity Logs</h3>
                <p className="text-sm text-muted-foreground">Integration activity will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest integration sync and connection events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {logs.map((log: any) => (
                    <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" data-testid={`log-entry-${log.id}`}>
                      {log.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{log.message}</p>
                        <p className="text-xs text-muted-foreground">{log.actionType} · {new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs shrink-0">
                        {log.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!connectDialog} onOpenChange={(open) => { if (!open) { setConnectDialog(null); setCredentials({}); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plug className="w-5 h-5 text-primary" />
              Connect {connectDialog?.name}
            </DialogTitle>
          </DialogHeader>
          {connectDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{connectDialog.description}</p>
              <Separator />
              <div className="space-y-3">
                {((connectDialog.configSchema as any)?.fields as ConfigField[] || []).map(field => (
                  <div key={field.name}>
                    <Label className="text-sm">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      type={field.type === "password" ? "password" : "text"}
                      placeholder={field.placeholder}
                      value={credentials[field.name] || ""}
                      onChange={(e) => setCredentials(prev => ({ ...prev, [field.name]: e.target.value }))}
                      className="mt-1"
                      data-testid={`input-credential-${field.name}`}
                    />
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-md bg-muted/50 border">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Your credentials are stored securely and never exposed in API responses.
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleSubmitConnect}
                disabled={connectMutation.isPending}
                data-testid="button-submit-connect"
              >
                {connectMutation.isPending ? "Connecting..." : "Connect Integration"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!configDialog} onOpenChange={(open) => { if (!open) { setConfigDialog(null); setCredentials({}); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Configure {configDialog?.app?.name}
            </DialogTitle>
          </DialogHeader>
          {configDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={configDialog.status === "active" ? "default" : "secondary"}>
                  {configDialog.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Connected {new Date(configDialog.createdAt).toLocaleDateString()}
                </span>
              </div>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Update Credentials</h4>
                {((configDialog.app?.configSchema as any)?.fields as ConfigField[] || []).map((field: ConfigField) => (
                  <div key={field.name}>
                    <Label className="text-sm">{field.label}</Label>
                    <Input
                      type={field.type === "password" ? "password" : "text"}
                      placeholder="••••••••  (leave blank to keep current)"
                      value={credentials[field.name] || ""}
                      onChange={(e) => setCredentials(prev => ({ ...prev, [field.name]: e.target.value }))}
                      className="mt-1"
                      data-testid={`input-config-${field.name}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant={configDialog.status === "active" ? "outline" : "default"}
                  onClick={() => updateMutation.mutate({
                    id: configDialog.id,
                    data: {
                      status: configDialog.status === "active" ? "inactive" : "active",
                      ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
                    },
                  })}
                  disabled={updateMutation.isPending}
                  data-testid="button-toggle-status"
                >
                  {configDialog.status === "active" ? "Disable" : "Enable"}
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => updateMutation.mutate({
                    id: configDialog.id,
                    data: Object.keys(credentials).length > 0 ? { credentials } : {},
                  })}
                  disabled={updateMutation.isPending || Object.keys(credentials).length === 0}
                  data-testid="button-save-config"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
