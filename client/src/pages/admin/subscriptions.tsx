import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CreditCard,
  Search,
  Edit,
} from "lucide-react";
import type { CompanySubscription, SubscriptionPlan } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type SubWithNames = CompanySubscription & {
  companyName: string;
  planName: string;
};

export default function AdminSubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubWithNames | null>(null);
  const [editForm, setEditForm] = useState({
    planId: 0,
    status: "",
    billingCycle: "",
  });
  const { toast } = useToast();

  const { data: rawSubs, isLoading } = useQuery<SubWithNames[]>({
    queryKey: ["/api/admin/subscriptions"],
  });
  const subs = rawSubs ?? [];

  const { data: rawPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/plans"],
  });
  const plans = rawPlans ?? [];

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; body: Record<string, any> }) =>
      apiRequest("PATCH", `/api/admin/subscriptions/${data.id}`, data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditOpen(false);
      toast({ title: "Subscription updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update subscription", variant: "destructive" });
    },
  });

  function openEdit(sub: SubWithNames) {
    setEditingSub(sub);
    setEditForm({
      planId: sub.planId,
      status: sub.status,
      billingCycle: sub.billingCycle,
    });
    setEditOpen(true);
  }

  const filtered = subs.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (!search) return true;
    return s.companyName.toLowerCase().includes(search.toLowerCase()) || s.planName.toLowerCase().includes(search.toLowerCase());
  });

  const statusVariant = (status: string) => {
    switch (status) {
      case "active": return "default" as const;
      case "trial": return "secondary" as const;
      case "cancelled": return "destructive" as const;
      case "expired": return "destructive" as const;
      default: return "outline" as const;
    }
  };

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
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Subscription Management</h1>
        <p className="text-muted-foreground text-sm mt-1">{subs.length} total subscriptions</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by company or plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-subscriptions"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-subscription-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="text-lg font-semibold">No subscriptions found</h3>
          </div>
        ) : (
          filtered.map((sub) => (
            <Card key={sub.id} data-testid={`card-subscription-${sub.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-md bg-chart-3/10 shrink-0">
                      <CreditCard className="w-5 h-5 text-chart-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">{sub.companyName}</h3>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                        <span>Plan: <strong>{sub.planName}</strong></span>
                        <span>Cycle: <strong className="capitalize">{sub.billingCycle}</strong></span>
                        <span>Start: {new Date(sub.startDate).toLocaleDateString()}</span>
                        {sub.endDate && <span>End: {new Date(sub.endDate).toLocaleDateString()}</span>}
                        {sub.gateway && <span>Gateway: {sub.gateway}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={statusVariant(sub.status)} className="text-xs capitalize">
                      {sub.status}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(sub)}
                      data-testid={`button-edit-subscription-${sub.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditingSub(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subscription: {editingSub?.companyName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plan</Label>
              <Select
                value={String(editForm.planId)}
                onValueChange={(v) => setEditForm({ ...editForm, planId: Number(v) })}
              >
                <SelectTrigger data-testid="select-edit-sub-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger data-testid="select-edit-sub-status">
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
              <Select
                value={editForm.billingCycle}
                onValueChange={(v) => setEditForm({ ...editForm, billingCycle: v })}
              >
                <SelectTrigger data-testid="select-edit-sub-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => editingSub && updateMutation.mutate({ id: editingSub.id, body: editForm })}
              disabled={updateMutation.isPending}
              className="w-full"
              data-testid="button-save-subscription"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
