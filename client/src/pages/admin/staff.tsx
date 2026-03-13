import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Users,
  Search,
  Shield,
  Building2,
  UserPlus,
} from "lucide-react";
import type { Company, SubscriptionPlan } from "@shared/schema";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type TenantBasic = Company & { userCount: number; planName: string; subscriptionStatus: string };

type TenantDetail = {
  company: Company;
  users: Array<{ id: number; username: string; email: string; fullName: string; role: string; isActive: boolean; permissions: Record<string, boolean> | null; createdAt: string }>;
  subscription: any;
  plan: SubscriptionPlan | null;
  usage: Record<string, number>;
};

const PERMISSION_LIST = [
  { key: "manage_leads", label: "Leads" },
  { key: "manage_contacts", label: "Contacts" },
  { key: "manage_deals", label: "Deals" },
  { key: "manage_tasks", label: "Tasks" },
  { key: "view_reports", label: "Reports" },
  { key: "manage_automation", label: "Automation" },
  { key: "manage_whatsapp", label: "WhatsApp" },
  { key: "manage_ai", label: "AI" },
  { key: "manage_settings", label: "Settings" },
  { key: "manage_billing", label: "Billing" },
];

export default function AdminStaffPage() {
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({
    username: "", password: "", email: "", fullName: "", role: "sales_executive",
    permissions: {} as Record<string, boolean>,
  });
  const { toast } = useToast();

  const { data: rawTenants, isLoading } = useQuery<TenantBasic[]>({ queryKey: ["/api/admin/tenants"] });
  const tenants = rawTenants ?? [];

  const { data: tenantDetail } = useQuery<TenantDetail>({
    queryKey: ["/api/admin/tenants", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  const staffMutation = useMutation({
    mutationFn: (data: { companyId: number; body: typeof staffForm }) =>
      apiRequest("POST", `/api/admin/tenants/${data.companyId}/staff`, data.body),
    onSuccess: () => {
      if (selectedCompanyId) queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setAddStaffOpen(false);
      setStaffForm({ username: "", password: "", email: "", fullName: "", role: "sales_executive", permissions: {} });
      toast({ title: "Staff member created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create staff", variant: "destructive" });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: (data: { companyId: number; userId: number; body: Record<string, any> }) =>
      apiRequest("PATCH", `/api/admin/tenants/${data.companyId}/staff/${data.userId}`, data.body),
    onSuccess: () => {
      if (selectedCompanyId) queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", selectedCompanyId] });
      toast({ title: "Staff updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update staff", variant: "destructive" });
    },
  });

  const filteredTenants = tenants.filter((t) => {
    if (!search) return true;
    return t.name.toLowerCase().includes(search.toLowerCase());
  });

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Staff Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage admin staff and permissions across all tenants</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-staff"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">Companies</h3>
          {filteredTenants.map((t) => (
            <Card
              key={t.id}
              className={`cursor-pointer transition-colors ${selectedCompanyId === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              onClick={() => setSelectedCompanyId(t.id)}
              data-testid={`card-staff-company-${t.id}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.userCount} staff members</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!selectedCompanyId ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold">Select a Company</h3>
              <p className="text-sm text-muted-foreground mt-1">Choose a company to view and manage its staff members</p>
            </div>
          ) : tenantDetail ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Staff for {tenantDetail.company.name} ({tenantDetail.users.length})
                </h3>
                <Button
                  size="sm"
                  onClick={() => {
                    setStaffForm({ username: "", password: "", email: "", fullName: "", role: "sales_executive", permissions: {} });
                    setAddStaffOpen(true);
                  }}
                  data-testid="button-add-staff"
                >
                  <UserPlus className="w-4 h-4 mr-1" /> Add Staff
                </Button>
              </div>
              {tenantDetail.users.map((u) => (
                <Card key={u.id} data-testid={`card-staff-member-${u.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-sm">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.email} • @{u.username}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={u.role}
                          onValueChange={(v) =>
                            selectedCompanyId && updateStaffMutation.mutate({
                              companyId: selectedCompanyId,
                              userId: u.id,
                              body: { role: v },
                            })
                          }
                        >
                          <SelectTrigger className="w-[150px] h-8 text-xs" data-testid={`select-role-${u.id}`}>
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
                            selectedCompanyId && updateStaffMutation.mutate({
                              companyId: selectedCompanyId,
                              userId: u.id,
                              body: { isActive: !u.isActive },
                            })
                          }
                          data-testid={`button-toggle-${u.id}`}
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PERMISSION_LIST.map((perm) => {
                        const currentPerms = u.permissions || {};
                        const isGranted = currentPerms[perm.key] !== false;
                        return (
                          <Badge
                            key={perm.key}
                            variant={isGranted ? "default" : "outline"}
                            className={`text-xs cursor-pointer select-none ${isGranted ? "" : "opacity-50"}`}
                            onClick={() => {
                              if (!selectedCompanyId) return;
                              updateStaffMutation.mutate({
                                companyId: selectedCompanyId,
                                userId: u.id,
                                body: { permissions: { ...currentPerms, [perm.key]: !isGranted } },
                              });
                            }}
                            data-testid={`perm-${perm.key}-${u.id}`}
                          >
                            {perm.label}
                          </Badge>
                        );
                      })}
                    </div>
                    {!u.isActive && (
                      <Badge variant="destructive" className="text-xs mt-2">Account Inactive</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          )}
        </div>
      </div>

      {/* Add Staff Dialog */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Full Name *</Label>
                <Input
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  data-testid="input-new-staff-fullname"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email *</Label>
                <Input
                  type="email"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  data-testid="input-new-staff-email"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Username *</Label>
                <Input
                  value={staffForm.username}
                  onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                  data-testid="input-new-staff-username"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Password *</Label>
                <Input
                  type="password"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  data-testid="input-new-staff-password"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={staffForm.role} onValueChange={(v) => setStaffForm({ ...staffForm, role: v })}>
                <SelectTrigger data-testid="select-new-staff-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company_admin">Company Admin</SelectItem>
                  <SelectItem value="sales_manager">Sales Manager</SelectItem>
                  <SelectItem value="sales_executive">Sales Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
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
                      data-testid={`new-perm-${perm.key}`}
                    >
                      {perm.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => selectedCompanyId && staffMutation.mutate({ companyId: selectedCompanyId, body: staffForm })}
              disabled={staffMutation.isPending || !staffForm.username || !staffForm.password || !staffForm.email || !staffForm.fullName}
              data-testid="button-submit-new-staff"
            >
              {staffMutation.isPending ? "Creating..." : "Create Staff Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
