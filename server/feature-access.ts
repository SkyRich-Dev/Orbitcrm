import { storage } from "./storage";
import type { PlanFeatures, PlanLimits, ModuleRegistry, FeatureRegistry, PackageFeature, CompanyFeatureOverride } from "@shared/schema";
import type { Request, Response, NextFunction } from "express";

export type FeatureCheckResult = {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
};

export type CompanyFeatureMap = {
  modules: Array<{
    module: ModuleRegistry;
    enabled: boolean;
    features: Array<{
      feature: FeatureRegistry;
      enabled: boolean;
      limit?: number | null;
      overridden: boolean;
    }>;
  }>;
  featureFlags: Record<string, boolean>;
  featureLimits: Record<string, number | null>;
};

const featureCache = new Map<string, { data: CompanyFeatureMap; timestamp: number }>();
const CACHE_TTL_MS = 60_000;

export class FeatureAccessService {
  private clearCache(companyId: number) {
    featureCache.delete(`company:${companyId}`);
  }

  async getCompanyFeatureMap(companyId: number): Promise<CompanyFeatureMap> {
    const cacheKey = `company:${companyId}`;
    const cached = featureCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const allModules = await storage.getModules();
    const allFeatures = await storage.getFeatures();
    const subscription = await storage.getCompanySubscription(companyId);
    const overrides = await storage.getCompanyFeatureOverrides(companyId);

    let pkgFeatures: PackageFeature[] = [];
    if (subscription) {
      pkgFeatures = await storage.getPackageFeatures(subscription.planId);
    }

    const overrideMap = new Map<number, CompanyFeatureOverride>();
    for (const o of overrides) {
      overrideMap.set(o.featureId, o);
    }

    const pkgFeatureMap = new Map<number, PackageFeature>();
    for (const pf of pkgFeatures) {
      pkgFeatureMap.set(pf.featureId, pf);
    }

    let plan = null;
    if (subscription) {
      plan = await storage.getSubscriptionPlan(subscription.planId);
    }
    const legacyFeatures = (plan?.features || {}) as Record<string, boolean>;
    const legacyLimits = (plan?.limits || {}) as Record<string, number>;

    const subscriptionActive = subscription
      ? subscription.status !== "expired" && subscription.status !== "cancelled"
      : false;

    const featureFlags: Record<string, boolean> = {};
    const featureLimits: Record<string, number | null> = {};

    const moduleResults = allModules.map((mod) => {
      const moduleFeatures = allFeatures.filter((f) => f.moduleId === mod.id);

      const moduleHasEnabledFeature = moduleFeatures.some((f) => {
        const override = overrideMap.get(f.id);
        if (override) return override.isEnabled;
        const pkgFeat = pkgFeatureMap.get(f.id);
        if (pkgFeat) return pkgFeat.isEnabled;
        if (legacyFeatures[f.featureKey] !== undefined) return legacyFeatures[f.featureKey];
        return f.defaultEnabled;
      });

      const moduleEnabled = mod.isActive && subscriptionActive && (mod.isCore || moduleHasEnabledFeature);

      const features = moduleFeatures.map((f) => {
        const override = overrideMap.get(f.id);
        const pkgFeat = pkgFeatureMap.get(f.id);

        let enabled: boolean;
        let limit: number | null = null;
        let overridden = false;

        if (override) {
          enabled = override.isEnabled;
          limit = override.customLimit;
          overridden = true;
        } else if (pkgFeat) {
          enabled = pkgFeat.isEnabled;
          limit = pkgFeat.limitValue;
        } else if (legacyFeatures[f.featureKey] !== undefined) {
          enabled = legacyFeatures[f.featureKey];
          if (legacyLimits[f.featureKey] !== undefined) {
            limit = legacyLimits[f.featureKey];
          }
        } else {
          enabled = f.defaultEnabled;
          if (legacyLimits[f.featureKey] !== undefined) {
            limit = legacyLimits[f.featureKey];
          }
        }

        featureFlags[f.featureKey] = enabled && moduleEnabled;
        if (limit !== null && limit !== undefined) {
          featureLimits[f.featureKey] = limit;
        }

        return { feature: f, enabled, limit, overridden };
      });

      return { module: mod, enabled: moduleEnabled, features };
    });

    const result: CompanyFeatureMap = { modules: moduleResults, featureFlags, featureLimits };
    featureCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  async isModuleEnabled(companyId: number, moduleKey: string): Promise<boolean> {
    const map = await this.getCompanyFeatureMap(companyId);
    const mod = map.modules.find((m) => m.module.moduleKey === moduleKey);
    return mod?.enabled ?? false;
  }

  async isFeatureEnabled(companyId: number, featureKey: string): Promise<boolean> {
    const map = await this.getCompanyFeatureMap(companyId);
    return map.featureFlags[featureKey] ?? false;
  }

  async getFeatureLimit(companyId: number, featureKey: string): Promise<number | null> {
    const map = await this.getCompanyFeatureMap(companyId);
    return map.featureLimits[featureKey] ?? null;
  }

  async checkFeature(companyId: number, featureName: keyof PlanFeatures | string): Promise<FeatureCheckResult> {
    const subscription = await storage.getCompanySubscription(companyId);
    if (!subscription) {
      return { allowed: false, reason: "No active subscription" };
    }
    if (subscription.status === "expired" || subscription.status === "cancelled") {
      return { allowed: false, reason: "Subscription is " + subscription.status };
    }

    const enabled = await this.isFeatureEnabled(companyId, featureName);
    if (!enabled) {
      return { allowed: false, reason: `Feature "${featureName}" is not available in your current plan` };
    }

    return { allowed: true };
  }

  async checkLimit(companyId: number, limitName: keyof PlanLimits | string): Promise<FeatureCheckResult> {
    const subscription = await storage.getCompanySubscription(companyId);
    if (!subscription) {
      return { allowed: false, reason: "No active subscription" };
    }
    if (subscription.status === "expired" || subscription.status === "cancelled") {
      return { allowed: false, reason: "Subscription is " + subscription.status };
    }

    const limit = await this.getFeatureLimit(companyId, limitName);
    if (limit === null || limit === undefined || limit === -1) {
      return { allowed: true };
    }

    const usage = await storage.getCompanyUsageSummary(companyId);
    const usageMap: Record<string, string> = {
      max_users: "users",
      max_leads: "leads",
      max_contacts: "contacts",
      max_deals: "deals",
      max_storage_mb: "storage_mb",
      monthly_ai_usage: "ai_usage",
    };

    const usageKey = usageMap[limitName] || limitName;
    const currentUsage = usage[usageKey] || 0;

    if (currentUsage >= limit) {
      return {
        allowed: false,
        reason: `Limit reached: ${currentUsage}/${limit} ${limitName.replace("max_", "").replace("monthly_", "")}`,
        currentUsage,
        limit,
      };
    }

    return { allowed: true, currentUsage, limit };
  }

  async getCompanyPlanInfo(companyId: number) {
    const subscription = await storage.getCompanySubscription(companyId);
    if (!subscription) return null;

    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (!plan) return null;

    const usage = await storage.getCompanyUsageSummary(companyId);
    const featureMap = await this.getCompanyFeatureMap(companyId);

    return {
      subscription,
      plan,
      features: featureMap.featureFlags as unknown as PlanFeatures,
      limits: featureMap.featureLimits as unknown as PlanLimits,
      usage,
    };
  }

  invalidateCache(companyId: number) {
    this.clearCache(companyId);
  }

  invalidateAllCaches() {
    featureCache.clear();
  }
}

export const featureAccess = new FeatureAccessService();

export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await featureAccess.checkFeature(req.session.companyId, featureKey);
    if (!result.allowed) {
      return res.status(403).json({ message: result.reason || "Feature not available" });
    }

    next();
  };
}

export function requireModule(moduleKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const enabled = await featureAccess.isModuleEnabled(req.session.companyId, moduleKey);
    if (!enabled) {
      return res.status(403).json({ message: `Module "${moduleKey}" is not available in your current plan` });
    }

    next();
  };
}

export function requireLimit(limitKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await featureAccess.checkLimit(req.session.companyId, limitKey);
    if (!result.allowed) {
      return res.status(403).json({ message: result.reason || "Limit reached. Upgrade your plan." });
    }

    next();
  };
}
