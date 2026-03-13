import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";
import type { BrandingSettings, Company, HomepageSettings } from "@shared/schema";

const CRM_BASE_DOMAIN = "crm.skyrichorbit.com";

interface TenantConfig {
  companyName: string;
  companyId: number;
  brandingSettings: BrandingSettings;
  homepageSettings: HomepageSettings;
  logo: string | null;
  primaryColor: string | null;
}

interface BrandingContextType {
  company: Company | null;
  branding: BrandingSettings;
  homepageSettings: HomepageSettings;
  tenantConfig: TenantConfig | null;
  isLoading: boolean;
  detectedSubdomain: string | null;
}

const BrandingContext = createContext<BrandingContextType>({
  company: null,
  branding: {},
  homepageSettings: {},
  tenantConfig: null,
  isLoading: true,
  detectedSubdomain: null,
});

function extractSubdomain(): string | null {
  const hostname = window.location.hostname;
  if (hostname.endsWith(`.${CRM_BASE_DOMAIN}`) && hostname !== CRM_BASE_DOMAIN) {
    return hostname.replace(`.${CRM_BASE_DOMAIN}`, "");
  }
  return null;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const detectedSubdomain = useMemo(() => extractSubdomain(), []);

  const { data: company, isLoading: companyLoading } = useQuery<Company>({
    queryKey: ["/api/company"],
    enabled: !!user && user.role !== "super_admin",
  });

  const { data: tenantConfig, isLoading: tenantLoading } = useQuery<TenantConfig>({
    queryKey: ["/api/tenant/config", detectedSubdomain],
    queryFn: async () => {
      const res = await fetch(`/api/tenant/config?subdomain=${encodeURIComponent(detectedSubdomain!)}`);
      if (!res.ok) throw new Error("Tenant not found");
      return res.json();
    },
    enabled: !!detectedSubdomain && !user,
    retry: false,
  });

  const branding: BrandingSettings = company?.brandingSettings || tenantConfig?.brandingSettings || {};
  const homepageSettings: HomepageSettings = company?.homepageSettings || tenantConfig?.homepageSettings || {};
  const isLoading = (!!user ? companyLoading : (!!detectedSubdomain ? tenantLoading : false));

  useEffect(() => {
    const effectiveBranding = branding;
    const effectivePrimaryColor = effectiveBranding.primaryColor || company?.primaryColor || tenantConfig?.primaryColor || null;

    if (!effectivePrimaryColor && !effectiveBranding.crmTitle) return;

    const root = document.documentElement;
    if (effectivePrimaryColor) root.style.setProperty("--brand-primary", effectivePrimaryColor);
    if (effectiveBranding.secondaryColor) root.style.setProperty("--brand-secondary", effectiveBranding.secondaryColor);
    if (effectiveBranding.sidebarColor) root.style.setProperty("--brand-sidebar", effectiveBranding.sidebarColor);
    if (effectiveBranding.buttonColor) root.style.setProperty("--brand-button", effectiveBranding.buttonColor);

    if (effectiveBranding.crmTitle) {
      document.title = effectiveBranding.crmTitle;
    }

    if (effectiveBranding.favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = effectiveBranding.favicon;
    }

    let styleEl = document.getElementById("tenant-custom-css");
    if (effectiveBranding.customCss) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "tenant-custom-css";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = effectiveBranding.customCss;
    } else if (styleEl) {
      styleEl.remove();
    }

    return () => {
      root.style.removeProperty("--brand-primary");
      root.style.removeProperty("--brand-secondary");
      root.style.removeProperty("--brand-sidebar");
      root.style.removeProperty("--brand-button");
      const el = document.getElementById("tenant-custom-css");
      if (el) el.remove();
    };
  }, [company, tenantConfig, branding]);

  return (
    <BrandingContext.Provider value={{
      company: company || null,
      branding,
      homepageSettings,
      tenantConfig: tenantConfig || null,
      isLoading,
      detectedSubdomain,
    }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
