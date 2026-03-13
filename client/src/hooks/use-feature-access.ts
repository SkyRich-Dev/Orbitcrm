import { useQuery } from "@tanstack/react-query";
import type { ModuleRegistry, FeatureRegistry } from "@shared/schema";

type ModuleWithFeatures = {
  module: ModuleRegistry;
  enabled: boolean;
  features: Array<{
    feature: FeatureRegistry;
    enabled: boolean;
    limit?: number | null;
    overridden: boolean;
  }>;
};

type CompanyFeatureResponse = {
  modules: ModuleWithFeatures[];
  featureFlags: Record<string, boolean>;
  featureLimits: Record<string, number | null>;
  usage: Record<string, number>;
};

export function useCompanyFeatures() {
  const { data, isLoading, error } = useQuery<CompanyFeatureResponse>({
    queryKey: ["/api/features/my"],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    data: data ?? null,
    modules: data?.modules ?? [],
    featureFlags: data?.featureFlags ?? {},
    featureLimits: data?.featureLimits ?? {},
    usage: data?.usage ?? {},
    isLoading,
    error,
  };
}

export function useFeatureAccess(featureKey: string) {
  const { featureFlags, featureLimits, usage, isLoading } = useCompanyFeatures();

  const enabled = featureFlags[featureKey] ?? true;
  const limit = featureLimits[featureKey] ?? null;

  const usageMap: Record<string, string> = {
    max_users: "users",
    max_leads: "leads",
    max_contacts: "contacts",
    max_deals: "deals",
    max_storage_mb: "storage_mb",
    monthly_ai_usage: "ai_usage",
  };

  const usageKey = usageMap[featureKey] || featureKey;
  const currentUsage = usage[usageKey] ?? 0;
  const remaining = limit !== null && limit !== -1 ? Math.max(0, limit - currentUsage) : null;

  return { enabled, limit, remaining, currentUsage, isLoading };
}

export function useModuleAccess(moduleKey: string) {
  const { modules, isLoading } = useCompanyFeatures();

  const mod = modules.find((m) => m.module.moduleKey === moduleKey);
  const enabled = mod?.enabled ?? true;

  return { enabled, isLoading };
}
