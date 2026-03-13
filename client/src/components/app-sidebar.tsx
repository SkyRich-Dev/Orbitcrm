import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Briefcase,
  CheckSquare,
  Settings,
  CreditCard,
  MessageSquare,
  Zap,
  Brain,
  BarChart3,
  LogOut,
  Orbit,
  ChevronDown,
  Lock,
  Puzzle,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useCompanyFeatures } from "@/hooks/use-feature-access";
import { useBranding } from "@/lib/branding";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Contact2: UserCircle,
  UserCircle,
  Handshake: Briefcase,
  Briefcase,
  CheckSquare,
  Settings,
  CreditCard,
  MessageSquare,
  Zap,
  Brain,
  BarChart3,
  Puzzle,
};

const systemModuleKeys = new Set(["settings", "billing"]);

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { modules, isLoading } = useCompanyFeatures();
  const { company, branding } = useBranding();

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const mainModules = modules.filter(
    (m) => !systemModuleKeys.has(m.module.moduleKey) && m.module.routePath
  );

  const systemModules = modules.filter(
    (m) => systemModuleKeys.has(m.module.moduleKey) && m.module.routePath
  );

  const hasBillingModule = systemModules.some((m) => m.module.moduleKey === "billing");

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          {branding.logo || company?.logo ? (
            <img
              src={branding.logo || company?.logo || ""}
              alt={branding.crmTitle || company?.name || "CRM"}
              className="w-8 h-8 rounded-md object-contain"
              data-testid="img-sidebar-logo"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <Orbit className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight" data-testid="text-sidebar-title">
              {branding.crmTitle || company?.name || "SkyRich Orbit"}
            </span>
            <span className="text-xs text-muted-foreground">CRM Platform</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {!isLoading && mainModules.map((m) => {
                const Icon = iconMap[m.module.moduleIcon || ""] || LayoutDashboard;
                const url = m.module.routePath || "/";
                const isActive = url === "/"
                  ? location === "/"
                  : location === url || location.startsWith(url + "/");

                if (!m.enabled) {
                  return (
                    <SidebarMenuItem key={m.module.moduleKey}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton disabled className="opacity-50 cursor-not-allowed">
                            <Lock className="w-4 h-4" />
                            <span>{m.module.moduleName}</span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>Not available in your plan</p>
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={m.module.moduleKey}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={url} data-testid={`nav-${m.module.moduleKey}`}>
                        <Icon className="w-4 h-4" />
                        <span>{m.module.moduleName}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {isLoading && (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuButton disabled>
                        <div className="w-4 h-4 rounded bg-muted animate-pulse" />
                        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {!isLoading && systemModules.map((m) => {
                const Icon = iconMap[m.module.moduleIcon || ""] || Settings;
                const url = m.module.routePath || "/settings";

                return (
                  <SidebarMenuItem key={m.module.moduleKey}>
                    <SidebarMenuButton asChild isActive={location === url}>
                      <Link href={url} data-testid={`nav-${m.module.moduleKey}`}>
                        <Icon className="w-4 h-4" />
                        <span>{m.module.moduleName}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {!isLoading && !hasBillingModule && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/settings/billing"}>
                    <Link href="/settings/billing" data-testid="nav-billing">
                      <CreditCard className="w-4 h-4" />
                      <span>Billing</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 w-full p-2 rounded-md text-left"
              data-testid="button-user-menu"
            >
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.role?.replace(/_/g, " ")}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
