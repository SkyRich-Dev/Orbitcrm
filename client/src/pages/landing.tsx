import { useQuery } from "@tanstack/react-query";
import {
  Orbit,
  ArrowRight,
  BarChart3,
  Users,
  Target,
  Zap,
  Shield,
  Globe,
  Check,
  Star,
  ChevronRight,
  Sparkles,
  Layers,
  Clock,
  Phone,
  Mail,
  MapPin,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { SubscriptionPlan, PlanFeatures, PlanLimits } from "@shared/schema";

const FEATURES = [
  {
    icon: Target,
    title: "Lead Management",
    description: "Capture, score, and nurture leads through your sales pipeline with AI-powered insights and automated follow-ups.",
  },
  {
    icon: Users,
    title: "Contact Management",
    description: "Organize contacts with multi-view layouts — list, kanban, calendar, and activity timeline — all in one place.",
  },
  {
    icon: BarChart3,
    title: "Deal Tracking",
    description: "Visualize your sales pipeline, forecast revenue, and close deals faster with drag-and-drop kanban boards.",
  },
  {
    icon: Sparkles,
    title: "AI Smart Features",
    description: "Built-in AI scoring, sales predictions, automated task generation, and intelligent insights — no API keys needed.",
  },
  {
    icon: Layers,
    title: "Multi-Tenant SaaS",
    description: "Complete data isolation per company. Each team gets their own workspace with role-based access control.",
  },
  {
    icon: Clock,
    title: "Task Automation",
    description: "Automate repetitive tasks, set reminders, and never miss a follow-up with smart task management.",
  },
];

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

const LIMIT_LABELS: Record<string, string> = {
  max_users: "Users",
  max_leads: "Leads",
  max_contacts: "Contacts",
  max_deals: "Deals",
  max_storage_mb: "Storage (MB)",
};

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const { data: rawPlans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/billing/plans"],
  });
  const plans = (rawPlans ?? []).filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b" data-testid="landing-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary">
                <Orbit className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight" data-testid="text-brand-name">SkyRich Orbit</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => scrollTo("features")} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-features">Features</button>
              <button onClick={() => scrollTo("pricing")} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-pricing">Pricing</button>
              <button onClick={() => scrollTo("about")} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-about">About</button>
              <button onClick={() => scrollTo("contact")} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-contact">Contact</button>
            </nav>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onLogin} data-testid="button-header-login">
                Sign In
              </Button>
              <Button size="sm" onClick={onRegister} data-testid="button-header-register">
                Get Started <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-3/5 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36 relative">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm" data-testid="badge-tagline">
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              AI-Powered CRM for Modern Teams
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight" data-testid="text-hero-title">
              Grow Your Business with{" "}
              <span className="text-primary">Intelligent CRM</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed" data-testid="text-hero-subtitle">
              SkyRich Orbit is a multi-tenant SaaS CRM platform built for SMEs. Manage leads, contacts, deals, and tasks with AI-driven insights — all in one powerful workspace.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Button size="lg" onClick={onRegister} className="px-8 text-base" data-testid="button-hero-get-started">
                Start Free Trial <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollTo("features")} className="px-8 text-base" data-testid="button-hero-learn-more">
                Learn More
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-10 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-chart-2" /> No credit card required</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-chart-2" /> 14-day free trial</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-chart-2" /> Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/30 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div data-testid="stat-companies">
              <p className="text-3xl font-bold text-primary">500+</p>
              <p className="text-sm text-muted-foreground mt-1">Companies Trust Us</p>
            </div>
            <div data-testid="stat-users">
              <p className="text-3xl font-bold text-primary">10,000+</p>
              <p className="text-sm text-muted-foreground mt-1">Active Users</p>
            </div>
            <div data-testid="stat-deals">
              <p className="text-3xl font-bold text-primary">$2B+</p>
              <p className="text-sm text-muted-foreground mt-1">Deals Managed</p>
            </div>
            <div data-testid="stat-uptime">
              <p className="text-3xl font-bold text-primary">99.9%</p>
              <p className="text-sm text-muted-foreground mt-1">Uptime SLA</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 sm:py-28" data-testid="section-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything You Need to Close More Deals</h2>
            <p className="text-muted-foreground mt-4 text-lg">
              From lead capture to deal closure, SkyRich Orbit gives your team the tools to succeed at every stage of the sales cycle.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <Card key={i} data-testid={`card-feature-${i}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 sm:py-28 bg-muted/30 border-y" data-testid="section-pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Choose the plan that fits your team. Start free and scale as you grow.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plansLoading ? (
              [...Array(4)].map((_, i) => (
                <Card key={i} className="flex flex-col">
                  <CardHeader className="pb-2 pt-6">
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-4">
                    <div className="h-10 w-32 bg-muted rounded animate-pulse" />
                    <Separator />
                    <div className="space-y-2">
                      {[...Array(5)].map((_, j) => (
                        <div key={j} className="h-4 w-full bg-muted rounded animate-pulse" />
                      ))}
                    </div>
                    <div className="h-10 w-full bg-muted rounded animate-pulse mt-auto" />
                  </CardContent>
                </Card>
              ))
            ) : plans.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <p>Pricing plans coming soon. Contact us for details.</p>
              </div>
            ) : null}
            {plans.map((plan, i) => {
              const features = (plan.features as PlanFeatures) || {};
              const limits = (plan.limits as PlanLimits) || {};
              const isPopular = plan.name === "Professional";
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${isPopular ? "border-primary shadow-lg ring-1 ring-primary/20" : ""}`}
                  data-testid={`card-pricing-${plan.id}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3">
                        <Star className="w-3 h-3 mr-1" /> Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2 pt-6">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">${plan.priceMonthly}</span>
                        <span className="text-muted-foreground text-sm">/month</span>
                      </div>
                      {Number(plan.priceYearly) > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          or ${plan.priceYearly}/year (save {Math.round((1 - Number(plan.priceYearly) / (Number(plan.priceMonthly) * 12)) * 100)}%)
                        </p>
                      )}
                    </div>

                    <Separator className="mb-4" />

                    <div className="space-y-2 mb-6 flex-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Limits</p>
                      {Object.entries(limits).map(([key, val]) => (
                        LIMIT_LABELS[key] && (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{LIMIT_LABELS[key]}</span>
                            <span className="font-medium">{val === -1 ? "Unlimited" : val?.toLocaleString()}</span>
                          </div>
                        )
                      ))}
                    </div>

                    <div className="space-y-2 mb-6">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Features</p>
                      {Object.entries(features).map(([key, enabled]) => (
                        FEATURE_LABELS[key] && (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            <Check className={`w-4 h-4 shrink-0 ${enabled ? "text-chart-2" : "text-muted-foreground/30"}`} />
                            <span className={enabled ? "" : "text-muted-foreground line-through"}>{FEATURE_LABELS[key]}</span>
                          </div>
                        )
                      ))}
                    </div>

                    <Button
                      className="w-full mt-auto"
                      variant={isPopular ? "default" : "outline"}
                      onClick={onRegister}
                      data-testid={`button-select-plan-${plan.id}`}
                    >
                      {Number(plan.priceMonthly) === 0 ? "Start Free" : "Get Started"}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!plansLoading && plans.length > 0 && (
            <div className="mt-16" data-testid="feature-comparison-table">
              <h3 className="text-2xl font-bold tracking-tight text-center mb-8">Feature Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-[200px]">Feature</th>
                      {plans.map((plan) => (
                        <th key={plan.id} className="text-center py-3 px-4 font-semibold">{plan.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b bg-muted/30">
                      <td colSpan={plans.length + 1} className="py-2 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Usage Limits</td>
                    </tr>
                    {Object.entries(LIMIT_LABELS).map(([key, label]) => (
                      <tr key={key} className="border-b">
                        <td className="py-3 px-4 text-muted-foreground">{label}</td>
                        {plans.map((plan) => {
                          const limits = (plan.limits as PlanLimits) || {};
                          const val = limits[key as keyof PlanLimits];
                          return (
                            <td key={plan.id} className="text-center py-3 px-4 font-medium">
                              {val === -1 ? "Unlimited" : (val ?? 0).toLocaleString()}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-b bg-muted/30">
                      <td colSpan={plans.length + 1} className="py-2 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Features</td>
                    </tr>
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                      <tr key={key} className="border-b">
                        <td className="py-3 px-4 text-muted-foreground">{label}</td>
                        {plans.map((plan) => {
                          const features = (plan.features as PlanFeatures) || {};
                          const enabled = features[key as keyof PlanFeatures];
                          return (
                            <td key={plan.id} className="text-center py-3 px-4">
                              {enabled ? (
                                <Check className="w-5 h-5 text-chart-2 mx-auto" />
                              ) : (
                                <X className="w-5 h-5 text-muted-foreground/30 mx-auto" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-b bg-muted/30">
                      <td colSpan={plans.length + 1} className="py-2 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Pricing</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 text-muted-foreground">Monthly</td>
                      {plans.map((plan) => (
                        <td key={plan.id} className="text-center py-3 px-4 font-semibold">${plan.priceMonthly}/mo</td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 text-muted-foreground">Yearly</td>
                      {plans.map((plan) => (
                        <td key={plan.id} className="text-center py-3 px-4 font-semibold">
                          {Number(plan.priceYearly) > 0 ? `$${plan.priceYearly}/yr` : "Free"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-4 px-4" />
                      {plans.map((plan) => (
                        <td key={plan.id} className="text-center py-4 px-4">
                          <Button
                            size="sm"
                            variant={plan.name === "Professional" ? "default" : "outline"}
                            onClick={onRegister}
                            data-testid={`button-compare-select-${plan.id}`}
                          >
                            {Number(plan.priceMonthly) === 0 ? "Start Free" : "Get Started"}
                          </Button>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="about" className="py-20 sm:py-28" data-testid="section-about">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge variant="outline" className="mb-4">About Us</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Built for Teams That Want to Win</h2>
              <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
                SkyRich Orbit was born from a simple idea: every growing business deserves enterprise-grade CRM tools without the enterprise price tag. Built by SkyRich Tech Solutions Pte Ltd in Singapore, our platform combines powerful AI insights with an intuitive interface, making it easy for SMEs to manage their entire sales process.
              </p>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Our multi-tenant architecture ensures complete data isolation for every company, while our AI engine provides lead scoring, deal predictions, and automated task generation — all running locally without external API dependencies.
              </p>
              <div className="grid grid-cols-2 gap-6 mt-8">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Enterprise Security</h4>
                    <p className="text-xs text-muted-foreground mt-1">Role-based access, data isolation, encrypted sessions</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                    <Globe className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Cloud Native</h4>
                    <p className="text-xs text-muted-foreground mt-1">Hosted in Singapore, deployed globally with 99.9% uptime</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">AI Built In</h4>
                    <p className="text-xs text-muted-foreground mt-1">No external APIs — AI runs natively in the platform</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Lightning Fast</h4>
                    <p className="text-xs text-muted-foreground mt-1">Built with React and modern tech for peak performance</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-chart-3/10 to-chart-2/10 p-8 lg:p-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-background/80 backdrop-blur-sm shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
                      <Target className="w-6 h-6 text-chart-2" />
                    </div>
                    <div>
                      <p className="font-semibold">Lead Conversion Up 35%</p>
                      <p className="text-xs text-muted-foreground">Average improvement across all customers</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-background/80 backdrop-blur-sm shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-chart-4/10 flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-chart-4" />
                    </div>
                    <div>
                      <p className="font-semibold">2x Faster Deal Closure</p>
                      <p className="text-xs text-muted-foreground">With AI-powered pipeline insights</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-background/80 backdrop-blur-sm shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">5 Hours Saved Per Week</p>
                      <p className="text-xs text-muted-foreground">Through automated task management</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="py-20 sm:py-28 bg-muted/30 border-t" data-testid="section-contact">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="mb-4">Contact</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Get in Touch</h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Have questions? Our team is here to help you find the right plan and get started.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <Card className="text-center" data-testid="contact-email">
              <CardContent className="p-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mx-auto mb-3">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">Email Us</h3>
                <p className="text-sm text-muted-foreground mt-1">sales@skyrichorbit.com</p>
              </CardContent>
            </Card>
            <Card className="text-center" data-testid="contact-phone">
              <CardContent className="p-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mx-auto mb-3">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">Call Us</h3>
                <p className="text-sm text-muted-foreground mt-1">+1 (555) 123-4567</p>
              </CardContent>
            </Card>
            <Card className="text-center" data-testid="contact-address">
              <CardContent className="p-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mx-auto mb-3">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">Visit Us</h3>
                <p className="text-sm text-muted-foreground mt-1">Singapore</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20" data-testid="section-cta">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to Transform Your Sales?</h2>
          <p className="text-muted-foreground mt-4 text-lg max-w-xl mx-auto">
            Join hundreds of companies already using SkyRich Orbit to close more deals and grow faster.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Button size="lg" onClick={onRegister} className="px-8 text-base" data-testid="button-cta-register">
              Start Your Free Trial <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={onLogin} className="px-8 text-base" data-testid="button-cta-login">
              Sign In to Your Account
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-10 bg-muted/20" data-testid="landing-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
                <Orbit className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold">SkyRich Orbit</span>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} SkyRich Tech Solutions Pte Ltd. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Support</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
