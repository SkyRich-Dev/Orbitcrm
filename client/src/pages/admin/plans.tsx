import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Package,
  MoreHorizontal,
  Trash2,
  Edit,
  Check,
  X,
} from "lucide-react";
import type { SubscriptionPlan, PlanFeatures, PlanLimits } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const FEATURE_KEYS: Array<{ key: keyof PlanFeatures; label: string }> = [
  { key: "kanban_view", label: "Kanban View" },
  { key: "calendar_view", label: "Calendar View" },
  { key: "ai_scoring", label: "AI Lead Scoring" },
  { key: "automation", label: "Automation Rules" },
  { key: "api_access", label: "API Access" },
  { key: "activity_timeline", label: "Activity Timeline" },
  { key: "lead_detail", label: "Lead Detail Page" },
  { key: "multi_view", label: "Multi-View System" },
  { key: "custom_pipeline", label: "Custom Pipeline" },
  { key: "export_data", label: "Data Export" },
];

const LIMIT_KEYS: Array<{ key: keyof PlanLimits; label: string }> = [
  { key: "max_users", label: "Max Users" },
  { key: "max_leads", label: "Max Leads" },
  { key: "max_contacts", label: "Max Contacts" },
  { key: "max_deals", label: "Max Deals" },
  { key: "max_storage_mb", label: "Max Storage (MB)" },
  { key: "monthly_ai_usage", label: "Monthly AI Usage" },
];

type PlanForm = {
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  sortOrder: number;
  isActive: boolean;
  features: PlanFeatures;
  limits: PlanLimits;
};

const emptyForm: PlanForm = {
  name: "",
  description: "",
  priceMonthly: "0",
  priceYearly: "0",
  sortOrder: 0,
  isActive: true,
  features: {},
  limits: {},
};

export default function AdminPlansPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const { toast } = useToast();

  const { data: rawPlans, isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/plans"],
  });
  const plans = rawPlans ?? [];

  const createMutation = useMutation({
    mutationFn: (data: PlanForm) => apiRequest("POST", "/api/admin/plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setFormOpen(false);
      toast({ title: "Plan created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create plan", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; body: PlanForm }) =>
      apiRequest("PATCH", `/api/admin/plans/${data.id}`, data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setFormOpen(false);
      setEditingPlan(null);
      toast({ title: "Plan updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update plan", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Plan deactivated" });
    },
  });

  function openCreate() {
    setEditingPlan(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description || "",
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      sortOrder: plan.sortOrder,
      isActive: plan.isActive,
      features: (plan.features as PlanFeatures) || {},
      limits: (plan.limits as PlanLimits) || {},
    });
    setFormOpen(true);
  }

  function handleSubmit() {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, body: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function updateFeature(key: keyof PlanFeatures, val: boolean) {
    setForm({ ...form, features: { ...form.features, [key]: val } });
  }

  function updateLimit(key: keyof PlanLimits, val: string) {
    setForm({ ...form, limits: { ...form.limits, [key]: Number(val) || 0 } });
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Plan Management</h1>
          <p className="text-muted-foreground text-sm mt-1">{plans.length} subscription plans</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-plan">
          <Plus className="w-4 h-4 mr-2" /> Create Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.sort((a, b) => a.sortOrder - b.sortOrder).map((plan) => {
          const features = (plan.features as PlanFeatures) || {};
          const limits = (plan.limits as PlanLimits) || {};
          const enabledCount = Object.values(features).filter(Boolean).length;
          return (
            <Card key={plan.id} className={!plan.isActive ? "opacity-60" : ""} data-testid={`card-plan-${plan.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    <h3 className="text-base font-semibold">{plan.name}</h3>
                    {!plan.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-plan-menu-${plan.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(plan)} data-testid={`button-edit-plan-${plan.id}`}>
                        <Edit className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(plan.id)}
                        data-testid={`button-delete-plan-${plan.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Deactivate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.description && (
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                )}
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold">${plan.priceMonthly}</span>
                  <span className="text-xs text-muted-foreground">/month</span>
                  <span className="text-sm text-muted-foreground">or ${plan.priceYearly}/year</span>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {FEATURE_KEYS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-1">
                      {features[key] ? (
                        <Check className="w-3 h-3 text-chart-2" />
                      ) : (
                        <X className="w-3 h-3 text-muted-foreground" />
                      )}
                      <span className={features[key] ? "" : "text-muted-foreground"}>{label}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {LIMIT_KEYS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono font-medium">
                        {limits[key] === -1 ? "∞" : (limits[key] ?? 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  Sort order: {plan.sortOrder} &middot; {enabledCount} features enabled
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditingPlan(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create New Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plan Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Professional"
                data-testid="input-plan-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Plan description..."
                data-testid="input-plan-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Monthly Price ($)</Label>
                <Input
                  type="number"
                  value={form.priceMonthly}
                  onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
                  data-testid="input-plan-price-monthly"
                />
              </div>
              <div>
                <Label>Yearly Price ($)</Label>
                <Input
                  type="number"
                  value={form.priceYearly}
                  onChange={(e) => setForm({ ...form, priceYearly: e.target.value })}
                  data-testid="input-plan-price-yearly"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                  data-testid="input-plan-sort-order"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  data-testid="switch-plan-active"
                />
                <Label>Active</Label>
              </div>
            </div>

            <Separator />
            <h4 className="text-sm font-semibold">Features</h4>
            <div className="grid grid-cols-2 gap-3">
              {FEATURE_KEYS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-1">
                  <Label className="text-xs">{label}</Label>
                  <Switch
                    checked={form.features[key] || false}
                    onCheckedChange={(v) => updateFeature(key, v)}
                    data-testid={`switch-feature-${key}`}
                  />
                </div>
              ))}
            </div>

            <Separator />
            <h4 className="text-sm font-semibold">Limits <span className="text-xs text-muted-foreground font-normal">(-1 = unlimited)</span></h4>
            <div className="grid grid-cols-2 gap-3">
              {LIMIT_KEYS.map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    value={form.limits[key] ?? 0}
                    onChange={(e) => updateLimit(key, e.target.value)}
                    data-testid={`input-limit-${key}`}
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isPending || !form.name}
              className="w-full"
              data-testid="button-submit-plan"
            >
              {isPending ? "Saving..." : editingPlan ? "Save Changes" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
