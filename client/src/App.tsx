import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/lib/auth";
import { BrandingProvider } from "@/lib/branding";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import LeadsPage from "@/pages/leads";
import ContactsPage from "@/pages/contacts";
import DealsPage from "@/pages/deals";
import TasksPage from "@/pages/tasks";
import SettingsPage from "@/pages/settings";
import LeadDetailPage from "@/pages/lead-detail";
import BillingPage from "@/pages/billing";
import WhatsAppPage from "@/pages/whatsapp";
import AutomationPage from "@/pages/automation";
import AiInsightsPage from "@/pages/ai-insights";
import ReportsPage from "@/pages/reports";
import IntegrationsPage from "@/pages/integrations";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import LandingPage from "@/pages/landing";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminTenantsPage from "@/pages/admin/tenants";
import AdminPlansPage from "@/pages/admin/plans";
import AdminSubscriptionsPage from "@/pages/admin/subscriptions";
import AdminStaffPage from "@/pages/admin/staff";
import AdminConfigPage from "@/pages/admin/config";
import { Skeleton } from "@/components/ui/skeleton";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/leads" component={LeadsPage} />
      <Route path="/leads/:id" component={LeadDetailPage} />
      <Route path="/contacts" component={ContactsPage} />
      <Route path="/deals" component={DealsPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/settings/billing" component={BillingPage} />
      <Route path="/whatsapp" component={WhatsAppPage} />
      <Route path="/automation" component={AutomationPage} />
      <Route path="/ai" component={AiInsightsPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/settings/integrations" component={IntegrationsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={AdminDashboardPage} />
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/admin/tenants" component={AdminTenantsPage} />
      <Route path="/admin/tenants/:id" component={AdminTenantsPage} />
      <Route path="/admin/staff" component={AdminStaffPage} />
      <Route path="/admin/plans" component={AdminPlansPage} />
      <Route path="/admin/subscriptions" component={AdminSubscriptionsPage} />
      <Route path="/admin/config" component={AdminConfigPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-1 p-2 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AdminLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AdminSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-1 p-2 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-admin-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <AdminRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthGate() {
  const { user, isLoading } = useAuth();
  const [authView, setAuthView] = useState<"landing" | "login" | "register">("landing");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-14 w-14 rounded-2xl mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    if (authView === "login") {
      return <LoginPage onToggle={() => setAuthView("register")} onBack={() => setAuthView("landing")} />;
    }
    if (authView === "register") {
      return <RegisterPage onToggle={() => setAuthView("login")} onBack={() => setAuthView("landing")} />;
    }
    return (
      <LandingPage
        onLogin={() => setAuthView("login")}
        onRegister={() => setAuthView("register")}
      />
    );
  }

  if (user.role === "super_admin") {
    return <AdminLayout />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <AuthProvider>
              <BrandingProvider>
                <AuthGate />
              </BrandingProvider>
            </AuthProvider>
          </ThemeProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
