import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  CreditCard, Bell, Mail, MessageSquare, Phone, Settings2, Shield, Send, Trash2,
  Plus, Globe, Loader2, CheckCircle, AlertTriangle, Smartphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PlanLimits, SubscriptionPlan } from "@shared/schema";

type PlatformSetting = {
  id: number;
  settingKey: string;
  settingValue: string;
  category: string;
  label: string | null;
  isSecret: boolean;
};

type NotificationChannel = {
  id: number;
  channel: string;
  label: string;
  enabled: boolean;
  provider: string | null;
  config: Record<string, any> | null;
};

type SystemNotification = {
  id: number;
  title: string;
  message: string;
  type: string;
  targetAudience: string;
  targetCompanyId: number | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
};

type CompanyEmailSetting = {
  id: number;
  companyId: number;
  enabled: boolean;
  smtpHost: string | null;
  emailsSentThisMonth: number;
};

const TABS = [
  { key: "payment", label: "Payment Gateways", icon: CreditCard },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "email", label: "System Email", icon: Mail },
  { key: "system-notifs", label: "System Alerts", icon: AlertTriangle },
  { key: "client-email", label: "Client Email", icon: Send },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminConfigPage() {
  const [tab, setTab] = useState<TabKey>("payment");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="admin-config-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-config-title">
          <Settings2 className="w-6 h-6" />
          Configuration Center
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage platform integrations, notifications, and client settings</p>
      </div>

      <div className="flex gap-2 flex-wrap border-b pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              tab === t.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${t.key}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "payment" && <PaymentGatewaysTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "email" && <SystemEmailTab />}
      {tab === "system-notifs" && <SystemNotificationsTab />}
      {tab === "client-email" && <ClientEmailTab />}
    </div>
  );
}

function PaymentGatewaysTab() {
  const { toast } = useToast();
  const { data: settings = [], isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/config/settings", "payment_gateway"],
    queryFn: async () => {
      const res = await fetch("/api/admin/config/settings?category=payment_gateway");
      if (!res.ok) throw new Error("Failed to fetch payment settings");
      return res.json();
    },
  });

  const [values, setValues] = useState<Record<string, string>>({});

  const getVal = (key: string) => values[key] ?? settings.find(s => s.settingKey === key)?.settingValue ?? "";

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(values).map(([settingKey, settingValue]) => ({ settingKey, settingValue }));
      if (entries.length === 0) return;
      await apiRequest("PUT", "/api/admin/config/settings", { settings: entries });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Payment gateway settings updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config/settings"] });
      setValues({});
    },
    onError: () => toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" }),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Stripe</h3>
              <p className="text-xs text-muted-foreground">Accept payments via Stripe</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Switch
                checked={getVal("stripe_enabled") === "true"}
                onCheckedChange={(v) => setValues({ ...values, stripe_enabled: v ? "true" : "false" })}
                data-testid="switch-stripe-enabled"
              />
              <Badge variant={getVal("stripe_enabled") === "true" ? "default" : "secondary"}>
                {getVal("stripe_enabled") === "true" ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingField label="Mode" value={getVal("stripe_mode")}
              onChange={(v) => setValues({ ...values, stripe_mode: v })}
              type="select" options={["test", "live"]} testId="select-stripe-mode" />
            <SettingField label="Publishable Key" value={getVal("stripe_publishable_key")}
              onChange={(v) => setValues({ ...values, stripe_publishable_key: v })}
              placeholder="pk_test_..." testId="input-stripe-pk" />
            <SettingField label="Secret Key" value={getVal("stripe_secret_key")}
              onChange={(v) => setValues({ ...values, stripe_secret_key: v })}
              placeholder="sk_test_..." isSecret testId="input-stripe-sk" />
            <SettingField label="Webhook Secret" value={getVal("stripe_webhook_secret")}
              onChange={(v) => setValues({ ...values, stripe_webhook_secret: v })}
              placeholder="whsec_..." isSecret testId="input-stripe-wh" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Razorpay</h3>
              <p className="text-xs text-muted-foreground">Accept payments via Razorpay</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Switch
                checked={getVal("razorpay_enabled") === "true"}
                onCheckedChange={(v) => setValues({ ...values, razorpay_enabled: v ? "true" : "false" })}
                data-testid="switch-razorpay-enabled"
              />
              <Badge variant={getVal("razorpay_enabled") === "true" ? "default" : "secondary"}>
                {getVal("razorpay_enabled") === "true" ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingField label="Mode" value={getVal("razorpay_mode")}
              onChange={(v) => setValues({ ...values, razorpay_mode: v })}
              type="select" options={["test", "live"]} testId="select-razorpay-mode" />
            <SettingField label="Key ID" value={getVal("razorpay_key_id")}
              onChange={(v) => setValues({ ...values, razorpay_key_id: v })}
              placeholder="rzp_test_..." testId="input-razorpay-kid" />
            <SettingField label="Key Secret" value={getVal("razorpay_key_secret")}
              onChange={(v) => setValues({ ...values, razorpay_key_secret: v })}
              placeholder="Secret key..." isSecret testId="input-razorpay-ks" />
            <SettingField label="Webhook Secret" value={getVal("razorpay_webhook_secret")}
              onChange={(v) => setValues({ ...values, razorpay_webhook_secret: v })}
              placeholder="Webhook secret..." isSecret testId="input-razorpay-wh" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || Object.keys(values).length === 0}
          data-testid="button-save-payment">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Payment Settings
        </Button>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { toast } = useToast();
  const { data: channels = [], isLoading } = useQuery<NotificationChannel[]>({
    queryKey: ["/api/admin/config/notifications"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ channel, data }: { channel: string; data: Partial<NotificationChannel> }) => {
      await apiRequest("PUT", `/api/admin/config/notifications/${channel}`, data);
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Notification channel updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config/notifications"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update.", variant: "destructive" }),
  });

  if (isLoading) return <LoadingState />;

  const channelIcons: Record<string, typeof Mail> = {
    email: Mail, sms: Phone, whatsapp: MessageSquare, push: Smartphone,
  };

  const smsProviders = ["twilio", "nexmo", "messagebird", "plivo", "sns"];
  const whatsappProviders = ["whatsapp_business", "twilio_whatsapp", "360dialog"];

  return (
    <div className="space-y-4">
      {channels.map((ch) => {
        const Icon = channelIcons[ch.channel] || Bell;
        return (
          <Card key={ch.channel}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">{ch.label}</h3>
                  <p className="text-xs text-muted-foreground">{ch.provider || "No provider configured"}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Switch
                    checked={ch.enabled}
                    onCheckedChange={(enabled) => updateMutation.mutate({ channel: ch.channel, data: { ...ch, enabled } })}
                    data-testid={`switch-${ch.channel}-enabled`}
                  />
                  <Badge variant={ch.enabled ? "default" : "secondary"}>
                    {ch.enabled ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            {ch.channel === "sms" && (
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Provider</Label>
                    <Select value={ch.provider || ""} onValueChange={(v) => updateMutation.mutate({ channel: ch.channel, data: { ...ch, provider: v } })}>
                      <SelectTrigger data-testid="select-sms-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
                      <SelectContent>
                        {smsProviders.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Sender ID</Label>
                    <Input placeholder="OrbitCRM" value={(ch.config as any)?.senderId || ""} onChange={(e) =>
                      updateMutation.mutate({ channel: ch.channel, data: { ...ch, config: { ...ch.config, senderId: e.target.value } } })
                    } data-testid="input-sms-sender" />
                  </div>
                </div>
              </CardContent>
            )}
            {ch.channel === "whatsapp" && (
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Provider</Label>
                    <Select value={ch.provider || ""} onValueChange={(v) => updateMutation.mutate({ channel: ch.channel, data: { ...ch, provider: v } })}>
                      <SelectTrigger data-testid="select-whatsapp-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
                      <SelectContent>
                        {whatsappProviders.map(p => <SelectItem key={p} value={p}>{p.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Webhook URL</Label>
                    <Input placeholder="https://..." value={(ch.config as any)?.webhookUrl || ""} onChange={(e) =>
                      updateMutation.mutate({ channel: ch.channel, data: { ...ch, config: { ...ch.config, webhookUrl: e.target.value } } })
                    } data-testid="input-whatsapp-webhook" />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function SystemEmailTab() {
  const { toast } = useToast();
  const { data: settings = [], isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/config/settings", "email"],
    queryFn: async () => {
      const res = await fetch("/api/admin/config/settings?category=email");
      if (!res.ok) throw new Error("Failed to fetch email settings");
      return res.json();
    },
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const getVal = (key: string) => values[key] ?? settings.find(s => s.settingKey === key)?.settingValue ?? "";

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(values).map(([settingKey, settingValue]) => ({ settingKey, settingValue }));
      if (entries.length === 0) return;
      await apiRequest("PUT", "/api/admin/config/settings", { settings: entries });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "System email settings updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config/settings"] });
      setValues({});
    },
    onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold">System Email (SMTP)</h3>
              <p className="text-xs text-muted-foreground">Used for system emails — password resets, notifications, alerts</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingField label="SMTP Host" value={getVal("system_smtp_host")}
              onChange={(v) => setValues({ ...values, system_smtp_host: v })}
              placeholder="smtp.gmail.com" testId="input-sys-smtp-host" />
            <SettingField label="SMTP Port" value={getVal("system_smtp_port")}
              onChange={(v) => setValues({ ...values, system_smtp_port: v })}
              placeholder="587" testId="input-sys-smtp-port" />
            <SettingField label="Username" value={getVal("system_smtp_username")}
              onChange={(v) => setValues({ ...values, system_smtp_username: v })}
              placeholder="noreply@orbitcrm.com" testId="input-sys-smtp-user" />
            <SettingField label="Password" value={getVal("system_smtp_password")}
              onChange={(v) => setValues({ ...values, system_smtp_password: v })}
              placeholder="App password" isSecret testId="input-sys-smtp-pass" />
            <SettingField label="From Address" value={getVal("system_smtp_from_address")}
              onChange={(v) => setValues({ ...values, system_smtp_from_address: v })}
              placeholder="noreply@orbitcrm.com" testId="input-sys-smtp-from" />
            <SettingField label="From Name" value={getVal("system_smtp_from_name")}
              onChange={(v) => setValues({ ...values, system_smtp_from_name: v })}
              placeholder="Orbit CRM" testId="input-sys-smtp-name" />
            <SettingField label="Encryption" value={getVal("system_smtp_encryption")}
              onChange={(v) => setValues({ ...values, system_smtp_encryption: v })}
              type="select" options={["none", "tls", "ssl"]} testId="select-sys-smtp-enc" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || Object.keys(values).length === 0}
          data-testid="button-save-email">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Email Settings
        </Button>
      </div>
    </div>
  );
}

function SystemNotificationsTab() {
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", type: "info", targetAudience: "all", targetCompanyId: "", expiresAt: "" });

  const { data: notifs = [], isLoading } = useQuery<SystemNotification[]>({
    queryKey: ["/api/admin/config/system-notifications"],
  });

  const { data: companiesList = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/admin/tenants"],
    select: (data: any[]) => data.map((c: any) => ({ id: c.id, name: c.name })),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/config/system-notifications", {
        ...form,
        targetCompanyId: form.targetCompanyId ? parseInt(form.targetCompanyId) : null,
        expiresAt: form.expiresAt || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Created", description: "System notification created." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config/system-notifications"] });
      setForm({ title: "", message: "", type: "info", targetAudience: "all", targetCompanyId: "", expiresAt: "" });
      setNewOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to create notification.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/config/system-notifications/${id}`); },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Notification removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config/system-notifications"] });
    },
  });

  if (isLoading) return <LoadingState />;

  const typeColors: Record<string, string> = {
    info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    maintenance: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">System-Wide Notifications</h3>
          <p className="text-xs text-muted-foreground">Send announcements, maintenance alerts, or notices to all tenants</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-notification"><Plus className="w-4 h-4 mr-1" /> New Notification</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create System Notification</DialogTitle>
              <DialogDescription>Send an announcement or alert to tenants</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Scheduled Maintenance" data-testid="input-notif-title" />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="We will be performing maintenance..." data-testid="input-notif-message" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger data-testid="select-notif-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["info", "warning", "success", "error", "maintenance"].map(t => (
                        <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Audience</Label>
                  <Select value={form.targetAudience} onValueChange={(v) => setForm({ ...form, targetAudience: v })}>
                    <SelectTrigger data-testid="select-notif-audience"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tenants</SelectItem>
                      <SelectItem value="specific">Specific Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.targetAudience === "specific" && (
                <div>
                  <Label>Target Company</Label>
                  <Select value={form.targetCompanyId} onValueChange={(v) => setForm({ ...form, targetCompanyId: v })}>
                    <SelectTrigger data-testid="select-notif-company"><SelectValue placeholder="Select company" /></SelectTrigger>
                    <SelectContent>
                      {companiesList.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Expires At (optional)</Label>
                <Input type="datetime-local" value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} data-testid="input-notif-expires" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.title || !form.message}
                data-testid="button-create-notification">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {notifs.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No system notifications yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {notifs.map((n) => (
            <Card key={n.id}>
              <CardContent className="py-4 flex items-start gap-3">
                <div className={`px-2 py-1 rounded text-xs font-medium ${typeColors[n.type] || typeColors.info}`}>
                  {n.type}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold">{n.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{n.targetAudience === "all" ? "All tenants" : `Company #${n.targetCompanyId}`}</span>
                    <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                    {n.expiresAt && <span>Expires: {new Date(n.expiresAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(n.id)}
                  data-testid={`button-delete-notif-${n.id}`}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientEmailTab() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ plans: SubscriptionPlan[]; emailSettings: CompanyEmailSetting[]; companies: { id: number; name: string }[] }>({
    queryKey: ["/api/admin/config/email-limits"],
  });

  if (isLoading) return <LoadingState />;

  const plans = data?.plans || [];
  const emailSettings = data?.emailSettings || [];
  const companiesList = data?.companies || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" /> Email Limits by Plan
          </h3>
          <p className="text-xs text-muted-foreground">Monthly email sending limits per subscription plan (configured in Plan settings)</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const limits = (plan.limits as PlanLimits) || {};
              return (
                <div key={plan.id} className="p-4 rounded-lg border bg-card text-center" data-testid={`email-limit-plan-${plan.id}`}>
                  <p className="text-sm font-semibold">{plan.name}</p>
                  <p className="text-2xl font-bold mt-1 text-primary">
                    {limits.monthly_emails === -1 ? "Unlimited" : (limits.monthly_emails ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">emails/month</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Send className="w-4 h-4" /> Client Email Usage
          </h3>
          <p className="text-xs text-muted-foreground">Current email usage and SMTP setup status per company</p>
        </CardHeader>
        <CardContent>
          {companiesList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No active companies</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Company</th>
                    <th className="text-center py-2 px-3 font-semibold text-muted-foreground">SMTP Setup</th>
                    <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Emails Sent</th>
                    <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companiesList.map((c) => {
                    const es = emailSettings.find(e => e.companyId === c.id);
                    return (
                      <tr key={c.id} className="border-b">
                        <td className="py-2 px-3 font-medium">{c.name}</td>
                        <td className="py-2 px-3 text-center">
                          {es?.enabled ? (
                            <Badge variant="default" className="text-xs"><CheckCircle className="w-3 h-3 mr-1" /> Configured</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Not Setup</Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-medium">{es?.emailsSentThisMonth ?? 0}</td>
                        <td className="py-2 px-3 text-center">
                          <CompanyEmailDialog companyId={c.id} companyName={c.name} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyEmailDialog({ companyId, companyName }: { companyId: number; companyName: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [localForm, setLocalForm] = useState({
    enabled: false, smtpHost: "", smtpPort: 587, smtpUsername: "", smtpPassword: "",
    fromAddress: "", fromName: "", encryption: "tls",
  });

  const { data: companyEmail, isLoading: emailLoading } = useQuery({
    queryKey: ["/api/admin/config/company-email", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/config/company-email/${companyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (companyEmail) {
      setLocalForm({
        enabled: companyEmail.enabled ?? false,
        smtpHost: companyEmail.smtpHost || "",
        smtpPort: companyEmail.smtpPort || 587,
        smtpUsername: companyEmail.smtpUsername || "",
        smtpPassword: "",
        fromAddress: companyEmail.fromAddress || "",
        fromName: companyEmail.fromName || "",
        encryption: companyEmail.encryption || "tls",
      });
    } else if (companyEmail === null) {
      setLocalForm({ enabled: false, smtpHost: "", smtpPort: 587, smtpUsername: "", smtpPassword: "", fromAddress: "", fromName: "", encryption: "tls" });
    }
  }, [companyEmail]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/admin/config/company-email/${companyId}`, localForm);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Client email settings updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config/company-email", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config/email-limits"] });
      setOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-edit-email-${companyId}`}>
          <Settings2 className="w-3 h-3 mr-1" /> Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Email Settings — {companyName}</DialogTitle>
          <DialogDescription>Configure SMTP settings for this company</DialogDescription>
        </DialogHeader>
        {emailLoading ? (
          <LoadingState />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch checked={localForm.enabled} onCheckedChange={(v) => setLocalForm({ ...localForm, enabled: v })}
                data-testid="switch-company-email-enabled" />
              <Label>Enable Custom SMTP</Label>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">SMTP Host</Label>
                <Input value={localForm.smtpHost} onChange={(e) => setLocalForm({ ...localForm, smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com" data-testid="input-company-smtp-host" />
              </div>
              <div>
                <Label className="text-xs">Port</Label>
                <Input type="number" value={localForm.smtpPort} onChange={(e) => setLocalForm({ ...localForm, smtpPort: parseInt(e.target.value) || 587 })}
                  data-testid="input-company-smtp-port" />
              </div>
              <div>
                <Label className="text-xs">Username</Label>
                <Input value={localForm.smtpUsername} onChange={(e) => setLocalForm({ ...localForm, smtpUsername: e.target.value })}
                  placeholder="user@domain.com" data-testid="input-company-smtp-user" />
              </div>
              <div>
                <Label className="text-xs">Password</Label>
                <Input type="password" value={localForm.smtpPassword} onChange={(e) => setLocalForm({ ...localForm, smtpPassword: e.target.value })}
                  placeholder={companyEmail?.smtpPassword ? "••••••••" : "App password"} data-testid="input-company-smtp-pass" />
              </div>
              <div>
                <Label className="text-xs">From Address</Label>
                <Input value={localForm.fromAddress} onChange={(e) => setLocalForm({ ...localForm, fromAddress: e.target.value })}
                  placeholder="noreply@company.com" data-testid="input-company-from-addr" />
              </div>
              <div>
                <Label className="text-xs">From Name</Label>
                <Input value={localForm.fromName} onChange={(e) => setLocalForm({ ...localForm, fromName: e.target.value })}
                  placeholder="Company Name" data-testid="input-company-from-name" />
              </div>
              <div>
                <Label className="text-xs">Encryption</Label>
                <Select value={localForm.encryption} onValueChange={(v) => setLocalForm({ ...localForm, encryption: v })}>
                  <SelectTrigger data-testid="select-company-encryption"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="tls">TLS</SelectItem>
                    <SelectItem value="ssl">SSL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                data-testid="button-save-company-email">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Save
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingField({ label, value, onChange, placeholder, isSecret, type = "text", options, testId }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  isSecret?: boolean; type?: "text" | "select"; options?: string[]; testId?: string;
}) {
  if (type === "select" && options) {
    return (
      <div>
        <Label className="text-xs">{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger data-testid={testId}><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map(o => <SelectItem key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={isSecret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Loading...</span>
    </div>
  );
}
