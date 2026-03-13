import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Building2,
  Search,
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  Edit,
  Eye,
  Users,
  Plus,
  ArrowUpDown,
  UserPlus,
  Shield,
} from "lucide-react";
import type { Company, CompanySubscription, SubscriptionPlan } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Tenant = Company & {
  userCount: number;
  planName: string;
  subscriptionStatus: string;
  subscription: CompanySubscription | null;
};

type TenantDetail = {
  company: Company;
  users: Array<{ id: number; username: string; email: string; fullName: string; role: string; isActive: boolean; permissions: Record<string, boolean> | null; createdAt: string }>;
  subscription: CompanySubscription | null;
  plan: SubscriptionPlan | null;
  usage: Record<string, number>;
};

const PERMISSION_LIST = [
  { key: "manage_leads", label: "Manage Leads" },
  { key: "manage_contacts", label: "Manage Contacts" },
  { key: "manage_deals", label: "Manage Deals" },
  { key: "manage_tasks", label: "Manage Tasks" },
  { key: "view_reports", label: "View Reports" },
  { key: "manage_automation", label: "Manage Automation" },
  { key: "manage_whatsapp", label: "WhatsApp" },
  { key: "manage_ai", label: "AI Insights" },
  { key: "manage_settings", label: "Manage Settings" },
  { key: "manage_billing", label: "Manage Billing" },
];

export default function AdminTenantsPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", subdomain: "", industry: "", website: "", phone: "", address: "", primaryColor: "" });
  const [createForm, setCreateForm] = useState({
    name: "", slug: "", industry: "", website: "", phone: "", address: "",
    planId: 0, adminUsername: "", adminPassword: "", adminEmail: "", adminFullName: "",
  });
  const [staffForm, setStaffForm] = useState({
    username: "", password: "", email: "", fullName: "", role: "sales_executive",
    permissions: {} as Record<string, boolean>,
  });
  const [planForm, setPlanForm] = useState({ planId: 0, status: "", billingCycle: "" });
  const { toast } = useToast();

  const { data: rawTenants, isLoading } = useQuery<Tenant[]>({ queryKey: ["/api/admin/tenants"] });
  const tenants = rawTenants ?? [];

  const { data: rawArchived, isLoading: archivedLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants/archived"],
    enabled: activeTab === "archived",
  });
  const archivedTenants = rawArchived ?? [];

  const { data: rawPlans } = useQuery<SubscriptionPlan[]>({ queryKey: ["/api/admin/plans"] });
  const plans = (rawPlans ?? []).filter((p) => p.isActive);

  const { data: tenantDetail, isLoading: detailLoading } = useQuery<TenantDetail>({
    queryKey: ["/api/admin/tenants", selectedTenant?.id],
    enabled: !!selectedTenant && (detailOpen || staffOpen),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => apiRequest("POST", "/api/admin/tenants", data),
    onSuccess: () => {
      invalidateAll();
      setCreateOpen(false);
      resetCreateForm();
      toast({ title: "Tenant created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create tenant", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; body: Record<string, string> }) =>
      apiRequest("PATCH", `/api/admin/tenants/${data.id}`, data.body),
    onSuccess: () => {
      invalidateAll();
      setEditOpen(false);
      toast({ title: "Tenant updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update tenant", variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/tenants/${id}/archive`),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants/archived"] });
      toast({ title: "Tenant archived" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive tenant", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/tenants/${id}/restore`),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants/archived"] });
      toast({ title: "Tenant restored" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to restore tenant", variant: "destructive" });
    },
  });

  const planChangeMutation = useMutation({
    mutationFn: (data: { id: number; body: Record<string, any> }) =>
      apiRequest("PATCH", `/api/admin/tenants/${data.id}/subscription`, data.body),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      if (selectedTenant) queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", selectedTenant.id] });
      setPlanChangeOpen(false);
      toast({ title: "Subscription updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update subscription", variant: "destructive" });
    },
  });

  const staffMutation = useMutation({
    mutationFn: (data: { companyId: number; body: typeof staffForm }) =>
      apiRequest("POST", `/api/admin/tenants/${data.companyId}/staff`, data.body),
    onSuccess: () => {
      if (selectedTenant) queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", selectedTenant.id] });
      invalidateAll();
      resetStaffForm();
      toast({ title: "Staff member created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create staff member", variant: "destructive" });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: (data: { companyId: number; userId: number; body: Record<string, any> }) =>
      apiRequest("PATCH", `/api/admin/tenants/${data.companyId}/staff/${data.userId}`, data.body),
    onSuccess: () => {
      if (selectedTenant) queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", selectedTenant.id] });
      toast({ title: "Staff member updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update staff", variant: "destructive" });
    },
  });

  function resetCreateForm() {
    setCreateForm({ name: "", slug: "", industry: "", website: "", phone: "", address: "", planId: 0, adminUsername: "", adminPassword: "", adminEmail: "", adminFullName: "" });
  }

  function resetStaffForm() {
    setStaffForm({ username: "", password: "", email: "", fullName: "", role: "sales_executive", permissions: {} });
  }

  function openEdit(tenant: Tenant) {
    setSelectedTenant(tenant);
    setEditForm({
      name: tenant.name,
      slug: tenant.slug,
      subdomain: tenant.subdomain || "",
      industry: tenant.industry || "",
      website: tenant.website || "",
      phone: tenant.phone || "",
      address: tenant.address || "",
      primaryColor: tenant.primaryColor || "#1565C0",
    });
    setEditOpen(true);
  }

  function openDetail(tenant: Tenant) {
    setSelectedTenant(tenant);
    setDetailOpen(true);
  }

  function openStaff(tenant: Tenant) {
    setSelectedTenant(tenant);
    resetStaffForm();
    setStaffOpen(true);
  }

  function openPlanChange(tenant: Tenant) {
    setSelectedTenant(tenant);
    setPlanForm({
      planId: tenant.subscription?.planId || 0,
      status: tenant.subscription?.status || "trial",
      billingCycle: tenant.subscription?.billingCycle || "monthly",
    });
    setPlanChangeOpen(true);
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  const filteredActive = tenants.filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.name.toLowerCase().includes(s) || (t.industry || "").toLowerCase().includes(s);
  });

  const filteredArchived = archivedTenants.filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.name.toLowerCase().includes(s) || (t.industry || "").toLowerCase().includes(s);
  });

  function TenantCard({ tenant, archived = false }: { tenant: Tenant; archived?: boolean }) {
    return (
      <Card data-testid={`card-tenant-${tenant.id}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold truncate">{tenant.name}</h3>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">{tenant.industry || "No industry"}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" /> {tenant.userCount} users
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {archived && tenant.archivedAt
                      ? `Archived ${new Date(tenant.archivedAt).toLocaleDateString()}`
                      : `Created ${new Date(tenant.createdAt).toLocaleDateString()}`}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">{tenant.planName}</Badge>
              <Badge
                variant={tenant.subscriptionStatus === "active" ? "default" : tenant.subscriptionStatus === "trial" ? "secondary" : "destructive"}
                className="text-xs capitalize"
              >
                {tenant.subscriptionStatus}
              </Badge>

              {archived ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restoreMutation.mutate(tenant.id)}
                  disabled={restoreMutation.isPending}
                  data-testid={`button-restore-tenant-${tenant.id}`}
                >
                  <ArchiveRestore className="w-4 h-4 mr-1" /> Restore
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" data-testid={`button-tenant-menu-${tenant.id}`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openDetail(tenant)} data-testid={`button-view-tenant-${tenant.id}`}>
                      <Eye className="w-4 h-4 mr-2" /> View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEdit(tenant)} data-testid={`button-edit-tenant-${tenant.id}`}>
                      <Edit className="w-4 h-4 mr-2" /> Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openPlanChange(tenant)} data-testid={`button-plan-tenant-${tenant.id}`}>
                      <ArrowUpDown className="w-4 h-4 mr-2" /> Change Plan
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openStaff(tenant)} data-testid={`button-staff-tenant-${tenant.id}`}>
                      <UserPlus className="w-4 h-4 mr-2" /> Manage Staff
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="text-orange-600"
                          onSelect={(e) => e.preventDefault()}
                          data-testid={`button-archive-tenant-${tenant.id}`}
                        >
                          <Archive className="w-4 h-4 mr-2" /> Archive
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive Tenant</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will archive "{tenant.name}". The company and all its data will be preserved but inaccessible to its users. You can restore it anytime from the Archived tab.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => archiveMutation.mutate(tenant.id)}
                            className="bg-orange-600 text-white hover:bg-orange-700"
                            data-testid={`button-confirm-archive-tenant-${tenant.id}`}
                          >
                            Archive Tenant
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Tenant Management</h1>
          <p className="text-muted-foreground text-sm mt-1">{tenants.length} active companies</p>
        </div>
        <Button onClick={() => { resetCreateForm(); setCreateOpen(true); }} data-testid="button-add-tenant">
          <Plus className="w-4 h-4 mr-2" /> Add Tenant
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-tenants"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-tenants">
            Active ({tenants.length})
          </TabsTrigger>
          <TabsTrigger value="archived" data-testid="tab-archived-tenants">
            <Archive className="w-3.5 h-3.5 mr-1" /> Archived ({archivedTenants.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-2 mt-4">
          {filteredActive.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold">No tenants found</h3>
              <p className="text-sm text-muted-foreground mt-1">Create your first tenant to get started</p>
            </div>
          ) : (
            filteredActive.map((tenant) => <TenantCard key={tenant.id} tenant={tenant} />)
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-2 mt-4">
          {archivedLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filteredArchived.length === 0 ? (
            <div className="text-center py-16">
              <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold">No archived tenants</h3>
              <p className="text-sm text-muted-foreground mt-1">Archived tenants will appear here</p>
            </div>
          ) : (
            filteredArchived.map((tenant) => <TenantCard key={tenant.id} tenant={tenant} archived />)
          )}
        </TabsContent>
      </Tabs>

      {/* Create Tenant Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Company Name *</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value, slug: autoSlug(e.target.value) })}
                  placeholder="Acme Corp"
                  data-testid="input-create-tenant-name"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Slug *</Label>
                <Input
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                  placeholder="acme-corp"
                  data-testid="input-create-tenant-slug"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Industry</Label>
                <Input
                  value={createForm.industry}
                  onChange={(e) => setCreateForm({ ...createForm, industry: e.target.value })}
                  placeholder="Technology"
                  data-testid="input-create-tenant-industry"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Website</Label>
                <Input
                  value={createForm.website}
                  onChange={(e) => setCreateForm({ ...createForm, website: e.target.value })}
                  data-testid="input-create-tenant-website"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  data-testid="input-create-tenant-phone"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  data-testid="input-create-tenant-address"
                />
              </div>
            </div>

            <div className="border-t pt-3">
              <Label className="text-sm font-semibold">Subscription Plan *</Label>
              <p className="text-xs text-muted-foreground mb-2">A plan must be selected to create a tenant</p>
              <Select
                value={createForm.planId ? String(createForm.planId) : ""}
                onValueChange={(v) => setCreateForm({ ...createForm, planId: Number(v) })}
              >
                <SelectTrigger data-testid="select-create-tenant-plan">
                  <SelectValue placeholder="Select a plan..." />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} — ${p.priceMonthly}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-3">
              <Label className="text-sm font-semibold">Admin Account *</Label>
              <p className="text-xs text-muted-foreground mb-2">This creates the company admin who will manage the CRM</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Full Name *</Label>
                  <Input
                    value={createForm.adminFullName}
                    onChange={(e) => setCreateForm({ ...createForm, adminFullName: e.target.value })}
                    placeholder="John Smith"
                    data-testid="input-create-admin-name"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email *</Label>
                  <Input
                    type="email"
                    value={createForm.adminEmail}
                    onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                    placeholder="admin@acme.com"
                    data-testid="input-create-admin-email"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Username *</Label>
                  <Input
                    value={createForm.adminUsername}
                    onChange={(e) => setCreateForm({ ...createForm, adminUsername: e.target.value })}
                    placeholder="acme_admin"
                    data-testid="input-create-admin-username"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Password *</Label>
                  <Input
                    type="password"
                    value={createForm.adminPassword}
                    onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                    placeholder="Min 6 characters"
                    data-testid="input-create-admin-password"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={createMutation.isPending || !createForm.name || !createForm.slug || !createForm.planId || !createForm.adminUsername || !createForm.adminPassword || !createForm.adminEmail || !createForm.adminFullName}
              className="w-full"
              data-testid="button-create-tenant-submit"
            >
              {createMutation.isPending ? "Creating..." : "Create Tenant"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Tenant Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Company Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  data-testid="input-edit-tenant-name"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Slug</Label>
                <Input
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  data-testid="input-edit-tenant-slug"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Subdomain</Label>
                <Input
                  value={editForm.subdomain}
                  onChange={(e) => setEditForm({ ...editForm, subdomain: e.target.value })}
                  placeholder="e.g. acme"
                  data-testid="input-edit-tenant-subdomain"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Industry</Label>
                <Input
                  value={editForm.industry}
                  onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                  data-testid="input-edit-tenant-industry"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={editForm.primaryColor}
                    onChange={(e) => setEditForm({ ...editForm, primaryColor: e.target.value })}
                    className="w-12 h-9 p-1 cursor-pointer"
                    data-testid="input-edit-tenant-color"
                  />
                  <Input
                    value={editForm.primaryColor}
                    onChange={(e) => setEditForm({ ...editForm, primaryColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Website</Label>
                <Input
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  data-testid="input-edit-tenant-website"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  data-testid="input-edit-tenant-phone"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  data-testid="input-edit-tenant-address"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => selectedTenant && updateMutation.mutate({ id: selectedTenant.id, body: editForm })}
                disabled={updateMutation.isPending}
                data-testid="button-save-tenant"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={planChangeOpen} onOpenChange={setPlanChangeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <ArrowUpDown className="w-5 h-5 inline mr-2" />
              Change Plan: {selectedTenant?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plan</Label>
              <Select value={String(planForm.planId)} onValueChange={(v) => setPlanForm({ ...planForm, planId: Number(v) })}>
                <SelectTrigger data-testid="select-change-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} — ${p.priceMonthly}/mo | ${p.priceYearly}/yr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={planForm.status} onValueChange={(v) => setPlanForm({ ...planForm, status: v })}>
                <SelectTrigger data-testid="select-change-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Billing Cycle</Label>
              <Select value={planForm.billingCycle} onValueChange={(v) => setPlanForm({ ...planForm, billingCycle: v })}>
                <SelectTrigger data-testid="select-change-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => selectedTenant && planChangeMutation.mutate({ id: selectedTenant.id, body: planForm })}
              disabled={planChangeMutation.isPending}
              className="w-full"
              data-testid="button-save-plan-change"
            >
              {planChangeMutation.isPending ? "Updating..." : "Update Subscription"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tenant Details: {selectedTenant?.name}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : tenantDetail ? (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <h4 className="text-sm font-semibold">Company Info</h4>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground text-xs">Name</span><p className="font-medium">{tenantDetail.company.name}</p></div>
                  <div><span className="text-muted-foreground text-xs">Slug</span><p className="font-medium">{tenantDetail.company.slug}</p></div>
                  <div><span className="text-muted-foreground text-xs">Industry</span><p className="font-medium">{tenantDetail.company.industry || "N/A"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Subdomain</span><p className="font-medium">{tenantDetail.company.subdomain || "N/A"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Website</span><p className="font-medium">{tenantDetail.company.website || "N/A"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Phone</span><p className="font-medium">{tenantDetail.company.phone || "N/A"}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground text-xs">Address</span><p className="font-medium">{tenantDetail.company.address || "N/A"}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <h4 className="text-sm font-semibold">Subscription</h4>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground text-xs">Plan</span><p className="font-medium">{tenantDetail.plan?.name || "None"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Status</span><Badge className="capitalize">{tenantDetail.subscription?.status || "none"}</Badge></div>
                  <div><span className="text-muted-foreground text-xs">Billing Cycle</span><p className="font-medium capitalize">{tenantDetail.subscription?.billingCycle || "N/A"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Start Date</span><p className="font-medium">{tenantDetail.subscription?.startDate ? new Date(tenantDetail.subscription.startDate).toLocaleDateString() : "N/A"}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <h4 className="text-sm font-semibold">Usage</h4>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 text-sm">
                  {Object.entries(tenantDetail.usage).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-muted-foreground text-xs capitalize">{key.replace(/_/g, " ")}</span>
                      <p className="font-medium">{val}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Staff Members ({tenantDetail.users.length})</h4>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {tenantDetail.users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                        <div>
                          <p className="font-medium">{u.fullName}</p>
                          <p className="text-xs text-muted-foreground">{u.email} • @{u.username}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs capitalize">{u.role.replace(/_/g, " ")}</Badge>
                          {!u.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Manage Staff Dialog */}
      <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Shield className="w-5 h-5 inline mr-2" />
              Manage Staff: {selectedTenant?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Existing staff */}
            {tenantDetail && tenantDetail.users.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <h4 className="text-sm font-semibold">Current Staff ({tenantDetail.users.length})</h4>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tenantDetail.users.map((u) => (
                    <div key={u.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">{u.fullName}</p>
                          <p className="text-xs text-muted-foreground">{u.email} • @{u.username}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={u.role}
                            onValueChange={(v) =>
                              selectedTenant && updateStaffMutation.mutate({
                                companyId: selectedTenant.id,
                                userId: u.id,
                                body: { role: v },
                              })
                            }
                          >
                            <SelectTrigger className="w-[150px] h-8 text-xs" data-testid={`select-staff-role-${u.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="company_admin">Company Admin</SelectItem>
                              <SelectItem value="sales_manager">Sales Manager</SelectItem>
                              <SelectItem value="sales_executive">Sales Executive</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant={u.isActive ? "outline" : "default"}
                            className="h-8 text-xs"
                            onClick={() =>
                              selectedTenant && updateStaffMutation.mutate({
                                companyId: selectedTenant.id,
                                userId: u.id,
                                body: { isActive: !u.isActive },
                              })
                            }
                            data-testid={`button-toggle-staff-${u.id}`}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {PERMISSION_LIST.map((perm) => {
                          const currentPerms = u.permissions || {};
                          const isGranted = currentPerms[perm.key] !== false;
                          return (
                            <Badge
                              key={perm.key}
                              variant={isGranted ? "default" : "outline"}
                              className={`text-xs cursor-pointer select-none ${isGranted ? "" : "opacity-50"}`}
                              onClick={() => {
                                if (!selectedTenant) return;
                                const newPerms = { ...currentPerms, [perm.key]: !isGranted };
                                updateStaffMutation.mutate({
                                  companyId: selectedTenant.id,
                                  userId: u.id,
                                  body: { permissions: newPerms },
                                });
                              }}
                              data-testid={`badge-perm-${perm.key}-${u.id}`}
                            >
                              {perm.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Add new staff */}
            <Card>
              <CardHeader className="pb-2">
                <h4 className="text-sm font-semibold">
                  <UserPlus className="w-4 h-4 inline mr-1" /> Add New Staff Member
                </h4>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Full Name *</Label>
                    <Input
                      value={staffForm.fullName}
                      onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                      placeholder="Jane Smith"
                      data-testid="input-staff-fullname"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email *</Label>
                    <Input
                      type="email"
                      value={staffForm.email}
                      onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                      placeholder="jane@company.com"
                      data-testid="input-staff-email"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Username *</Label>
                    <Input
                      value={staffForm.username}
                      onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                      placeholder="jane_smith"
                      data-testid="input-staff-username"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Password *</Label>
                    <Input
                      type="password"
                      value={staffForm.password}
                      onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                      placeholder="Min 6 characters"
                      data-testid="input-staff-password"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <Select value={staffForm.role} onValueChange={(v) => setStaffForm({ ...staffForm, role: v })}>
                      <SelectTrigger data-testid="select-staff-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company_admin">Company Admin</SelectItem>
                        <SelectItem value="sales_manager">Sales Manager</SelectItem>
                        <SelectItem value="sales_executive">Sales Executive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground mb-2 block">Permissions</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {PERMISSION_LIST.map((perm) => {
                        const isOn = staffForm.permissions[perm.key] === true;
                        return (
                          <Badge
                            key={perm.key}
                            variant={isOn ? "default" : "outline"}
                            className={`text-xs cursor-pointer select-none ${isOn ? "" : "opacity-50"}`}
                            onClick={() => {
                              setStaffForm({
                                ...staffForm,
                                permissions: { ...staffForm.permissions, [perm.key]: !isOn },
                              });
                            }}
                            data-testid={`badge-new-perm-${perm.key}`}
                          >
                            {perm.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  onClick={() =>
                    selectedTenant && staffMutation.mutate({ companyId: selectedTenant.id, body: staffForm })
                  }
                  disabled={staffMutation.isPending || !staffForm.username || !staffForm.password || !staffForm.email || !staffForm.fullName}
                  data-testid="button-create-staff"
                >
                  {staffMutation.isPending ? "Creating..." : "Create Staff Member"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
