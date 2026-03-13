import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Palette, Building2, Shield, Brain, Zap, Pencil, Blocks, Package, Lock, CheckCircle2, Globe, Paintbrush, Home, Check, X, Loader2 } from "lucide-react";
import type { Company, PipelineStage, AiSettings, BrandingSettings, HomepageSettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { useCompanyFeatures } from "@/hooks/use-feature-access";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const { data: company, isLoading: companyLoading } = useQuery<Company>({
    queryKey: ["/api/company"],
  });

  const { data: rawStages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });
  const stages = rawStages ?? [];

  const { modules, featureLimits, usage, isLoading: featuresLoading } = useCompanyFeatures();

  const { data: rawAiSettings, isLoading: aiLoading } = useQuery<AiSettings>({
    queryKey: ["/api/ai/settings"],
  });
  const aiSettings = rawAiSettings ?? null;

  const [editingCompany, setEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    industry: "",
    website: "",
    phone: "",
    address: "",
  });

  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const [editingBranding, setEditingBranding] = useState(false);
  const [brandingForm, setBrandingForm] = useState<BrandingSettings>({});

  const [editingHomepage, setEditingHomepage] = useState(false);
  const [homepageForm, setHomepageForm] = useState<HomepageSettings>({});

  const [subdomainInput, setSubdomainInput] = useState("");
  const [subdomainChecking, setSubdomainChecking] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [subdomainError, setSubdomainError] = useState("");

  useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name || "",
        industry: company.industry || "",
        website: company.website || "",
        phone: company.phone || "",
        address: company.address || "",
      });
      setBrandingForm(company.brandingSettings || {});
      setHomepageForm(company.homepageSettings || {});
      setSubdomainInput(company.subdomain || "");
    }
  }, [company]);

  const updateCompanyMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiRequest("PATCH", "/api/company", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({ title: "Company settings updated" });
      setEditingCompany(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update company settings", variant: "destructive" });
    },
  });

  const updateBrandingMutation = useMutation({
    mutationFn: (data: BrandingSettings) =>
      apiRequest("PATCH", "/api/company/branding", { brandingSettings: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({ title: "Branding updated" });
      setEditingBranding(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update branding", variant: "destructive" });
    },
  });

  const updateHomepageMutation = useMutation({
    mutationFn: (data: HomepageSettings) =>
      apiRequest("PATCH", "/api/company/homepage", { homepageSettings: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({ title: "Homepage settings updated" });
      setEditingHomepage(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update homepage settings", variant: "destructive" });
    },
  });

  const setSubdomainMutation = useMutation({
    mutationFn: (subdomain: string) =>
      apiRequest("POST", "/api/company/subdomain", { subdomain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({ title: "Subdomain updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to set subdomain", variant: "destructive" });
    },
  });

  const checkSubdomain = useCallback(async (val: string) => {
    if (!val || val.length < 3) {
      setSubdomainAvailable(null);
      setSubdomainError(val.length > 0 ? "Minimum 3 characters" : "");
      return;
    }
    setSubdomainChecking(true);
    setSubdomainError("");
    try {
      const res = await fetch(`/api/domain/check?subdomain=${encodeURIComponent(val)}`);
      const data = await res.json();
      setSubdomainAvailable(data.available);
      if (!data.available && data.reason) setSubdomainError(data.reason);
    } catch {
      setSubdomainError("Failed to check availability");
    } finally {
      setSubdomainChecking(false);
    }
  }, []);

  const updateAiMutation = useMutation({
    mutationFn: (data: Partial<AiSettings>) =>
      apiRequest("PUT", "/api/ai/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/settings"] });
      toast({ title: "AI settings updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update AI settings", variant: "destructive" });
    },
  });

  function toggleAiSetting(key: string, current: boolean) {
    if (!aiSettings) return;
    updateAiMutation.mutate({ ...aiSettings, [key]: !current });
  }

  const usagePercent = aiSettings
    ? Math.round((aiSettings.usageCount / aiSettings.monthlyUsageLimit) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your CRM configuration</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Appearance</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-1">
            <div>
              <Label className="text-sm font-medium">Dark Mode</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle between light and dark theme</p>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={toggleTheme}
              data-testid="switch-dark-mode"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">AI Configuration</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : aiSettings ? (
            <>
              <div className="flex items-center justify-between gap-1">
                <div>
                  <Label className="text-sm font-medium">Enable AI Engine</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Master toggle for all AI features</p>
                </div>
                <Switch
                  checked={aiSettings.enableAi}
                  onCheckedChange={() => toggleAiSetting("enableAi", aiSettings.enableAi)}
                  data-testid="switch-enable-ai"
                />
              </div>

              {aiSettings.enableAi && (
                <>
                  <div className="border-t pt-3 space-y-3">
                    <div className="flex items-center justify-between gap-1">
                      <div>
                        <Label className="text-sm font-medium">AI Lead Scoring</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Automatically score and prioritize leads</p>
                      </div>
                      <Switch
                        checked={aiSettings.enableLeadScoring}
                        onCheckedChange={() => toggleAiSetting("enableLeadScoring", aiSettings.enableLeadScoring)}
                        data-testid="switch-lead-scoring"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <div>
                        <Label className="text-sm font-medium">AI Sales Prediction</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Predict deal close probability and forecast revenue</p>
                      </div>
                      <Switch
                        checked={aiSettings.enableSalesPrediction}
                        onCheckedChange={() => toggleAiSetting("enableSalesPrediction", aiSettings.enableSalesPrediction)}
                        data-testid="switch-sales-prediction"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <div>
                        <Label className="text-sm font-medium">AI Task Automation</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Auto-generate tasks based on activity patterns</p>
                      </div>
                      <Switch
                        checked={aiSettings.enableTaskAutomation}
                        onCheckedChange={() => toggleAiSetting("enableTaskAutomation", aiSettings.enableTaskAutomation)}
                        data-testid="switch-task-automation"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <div>
                        <Label className="text-sm font-medium">AI Insights</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Generate smart business insights and alerts</p>
                      </div>
                      <Switch
                        checked={aiSettings.enableInsights}
                        onCheckedChange={() => toggleAiSetting("enableInsights", aiSettings.enableInsights)}
                        data-testid="switch-insights"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">AI Usage</Label>
                      <span className="text-xs text-muted-foreground">
                        {aiSettings.usageCount} / {aiSettings.monthlyUsageLimit} this month
                      </span>
                    </div>
                    <Progress value={usagePercent} className="h-2" data-testid="progress-ai-usage" />
                    {usagePercent > 80 && (
                      <p className="text-xs text-destructive mt-1">
                        <Zap className="w-3 h-3 inline mr-1" />
                        Approaching monthly AI usage limit
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">AI settings not available</p>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Domain & Subdomain</h3>
              </div>
              <Badge variant="secondary" className="text-xs" data-testid="badge-domain-status">
                {company?.domainStatus || "pending"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Custom Subdomain</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={subdomainInput}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                    setSubdomainInput(val);
                    setSubdomainAvailable(null);
                    setSubdomainError("");
                  }}
                  placeholder="your-company"
                  className="flex-1"
                  data-testid="input-subdomain"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => checkSubdomain(subdomainInput)}
                  disabled={subdomainChecking || !subdomainInput}
                  data-testid="button-check-subdomain"
                >
                  {subdomainChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Check"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-subdomain-preview">
                {subdomainInput}.crm.skyrichorbit.com
              </p>
              {subdomainAvailable === true && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1" data-testid="text-subdomain-available">
                  <Check className="w-3 h-3" /> Available
                </p>
              )}
              {subdomainAvailable === false && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1" data-testid="text-subdomain-taken">
                  <X className="w-3 h-3" /> {subdomainError || "Not available"}
                </p>
              )}
            </div>
            <Button
              onClick={() => setSubdomainMutation.mutate(subdomainInput)}
              disabled={setSubdomainMutation.isPending || subdomainAvailable === false || !subdomainInput}
              size="sm"
              data-testid="button-save-subdomain"
            >
              {setSubdomainMutation.isPending ? "Saving..." : "Save Subdomain"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Branding</h3>
              </div>
              {!editingBranding && (
                <Button size="sm" variant="ghost" onClick={() => setEditingBranding(true)} data-testid="button-edit-branding">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingBranding ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Logo URL</Label>
                  <Input
                    value={brandingForm.logo || ""}
                    onChange={(e) => setBrandingForm({ ...brandingForm, logo: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    data-testid="input-branding-logo"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Favicon URL</Label>
                  <Input
                    value={brandingForm.favicon || ""}
                    onChange={(e) => setBrandingForm({ ...brandingForm, favicon: e.target.value })}
                    placeholder="https://example.com/favicon.ico"
                    data-testid="input-branding-favicon"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandingForm.primaryColor || "#1565C0"}
                        onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border"
                        data-testid="input-branding-primary-color"
                      />
                      <Input
                        value={brandingForm.primaryColor || ""}
                        onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })}
                        placeholder="#1565C0"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Secondary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandingForm.secondaryColor || "#111827"}
                        onChange={(e) => setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border"
                        data-testid="input-branding-secondary-color"
                      />
                      <Input
                        value={brandingForm.secondaryColor || ""}
                        onChange={(e) => setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })}
                        placeholder="#111827"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sidebar Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandingForm.sidebarColor || "#ffffff"}
                        onChange={(e) => setBrandingForm({ ...brandingForm, sidebarColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border"
                        data-testid="input-branding-sidebar-color"
                      />
                      <Input
                        value={brandingForm.sidebarColor || ""}
                        onChange={(e) => setBrandingForm({ ...brandingForm, sidebarColor: e.target.value })}
                        placeholder="#ffffff"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Button Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandingForm.buttonColor || "#1565C0"}
                        onChange={(e) => setBrandingForm({ ...brandingForm, buttonColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border"
                        data-testid="input-branding-button-color"
                      />
                      <Input
                        value={brandingForm.buttonColor || ""}
                        onChange={(e) => setBrandingForm({ ...brandingForm, buttonColor: e.target.value })}
                        placeholder="#1565C0"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CRM Title</Label>
                  <Input
                    value={brandingForm.crmTitle || ""}
                    onChange={(e) => setBrandingForm({ ...brandingForm, crmTitle: e.target.value })}
                    placeholder="Your CRM Name"
                    data-testid="input-branding-crm-title"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Login Page Title</Label>
                  <Input
                    value={brandingForm.loginPageTitle || ""}
                    onChange={(e) => setBrandingForm({ ...brandingForm, loginPageTitle: e.target.value })}
                    placeholder="Welcome to Your CRM"
                    data-testid="input-branding-login-title"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Footer Text</Label>
                  <Input
                    value={brandingForm.footerText || ""}
                    onChange={(e) => setBrandingForm({ ...brandingForm, footerText: e.target.value })}
                    placeholder="© 2026 Your Company"
                    data-testid="input-branding-footer"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Custom CSS (Optional)</Label>
                  <Textarea
                    value={brandingForm.customCss || ""}
                    onChange={(e) => setBrandingForm({ ...brandingForm, customCss: e.target.value })}
                    placeholder=".sidebar { background: #222; }"
                    rows={3}
                    data-testid="input-branding-custom-css"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => updateBrandingMutation.mutate(brandingForm)}
                    disabled={updateBrandingMutation.isPending}
                    data-testid="button-save-branding"
                  >
                    {updateBrandingMutation.isPending ? "Saving..." : "Save Branding"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingBranding(false);
                      setBrandingForm(company?.brandingSettings || {});
                    }}
                    data-testid="button-cancel-branding"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">CRM Title</Label>
                    <p className="text-sm font-medium" data-testid="text-branding-crm-title">
                      {brandingForm.crmTitle || company?.name || "Not set"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Logo</Label>
                    <p className="text-sm font-medium" data-testid="text-branding-logo">
                      {brandingForm.logo ? "Custom logo set" : "Default"}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Colors</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {[
                      { label: "Primary", color: brandingForm.primaryColor || company?.primaryColor || "#1565C0" },
                      { label: "Secondary", color: brandingForm.secondaryColor || "#111827" },
                      { label: "Sidebar", color: brandingForm.sidebarColor },
                      { label: "Button", color: brandingForm.buttonColor },
                    ].filter(c => c.color).map((c) => (
                      <div key={c.label} className="flex items-center gap-1" title={c.label}>
                        <div className="w-5 h-5 rounded border" style={{ backgroundColor: c.color }} />
                        <span className="text-xs text-muted-foreground">{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {brandingForm.footerText && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Footer</Label>
                    <p className="text-sm font-medium">{brandingForm.footerText}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Homepage Settings</h3>
              </div>
              {!editingHomepage && (
                <Button size="sm" variant="ghost" onClick={() => setEditingHomepage(true)} data-testid="button-edit-homepage">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingHomepage ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Welcome Message</Label>
                  <Input
                    value={homepageForm.welcomeMessage || ""}
                    onChange={(e) => setHomepageForm({ ...homepageForm, welcomeMessage: e.target.value })}
                    placeholder="Welcome to our CRM"
                    data-testid="input-homepage-welcome"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hero Image URL</Label>
                  <Input
                    value={homepageForm.heroImage || ""}
                    onChange={(e) => setHomepageForm({ ...homepageForm, heroImage: e.target.value })}
                    placeholder="https://example.com/hero.jpg"
                    data-testid="input-homepage-hero"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Background Image URL</Label>
                  <Input
                    value={homepageForm.backgroundImage || ""}
                    onChange={(e) => setHomepageForm({ ...homepageForm, backgroundImage: e.target.value })}
                    placeholder="https://example.com/bg.jpg"
                    data-testid="input-homepage-bg"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Support Email</Label>
                  <Input
                    value={homepageForm.supportEmail || ""}
                    onChange={(e) => setHomepageForm({ ...homepageForm, supportEmail: e.target.value })}
                    placeholder="support@yourcompany.com"
                    data-testid="input-homepage-support-email"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Contact Information</Label>
                  <Textarea
                    value={homepageForm.contactInfo || ""}
                    onChange={(e) => setHomepageForm({ ...homepageForm, contactInfo: e.target.value })}
                    placeholder="Your company address and contact details"
                    rows={2}
                    data-testid="input-homepage-contact"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => updateHomepageMutation.mutate(homepageForm)}
                    disabled={updateHomepageMutation.isPending}
                    data-testid="button-save-homepage"
                  >
                    {updateHomepageMutation.isPending ? "Saving..." : "Save Homepage Settings"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingHomepage(false);
                      setHomepageForm(company?.homepageSettings || {});
                    }}
                    data-testid="button-cancel-homepage"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Welcome Message</Label>
                  <p className="text-sm font-medium" data-testid="text-homepage-welcome">
                    {homepageForm.welcomeMessage || "Not set"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Support Email</Label>
                  <p className="text-sm font-medium" data-testid="text-homepage-support">
                    {homepageForm.supportEmail || "Not set"}
                  </p>
                </div>
                {homepageForm.heroImage && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Hero Image</Label>
                    <p className="text-sm font-medium">Custom hero image set</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Company</h3>
            </div>
            {!editingCompany && !companyLoading && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingCompany(true)}
                data-testid="button-edit-company"
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {companyLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : editingCompany ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Company Name</Label>
                <Input
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  data-testid="input-company-name"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Industry</Label>
                <Input
                  value={companyForm.industry}
                  onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                  data-testid="input-company-industry"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Website</Label>
                <Input
                  value={companyForm.website}
                  onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                  data-testid="input-company-website"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  data-testid="input-company-phone"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  data-testid="input-company-address"
                />
              </div>
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Button
                  onClick={() => updateCompanyMutation.mutate(companyForm)}
                  disabled={updateCompanyMutation.isPending}
                  data-testid="button-save-company"
                >
                  {updateCompanyMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingCompany(false);
                    if (company) {
                      setCompanyForm({
                        name: company.name || "",
                        industry: company.industry || "",
                        website: company.website || "",
                        phone: company.phone || "",
                        address: company.address || "",
                      });
                    }
                  }}
                  disabled={updateCompanyMutation.isPending}
                  data-testid="button-cancel-company"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Company Name</Label>
                <p className="text-sm font-medium" data-testid="text-company-name">{company?.name || "Not set"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Industry</Label>
                <p className="text-sm font-medium" data-testid="text-company-industry">{company?.industry || "Not set"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Website</Label>
                <p className="text-sm font-medium" data-testid="text-company-website">{company?.website || "Not set"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <p className="text-sm font-medium" data-testid="text-company-phone">{company?.phone || "Not set"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Address</Label>
                <p className="text-sm font-medium" data-testid="text-company-address">{company?.address || "Not set"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Pipeline Stages</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stages configured</p>
            ) : (
              stages.sort((a, b) => a.order - b.order).map((stage) => (
                <div key={stage.id} className="flex items-center justify-between py-2 gap-1" data-testid={`setting-stage-${stage.id}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color || "#1565C0" }} />
                    <span className="text-sm font-medium">{stage.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{stage.probability}%</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Blocks className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Feature Management</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {featuresLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Modules</Label>
                {modules.map((m) => (
                  <div key={m.module.id} className="flex items-center justify-between py-1.5 gap-1" data-testid={`module-status-${m.module.moduleKey}`}>
                    <div className="flex items-center gap-2">
                      {m.enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{m.module.moduleName}</span>
                      {m.module.isCore && <Badge variant="secondary" className="text-xs">Core</Badge>}
                    </div>
                    <Badge variant={m.enabled ? "default" : "outline"} className="text-xs">
                      {m.enabled ? "Active" : "Locked"}
                    </Badge>
                  </div>
                ))}
              </div>

              {Object.keys(featureLimits).length > 0 && (
                <div className="border-t pt-3 space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Usage Limits</Label>
                  {Object.entries(featureLimits).map(([key, limit]) => {
                    if (limit === null || limit === undefined) return null;
                    const usageMap: Record<string, string> = {
                      max_users: "users", max_leads: "leads", max_contacts: "contacts",
                      max_deals: "deals", max_storage_mb: "storage_mb", monthly_ai_usage: "ai_usage",
                    };
                    const usageKey = usageMap[key] || key;
                    const currentUsage = usage[usageKey] || 0;
                    const limitNum = typeof limit === "number" ? limit : 0;
                    const isUnlimited = limitNum === -1;
                    const pct = isUnlimited ? 0 : limitNum > 0 ? Math.round((currentUsage / limitNum) * 100) : 0;
                    const label = key.replace(/^max_/, "").replace(/^monthly_/, "").replace(/_/g, " ");

                    return (
                      <div key={key} data-testid={`limit-${key}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm capitalize">{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {isUnlimited ? `${currentUsage} / Unlimited` : `${currentUsage} / ${limitNum}`}
                          </span>
                        </div>
                        {!isUnlimited && <Progress value={pct} className="h-1.5" />}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  <Package className="w-3 h-3 inline mr-1" />
                  Feature availability is determined by your subscription plan. Contact your administrator or upgrade to unlock more features.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Account</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Username</Label>
              <p className="text-sm font-medium" data-testid="text-username">{user?.username}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium" data-testid="text-email">{user?.email}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Badge variant="secondary" className="capitalize" data-testid="text-role">
                {user?.role?.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
