import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CreditCard,
  Check,
  X,
  Crown,
  Zap,
  Building2,
  Users,
  Target,
  Brain,
  Database,
  ArrowRight,
  Shield,
  AlertTriangle,
  Receipt,
  ChevronDown,
} from "lucide-react";
import type { SubscriptionPlan, CompanySubscription, PaymentTransaction, PlanFeatures, PlanLimits } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/hooks/use-toast";

type SubInfo = { subscription: CompanySubscription; plan: SubscriptionPlan } | null;
type UsageInfo = { usage: Record<string, number>; limits: PlanLimits; features: PlanFeatures };
type GatewayInfo = { stripe: { configured: boolean }; razorpay: { configured: boolean } };

const FEATURE_LABELS: Record<string, string> = {
  kanban_view: "Kanban View",
  calendar_view: "Calendar View",
  ai_scoring: "AI Lead Scoring",
  automation: "Automation Rules",
  api_access: "API Access",
  activity_timeline: "Activity Timeline",
  lead_detail: "Lead Detail Page",
  multi_view: "Multi-View System",
  custom_pipeline: "Custom Pipeline",
  export_data: "Data Export",
};

const LIMIT_LABELS: Record<string, { label: string; usageKey: string }> = {
  max_users: { label: "Team Members", usageKey: "users" },
  max_leads: { label: "Leads", usageKey: "leads" },
  max_contacts: { label: "Contacts", usageKey: "contacts" },
  max_deals: { label: "Deals", usageKey: "deals" },
  monthly_ai_usage: { label: "AI Usage / Month", usageKey: "ai_usage" },
  max_storage_mb: { label: "Storage (MB)", usageKey: "storage_mb" },
};

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const unlimited = max === -1;
  const pct = unlimited ? 5 : max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const isWarning = !unlimited && pct >= 80;
  const isDanger = !unlimited && pct >= 95;

  return (
    <div className="space-y-1.5" data-testid={`usage-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-xs font-mono ${isDanger ? "text-destructive" : isWarning ? "text-chart-4" : "text-muted-foreground"}`}>
          {current.toLocaleString()} / {unlimited ? "∞" : max.toLocaleString()}
        </span>
      </div>
      <Progress
        value={pct}
        className={`h-2 ${isDanger ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-chart-4" : ""}`}
      />
    </div>
  );
}

export default function BillingPage() {
  const { toast } = useToast();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [subscribeDialog, setSubscribeDialog] = useState<SubscriptionPlan | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<"stripe" | "razorpay">("stripe");

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/billing/plans"],
  });

  const { data: subInfo, isLoading: subLoading } = useQuery<SubInfo>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: usageInfo } = useQuery<UsageInfo>({
    queryKey: ["/api/billing/usage"],
  });

  const { data: transactions } = useQuery<PaymentTransaction[]>({
    queryKey: ["/api/billing/transactions"],
  });

  const { data: gateways } = useQuery<GatewayInfo>({
    queryKey: ["/api/billing/gateways"],
  });

  const subscribeMutation = useMutation({
    mutationFn: (data: { planId: number; billingCycle: string; gateway: string }) =>
      apiRequest("POST", "/api/billing/subscribe", data),
    onSuccess: async (response: any) => {
      const data = await response.json();
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
        queryClient.invalidateQueries({ queryKey: ["/api/billing/usage"] });
        setSubscribeDialog(null);
        toast({ title: "Plan updated", description: data.message || "Your subscription has been updated." });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to process subscription", variant: "destructive" });
    },
  });

  const [prorataInfo, setProrataInfo] = useState<{ unusedCredit: number; proratedCharge: number; netAmount: number; daysRemaining: number } | null>(null);

  const changePlanMutation = useMutation({
    mutationFn: (data: { planId: number; billingCycle?: string }) =>
      apiRequest("POST", "/api/billing/change-plan", data),
    onSuccess: async (response: any) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/usage"] });
      if (data.prorata && (data.prorata.unusedCredit > 0 || data.prorata.proratedCharge > 0)) {
        setProrataInfo(data.prorata);
      }
      toast({
        title: "Plan changed",
        description: data.prorata && data.prorata.netAmount !== 0
          ? `${data.message} — Pro-rata adjustment: $${Math.abs(data.prorata.netAmount).toFixed(2)} ${data.prorata.netAmount > 0 ? "due" : "credit"}`
          : data.message || "Your plan has been updated.",
        variant: data.warnings?.length > 0 ? "destructive" : "default",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/billing/cancel"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      toast({ title: "Subscription cancelled", description: "Your subscription will be cancelled at the end of the billing period." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const currentPlan = subInfo?.plan;
  const subscription = subInfo?.subscription;
  const usage = usageInfo?.usage || {};
  const limits = usageInfo?.limits || {};
  const features = usageInfo?.features || {};
  const allPlans = plans ?? [];
  const allTransactions = transactions ?? [];
  const stripeConfigured = gateways?.stripe?.configured || false;
  const razorpayConfigured = gateways?.razorpay?.configured || false;
  const anyGatewayConfigured = stripeConfigured || razorpayConfigured;

  function handleSelectPlan(plan: SubscriptionPlan) {
    const price = billingCycle === "yearly" ? Number(plan.priceYearly) : Number(plan.priceMonthly);
    if (price <= 0) {
      changePlanMutation.mutate({ planId: plan.id, billingCycle });
      return;
    }

    if (currentPlan && plan.id !== currentPlan.id) {
      const isUpgrade = (plan.sortOrder || 0) > (currentPlan.sortOrder || 0);
      if (isUpgrade && !anyGatewayConfigured) {
        setSubscribeDialog(plan);
        return;
      }
      if (subscription?.status === "active" && subscription.gateway) {
        changePlanMutation.mutate({ planId: plan.id, billingCycle });
        return;
      }
    }

    setSubscribeDialog(plan);
  }

  function handleSubscribe() {
    if (!subscribeDialog) return;
    subscribeMutation.mutate({
      planId: subscribeDialog.id,
      billingCycle,
      gateway: selectedGateway,
    });
  }

  if (plansLoading || subLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Billing & Subscription</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your subscription, plan features, and payment history</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-chart-4" />
                <h3 className="text-sm font-semibold">Current Plan</h3>
              </div>
              {subscription && (
                <Badge
                  variant={subscription.status === "active" ? "default" : subscription.status === "trial" ? "secondary" : "destructive"}
                  className="capitalize"
                  data-testid="badge-subscription-status"
                >
                  {subscription.status}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentPlan ? (
              <>
                <div>
                  <h2 className="text-xl font-bold" data-testid="text-current-plan">{currentPlan.name}</h2>
                  <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold" data-testid="text-plan-price">
                    ${subscription?.billingCycle === "yearly" ? Number(currentPlan.priceYearly).toLocaleString() : Number(currentPlan.priceMonthly).toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">/{subscription?.billingCycle || "month"}</span>
                </div>
                {subscription?.endDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Label className="text-muted-foreground">
                      {subscription.status === "trial" ? "Trial ends:" : "Renews:"}
                    </Label>
                    <span data-testid="text-renewal-date">{new Date(subscription.endDate).toLocaleDateString()}</span>
                  </div>
                )}
                {subscription?.cancelAtPeriodEnd && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs">Cancels at end of billing period</span>
                  </div>
                )}
                {subscription && subscription.status !== "cancelled" && !subscription.cancelAtPeriodEnd && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive" data-testid="button-cancel-subscription">
                        Cancel Subscription
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your subscription will remain active until the end of the current billing period. Your data will not be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancelMutation.mutate()} data-testid="button-confirm-cancel">
                          {cancelMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active subscription</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold">Usage Overview</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(LIMIT_LABELS).map(([key, { label, usageKey }]) => {
              const max = (limits as any)[key];
              if (max === undefined) return null;
              return (
                <UsageBar key={key} label={label} current={usage[usageKey] || 0} max={max} />
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-lg font-semibold">Available Plans</h3>
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <Button
              variant={billingCycle === "monthly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBillingCycle("monthly")}
              data-testid="button-billing-monthly"
            >
              Monthly
            </Button>
            <Button
              variant={billingCycle === "yearly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBillingCycle("yearly")}
              data-testid="button-billing-yearly"
            >
              Yearly
              <Badge variant="secondary" className="ml-1.5 text-xs">Save 17%</Badge>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {allPlans.map((plan) => {
            const isCurrent = currentPlan?.id === plan.id;
            const price = billingCycle === "yearly" ? Number(plan.priceYearly) : Number(plan.priceMonthly);
            const planFeatures = (plan.features || {}) as PlanFeatures;
            const planLimits = (plan.limits || {}) as PlanLimits;
            const isPopular = plan.name === "Professional";

            return (
              <Card
                key={plan.id}
                className={`relative ${isCurrent ? "ring-2 ring-primary" : ""} ${isPopular ? "border-primary" : ""}`}
                data-testid={`card-plan-${plan.id}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                <CardContent className="p-5 space-y-4">
                  <div>
                    <h4 className="text-lg font-bold">{plan.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${price.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">/{billingCycle === "yearly" ? "yr" : "mo"}</span>
                  </div>

                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : isPopular ? "default" : "outline"}
                    disabled={isCurrent || changePlanMutation.isPending}
                    onClick={() => handleSelectPlan(plan)}
                    data-testid={`button-select-plan-${plan.id}`}
                  >
                    {isCurrent ? "Current Plan" : currentPlan && (plan.sortOrder || 0) > (currentPlan.sortOrder || 0) ? "Upgrade" : "Select"}
                  </Button>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Limits</p>
                    {Object.entries(LIMIT_LABELS).map(([key, { label }]) => {
                      const val = (planLimits as any)[key];
                      if (val === undefined) return null;
                      return (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span>{label}</span>
                          <span className="font-medium">{val === -1 ? "Unlimited" : val.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Features</p>
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                      const enabled = (planFeatures as any)[key];
                      return (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          {enabled ? (
                            <Check className="w-3.5 h-3.5 text-chart-2 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className={enabled ? "" : "text-muted-foreground"}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold">Feature Access</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                const enabled = (features as any)?.[key];
                return (
                  <div key={key} className="flex items-center gap-2 p-2 rounded-md bg-muted/50" data-testid={`feature-${key}`}>
                    {enabled ? (
                      <Check className="w-4 h-4 text-chart-2 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={`text-sm ${enabled ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold">Payment History</h3>
            </div>
          </CardHeader>
          <CardContent>
            {allTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No payment history yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50" data-testid={`transaction-${tx.id}`}>
                    <div>
                      <p className="text-sm font-medium">${Number(tx.amount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()} · {tx.gateway}
                      </p>
                    </div>
                    <Badge variant={tx.status === "completed" ? "default" : tx.status === "pending" ? "secondary" : "destructive"} className="capitalize text-xs">
                      {tx.status}
                    </Badge>
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
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold">Payment Gateways</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`flex items-center justify-between p-3 rounded-lg border ${stripeConfigured ? "border-chart-2/30 bg-chart-2/5" : "border-border"}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#635BFF]/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-[#635BFF]" />
                </div>
                <div>
                  <p className="text-sm font-medium">Stripe</p>
                  <p className="text-xs text-muted-foreground">Credit card payments</p>
                </div>
              </div>
              <Badge variant={stripeConfigured ? "default" : "secondary"} className="text-xs" data-testid="badge-stripe-status">
                {stripeConfigured ? "Connected" : "Not configured"}
              </Badge>
            </div>
            <div className={`flex items-center justify-between p-3 rounded-lg border ${razorpayConfigured ? "border-chart-2/30 bg-chart-2/5" : "border-border"}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0C2451]/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#0C2451]" />
                </div>
                <div>
                  <p className="text-sm font-medium">Razorpay</p>
                  <p className="text-xs text-muted-foreground">UPI, cards, net banking</p>
                </div>
              </div>
              <Badge variant={razorpayConfigured ? "default" : "secondary"} className="text-xs" data-testid="badge-razorpay-status">
                {razorpayConfigured ? "Connected" : "Not configured"}
              </Badge>
            </div>
          </div>
          {!anyGatewayConfigured && (
            <div className="mt-3 p-3 rounded-md bg-chart-4/10 text-chart-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p className="text-xs">
                  No payment gateways configured. Add STRIPE_SECRET_KEY or RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET as environment secrets to enable payments.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!subscribeDialog} onOpenChange={(open) => { if (!open) setSubscribeDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-chart-4" />
              Subscribe to {subscribeDialog?.name} Plan
            </DialogTitle>
          </DialogHeader>
          {subscribeDialog && (
            <div className="space-y-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  ${billingCycle === "yearly"
                    ? Number(subscribeDialog.priceYearly).toLocaleString()
                    : Number(subscribeDialog.priceMonthly).toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">/{billingCycle === "yearly" ? "yr" : "mo"}</span>
              </div>

              <div>
                <Label className="text-sm">Billing Cycle</Label>
                <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as "monthly" | "yearly")}>
                  <SelectTrigger className="mt-1" data-testid="select-billing-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly (${Number(subscribeDialog.priceMonthly).toLocaleString()}/mo)</SelectItem>
                    <SelectItem value="yearly">Yearly (${Number(subscribeDialog.priceYearly).toLocaleString()}/yr — Save 17%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Payment Gateway</Label>
                <Select value={selectedGateway} onValueChange={(v) => setSelectedGateway(v as "stripe" | "razorpay")}>
                  <SelectTrigger className="mt-1" data-testid="select-gateway">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe" disabled={!stripeConfigured}>
                      Stripe {!stripeConfigured ? "(Not configured)" : ""}
                    </SelectItem>
                    <SelectItem value="razorpay" disabled={!razorpayConfigured}>
                      Razorpay {!razorpayConfigured ? "(Not configured)" : ""}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!anyGatewayConfigured && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <p className="text-xs">
                      No payment gateways are configured. Add API keys as environment secrets to enable payments.
                    </p>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                disabled={subscribeMutation.isPending || !anyGatewayConfigured}
                onClick={handleSubscribe}
                data-testid="button-confirm-subscribe"
              >
                {subscribeMutation.isPending ? "Processing..." : "Subscribe Now"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!prorataInfo} onOpenChange={(open) => { if (!open) setProrataInfo(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Pro-Rata Adjustment
            </DialogTitle>
          </DialogHeader>
          {prorataInfo && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your billing has been adjusted based on {prorataInfo.daysRemaining} remaining days in your current cycle.
              </p>
              <div className="space-y-2 bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unused credit (old plan)</span>
                  <span className="font-medium text-green-600">-${prorataInfo.unusedCredit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">New plan charge (pro-rated)</span>
                  <span className="font-medium">${prorataInfo.proratedCharge.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>{prorataInfo.netAmount >= 0 ? "Amount due" : "Credit balance"}</span>
                  <span className={prorataInfo.netAmount >= 0 ? "text-foreground" : "text-green-600"}>
                    ${Math.abs(prorataInfo.netAmount).toFixed(2)}
                  </span>
                </div>
              </div>
              <Button className="w-full" onClick={() => setProrataInfo(null)} data-testid="button-close-prorata">
                Got it
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
