import { eq, and, desc, sql, count, asc } from "drizzle-orm";
import { db } from "./db";
import {
  companies, users, pipelineStages, leads, contacts, deals, activities, tasks,
  aiSettings, automationRules, aiInsights, aiUsageLogs,
  subscriptionPlans, companySubscriptions, paymentTransactions, featureUsage,
  whatsappSettings, whatsappMessages, whatsappContacts, whatsappCommandLogs,
  moduleRegistry, featureRegistry, packageFeatures, companyFeatureOverrides,
  integrationApps, companyIntegrations, integrationLogs,
  type Company, type InsertCompany,
  type User, type InsertUser,
  type PipelineStage, type InsertPipelineStage,
  type Lead, type InsertLead,
  type Contact, type InsertContact,
  type Deal, type InsertDeal,
  type Activity, type InsertActivity,
  type Task, type InsertTask,
  type AiSettings, type InsertAiSettings,
  type AutomationRule, type InsertAutomationRule,
  type AiInsight, type InsertAiInsight,
  type AiUsageLog,
  type SubscriptionPlan, type InsertSubscriptionPlan,
  type CompanySubscription, type InsertCompanySubscription,
  type PaymentTransaction, type InsertPaymentTransaction,
  type FeatureUsage, type InsertFeatureUsage,
  type WhatsappSettings, type InsertWhatsappSettings,
  type WhatsappMessage, type InsertWhatsappMessage,
  type WhatsappContact, type InsertWhatsappContact,
  type WhatsappCommandLog, type InsertWhatsappCommandLog,
  type ModuleRegistry, type InsertModuleRegistry,
  type FeatureRegistry, type InsertFeatureRegistry,
  type PackageFeature, type InsertPackageFeature,
  type CompanyFeatureOverride, type InsertCompanyFeatureOverride,
  type IntegrationApp, type InsertIntegrationApp,
  type CompanyIntegration, type InsertCompanyIntegration,
  type IntegrationLog, type InsertIntegrationLog,
} from "@shared/schema";

export interface IStorage {
  createCompany(data: InsertCompany): Promise<Company>;
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyBySubdomain(subdomain: string): Promise<Company | undefined>;
  updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company | undefined>;

  createUser(data: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(companyId: number): Promise<User[]>;

  createPipelineStage(data: InsertPipelineStage): Promise<PipelineStage>;
  getPipelineStages(companyId: number): Promise<PipelineStage[]>;

  createLead(data: InsertLead): Promise<Lead>;
  getLeads(companyId: number): Promise<Lead[]>;
  getLead(id: number, companyId: number): Promise<Lead | undefined>;
  updateLead(id: number, companyId: number, data: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: number, companyId: number): Promise<void>;

  createContact(data: InsertContact): Promise<Contact>;
  getContacts(companyId: number): Promise<Contact[]>;
  getContact(id: number, companyId: number): Promise<Contact | undefined>;
  updateContact(id: number, companyId: number, data: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number, companyId: number): Promise<void>;

  createDeal(data: InsertDeal): Promise<Deal>;
  getDeals(companyId: number): Promise<Deal[]>;
  getDeal(id: number, companyId: number): Promise<Deal | undefined>;
  updateDeal(id: number, companyId: number, data: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: number, companyId: number): Promise<void>;

  createActivity(data: InsertActivity): Promise<Activity>;
  getActivities(companyId: number, limit?: number, entityType?: string): Promise<Activity[]>;
  getLeadActivities(companyId: number, leadId: number): Promise<Activity[]>;

  createTask(data: InsertTask): Promise<Task>;
  getTasks(companyId: number): Promise<Task[]>;
  getTask(id: number, companyId: number): Promise<Task | undefined>;
  updateTask(id: number, companyId: number, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number, companyId: number): Promise<void>;

  getDashboardStats(companyId: number): Promise<any>;

  getAiSettings(companyId: number): Promise<AiSettings | undefined>;
  upsertAiSettings(companyId: number, data: Partial<InsertAiSettings>): Promise<AiSettings>;

  getAutomationRules(companyId: number): Promise<AutomationRule[]>;
  createAutomationRule(data: InsertAutomationRule): Promise<AutomationRule>;
  updateAutomationRule(id: number, companyId: number, data: Partial<InsertAutomationRule>): Promise<AutomationRule | undefined>;
  deleteAutomationRule(id: number, companyId: number): Promise<void>;

  getAiInsights(companyId: number): Promise<AiInsight[]>;
  markInsightRead(id: number, companyId: number): Promise<AiInsight | undefined>;

  getSubscriptionPlans(activeOnly?: boolean): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(data: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: number, data: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;

  getCompanySubscription(companyId: number): Promise<CompanySubscription | undefined>;
  createCompanySubscription(data: InsertCompanySubscription): Promise<CompanySubscription>;
  updateCompanySubscription(id: number, data: Partial<InsertCompanySubscription>): Promise<CompanySubscription | undefined>;

  getPaymentTransactions(companyId: number): Promise<PaymentTransaction[]>;
  createPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction>;
  updatePaymentTransaction(id: number, data: Partial<{ status: string; transactionId: string; metadata: any }>): Promise<PaymentTransaction | undefined>;

  getFeatureUsage(companyId: number, featureName: string): Promise<FeatureUsage | undefined>;
  incrementFeatureUsage(companyId: number, featureName: string): Promise<FeatureUsage>;
  resetFeatureUsage(companyId: number): Promise<void>;
  getCompanyUsageSummary(companyId: number): Promise<Record<string, number>>;

  getWhatsappSettings(companyId: number): Promise<WhatsappSettings | undefined>;
  upsertWhatsappSettings(companyId: number, data: Partial<InsertWhatsappSettings>): Promise<WhatsappSettings>;
  getWhatsappMessages(companyId: number, phoneNumber?: string): Promise<WhatsappMessage[]>;
  createWhatsappMessage(data: InsertWhatsappMessage): Promise<WhatsappMessage>;
  getWhatsappContacts(companyId: number): Promise<WhatsappContact[]>;
  getWhatsappContact(id: number, companyId: number): Promise<WhatsappContact | undefined>;
  createWhatsappContact(data: InsertWhatsappContact): Promise<WhatsappContact>;
  updateWhatsappContact(id: number, companyId: number, data: Partial<InsertWhatsappContact>): Promise<WhatsappContact | undefined>;
  deleteWhatsappContact(id: number, companyId: number): Promise<void>;
  getWhatsappCommandLogs(companyId: number): Promise<WhatsappCommandLog[]>;
  createWhatsappCommandLog(data: InsertWhatsappCommandLog): Promise<WhatsappCommandLog>;

  getAllCompanies(includeArchived?: boolean): Promise<Company[]>;
  getArchivedCompanies(): Promise<Company[]>;
  archiveCompany(id: number): Promise<Company | undefined>;
  restoreCompany(id: number): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<void>;
  createTenantWithPlan(data: { company: InsertCompany; admin: { username: string; password: string; email: string; fullName: string }; planId: number }): Promise<{ company: Company; user: User; subscription: CompanySubscription }>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getAllSubscriptions(): Promise<CompanySubscription[]>;
  deleteSubscriptionPlan(id: number): Promise<void>;
  getPlatformStats(): Promise<{ totalTenants: number; totalUsers: number; activeSubscriptions: number; monthlyRevenue: number }>;

  getModules(): Promise<ModuleRegistry[]>;
  getModule(id: number): Promise<ModuleRegistry | undefined>;
  createModule(data: InsertModuleRegistry): Promise<ModuleRegistry>;
  updateModule(id: number, data: Partial<InsertModuleRegistry>): Promise<ModuleRegistry | undefined>;

  getFeatures(): Promise<FeatureRegistry[]>;
  getFeaturesByModule(moduleId: number): Promise<FeatureRegistry[]>;
  createFeature(data: InsertFeatureRegistry): Promise<FeatureRegistry>;
  updateFeature(id: number, data: Partial<InsertFeatureRegistry>): Promise<FeatureRegistry | undefined>;

  getPackageFeatures(planId: number): Promise<PackageFeature[]>;
  getAllPackageFeatures(): Promise<PackageFeature[]>;
  upsertPackageFeature(data: InsertPackageFeature): Promise<PackageFeature>;
  deletePackageFeature(planId: number, featureId: number): Promise<void>;
  setPackageFeaturesForPlan(planId: number, features: InsertPackageFeature[]): Promise<void>;

  getCompanyFeatureOverrides(companyId: number): Promise<CompanyFeatureOverride[]>;
  upsertCompanyFeatureOverride(data: InsertCompanyFeatureOverride): Promise<CompanyFeatureOverride>;
  deleteCompanyFeatureOverride(companyId: number, featureId: number): Promise<void>;

  getIntegrationApps(activeOnly?: boolean): Promise<IntegrationApp[]>;
  getIntegrationApp(id: number): Promise<IntegrationApp | undefined>;
  createIntegrationApp(data: InsertIntegrationApp): Promise<IntegrationApp>;
  updateIntegrationApp(id: number, data: Partial<InsertIntegrationApp>): Promise<IntegrationApp | undefined>;

  getCompanyIntegrations(companyId: number): Promise<CompanyIntegration[]>;
  getCompanyIntegration(id: number, companyId: number): Promise<CompanyIntegration | undefined>;
  connectIntegration(data: InsertCompanyIntegration): Promise<CompanyIntegration>;
  updateCompanyIntegration(id: number, companyId: number, data: Partial<InsertCompanyIntegration>): Promise<CompanyIntegration | undefined>;
  disconnectIntegration(id: number, companyId: number): Promise<void>;

  getIntegrationLogs(companyId: number, integrationAppId?: number): Promise<IntegrationLog[]>;
  createIntegrationLog(data: InsertIntegrationLog): Promise<IntegrationLog>;
}

export class DatabaseStorage implements IStorage {
  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data).returning();
    return company;
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompanyBySubdomain(subdomain: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.subdomain, subdomain));
    return company;
  }

  async updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUsers(companyId: number): Promise<User[]> {
    return db.select().from(users).where(and(eq(users.companyId, companyId), eq(users.isActive, true))).orderBy(users.fullName);
  }

  async createPipelineStage(data: InsertPipelineStage): Promise<PipelineStage> {
    const [stage] = await db.insert(pipelineStages).values(data).returning();
    return stage;
  }

  async getPipelineStages(companyId: number): Promise<PipelineStage[]> {
    return db.select().from(pipelineStages).where(eq(pipelineStages.companyId, companyId)).orderBy(pipelineStages.order);
  }

  async createLead(data: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(data).returning();
    return lead;
  }

  async getLeads(companyId: number): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.companyId, companyId)).orderBy(desc(leads.createdAt));
  }

  async getLead(id: number, companyId: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.companyId, companyId)));
    return lead;
  }

  async updateLead(id: number, companyId: number, data: Partial<InsertLead>): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(leads.id, id), eq(leads.companyId, companyId)))
      .returning();
    return lead;
  }

  async deleteLead(id: number, companyId: number): Promise<void> {
    await db.delete(leads).where(and(eq(leads.id, id), eq(leads.companyId, companyId)));
  }

  async createContact(data: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(data).returning();
    return contact;
  }

  async getContacts(companyId: number): Promise<Contact[]> {
    return db.select().from(contacts).where(eq(contacts.companyId, companyId)).orderBy(desc(contacts.createdAt));
  }

  async getContact(id: number, companyId: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.companyId, companyId)));
    return contact;
  }

  async updateContact(id: number, companyId: number, data: Partial<InsertContact>): Promise<Contact | undefined> {
    const [contact] = await db
      .update(contacts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.companyId, companyId)))
      .returning();
    return contact;
  }

  async deleteContact(id: number, companyId: number): Promise<void> {
    await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.companyId, companyId)));
  }

  async createDeal(data: InsertDeal): Promise<Deal> {
    const [deal] = await db.insert(deals).values(data).returning();
    return deal;
  }

  async getDeals(companyId: number): Promise<Deal[]> {
    return db.select().from(deals).where(eq(deals.companyId, companyId)).orderBy(desc(deals.createdAt));
  }

  async getDeal(id: number, companyId: number): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(and(eq(deals.id, id), eq(deals.companyId, companyId)));
    return deal;
  }

  async updateDeal(id: number, companyId: number, data: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [deal] = await db
      .update(deals)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(deals.id, id), eq(deals.companyId, companyId)))
      .returning();
    return deal;
  }

  async deleteDeal(id: number, companyId: number): Promise<void> {
    await db.delete(deals).where(and(eq(deals.id, id), eq(deals.companyId, companyId)));
  }

  async createActivity(data: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(activities).values(data).returning();
    return activity;
  }

  async getActivities(companyId: number, limit = 50, entityType?: string): Promise<Activity[]> {
    const conditions = [eq(activities.companyId, companyId)];
    if (entityType) {
      conditions.push(eq(activities.entityType, entityType));
    }
    return db.select().from(activities).where(and(...conditions)).orderBy(desc(activities.createdAt)).limit(limit);
  }

  async getLeadActivities(companyId: number, leadId: number): Promise<Activity[]> {
    return db.select().from(activities)
      .where(and(
        eq(activities.companyId, companyId),
        eq(activities.entityType, "lead"),
        eq(activities.entityId, leadId)
      ))
      .orderBy(desc(activities.createdAt));
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async getTasks(companyId: number): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.companyId, companyId)).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: number, companyId: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.companyId, companyId)));
    return task;
  }

  async updateTask(id: number, companyId: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.companyId, companyId)))
      .returning();
    return task;
  }

  async deleteTask(id: number, companyId: number): Promise<void> {
    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.companyId, companyId)));
  }

  async getDashboardStats(companyId: number): Promise<any> {
    const [leadCount] = await db.select({ count: count() }).from(leads).where(eq(leads.companyId, companyId));
    const [contactCount] = await db.select({ count: count() }).from(contacts).where(eq(contacts.companyId, companyId));
    const [dealCount] = await db.select({ count: count() }).from(deals).where(eq(deals.companyId, companyId));
    const [taskCount] = await db.select({ count: count() }).from(tasks).where(and(eq(tasks.companyId, companyId), eq(tasks.status, "pending")));

    const allDeals = await db.select().from(deals).where(eq(deals.companyId, companyId));
    const totalRevenue = allDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const wonDeals = allDeals.filter(d => d.status === "won").length;
    const conversionRate = allDeals.length > 0 ? Math.round((wonDeals / allDeals.length) * 100) : 0;

    const allLeads = await db.select().from(leads).where(eq(leads.companyId, companyId));
    const sourceMap: Record<string, number> = {};
    allLeads.forEach(l => {
      const src = l.source || "Direct";
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const leadsBySource = Object.entries(sourceMap).map(([name, value]) => ({ name, value }));

    const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.companyId, companyId)).orderBy(pipelineStages.order);
    const dealsByStage = stages.map(s => ({
      name: s.name,
      value: allDeals.filter(d => d.stageId === s.id).length,
      color: s.color || "#1565C0",
    }));

    const baseRevenue = totalRevenue || 100000;
    const revenueByMonth = [
      { month: "Jan", revenue: Math.round(baseRevenue * 0.14) },
      { month: "Feb", revenue: Math.round(baseRevenue * 0.18) },
      { month: "Mar", revenue: Math.round(baseRevenue * 0.22) },
      { month: "Apr", revenue: Math.round(baseRevenue * 0.26) },
      { month: "May", revenue: Math.round(baseRevenue * 0.30) },
      { month: "Jun", revenue: Math.round(baseRevenue * 0.35) },
    ];

    const recentActivities = await this.getActivities(companyId, 8);

    const avgAiScore = allLeads.length > 0
      ? Math.round(allLeads.reduce((s, l) => s + Number(l.aiScore || 0), 0) / allLeads.length)
      : 0;
    const predictedPipeline = allDeals
      .filter(d => d.status === "open")
      .reduce((s, d) => s + Number(d.aiForecastAmount || 0), 0);

    return {
      totalLeads: leadCount.count,
      totalContacts: contactCount.count,
      totalDeals: dealCount.count,
      totalTasks: taskCount.count,
      totalRevenue,
      conversionRate,
      leadsBySource,
      dealsByStage,
      revenueByMonth,
      recentActivities,
      avgAiScore,
      predictedPipeline,
    };
  }

  async getAiSettings(companyId: number): Promise<AiSettings | undefined> {
    const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.companyId, companyId));
    return settings;
  }

  async upsertAiSettings(companyId: number, data: Partial<InsertAiSettings>): Promise<AiSettings> {
    const existing = await this.getAiSettings(companyId);
    if (existing) {
      const [updated] = await db
        .update(aiSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(aiSettings.companyId, companyId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(aiSettings).values({ ...data, companyId } as InsertAiSettings).returning();
    return created;
  }

  async getAutomationRules(companyId: number): Promise<AutomationRule[]> {
    return db.select().from(automationRules).where(eq(automationRules.companyId, companyId)).orderBy(desc(automationRules.createdAt));
  }

  async createAutomationRule(data: InsertAutomationRule): Promise<AutomationRule> {
    const [rule] = await db.insert(automationRules).values(data).returning();
    return rule;
  }

  async updateAutomationRule(id: number, companyId: number, data: Partial<InsertAutomationRule>): Promise<AutomationRule | undefined> {
    const [rule] = await db
      .update(automationRules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(automationRules.id, id), eq(automationRules.companyId, companyId)))
      .returning();
    return rule;
  }

  async deleteAutomationRule(id: number, companyId: number): Promise<void> {
    await db.delete(automationRules).where(and(eq(automationRules.id, id), eq(automationRules.companyId, companyId)));
  }

  async getAiInsights(companyId: number): Promise<AiInsight[]> {
    return db.select().from(aiInsights).where(eq(aiInsights.companyId, companyId)).orderBy(desc(aiInsights.createdAt));
  }

  async markInsightRead(id: number, companyId: number): Promise<AiInsight | undefined> {
    const [insight] = await db
      .update(aiInsights)
      .set({ isRead: true })
      .where(and(eq(aiInsights.id, id), eq(aiInsights.companyId, companyId)))
      .returning();
    return insight;
  }

  async getSubscriptionPlans(activeOnly = true): Promise<SubscriptionPlan[]> {
    if (activeOnly) {
      return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true)).orderBy(subscriptionPlans.sortOrder);
    }
    return db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
  }

  async getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async createSubscriptionPlan(data: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [plan] = await db.insert(subscriptionPlans).values(data).returning();
    return plan;
  }

  async updateSubscriptionPlan(id: number, data: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db
      .update(subscriptionPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return plan;
  }

  async getCompanySubscription(companyId: number): Promise<CompanySubscription | undefined> {
    const [sub] = await db.select().from(companySubscriptions)
      .where(eq(companySubscriptions.companyId, companyId))
      .orderBy(desc(companySubscriptions.createdAt))
      .limit(1);
    return sub;
  }

  async createCompanySubscription(data: InsertCompanySubscription): Promise<CompanySubscription> {
    const [sub] = await db.insert(companySubscriptions).values(data).returning();
    return sub;
  }

  async updateCompanySubscription(id: number, data: Partial<InsertCompanySubscription>): Promise<CompanySubscription | undefined> {
    const [sub] = await db
      .update(companySubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companySubscriptions.id, id))
      .returning();
    return sub;
  }

  async getPaymentTransactions(companyId: number): Promise<PaymentTransaction[]> {
    return db.select().from(paymentTransactions)
      .where(eq(paymentTransactions.companyId, companyId))
      .orderBy(desc(paymentTransactions.createdAt));
  }

  async createPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction> {
    const [tx] = await db.insert(paymentTransactions).values(data).returning();
    return tx;
  }

  async updatePaymentTransaction(id: number, data: Partial<{ status: string; transactionId: string; metadata: any }>): Promise<PaymentTransaction | undefined> {
    const [tx] = await db
      .update(paymentTransactions)
      .set(data)
      .where(eq(paymentTransactions.id, id))
      .returning();
    return tx;
  }

  async getFeatureUsage(companyId: number, featureName: string): Promise<FeatureUsage | undefined> {
    const [usage] = await db.select().from(featureUsage)
      .where(and(eq(featureUsage.companyId, companyId), eq(featureUsage.featureName, featureName)));
    return usage;
  }

  async incrementFeatureUsage(companyId: number, featureName: string): Promise<FeatureUsage> {
    const existing = await this.getFeatureUsage(companyId, featureName);
    if (existing) {
      const [updated] = await db
        .update(featureUsage)
        .set({ usageCount: existing.usageCount + 1, updatedAt: new Date() })
        .where(eq(featureUsage.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(featureUsage).values({
      companyId,
      featureName,
      usageCount: 1,
      resetDate: new Date(),
    }).returning();
    return created;
  }

  async resetFeatureUsage(companyId: number): Promise<void> {
    await db.update(featureUsage)
      .set({ usageCount: 0, resetDate: new Date(), updatedAt: new Date() })
      .where(eq(featureUsage.companyId, companyId));
  }

  async getCompanyUsageSummary(companyId: number): Promise<Record<string, number>> {
    const [userCount] = await db.select({ count: count() }).from(users).where(and(eq(users.companyId, companyId), eq(users.isActive, true)));
    const [leadCount] = await db.select({ count: count() }).from(leads).where(eq(leads.companyId, companyId));
    const [contactCount] = await db.select({ count: count() }).from(contacts).where(eq(contacts.companyId, companyId));
    const [dealCount] = await db.select({ count: count() }).from(deals).where(eq(deals.companyId, companyId));
    const allUsage = await db.select().from(featureUsage).where(eq(featureUsage.companyId, companyId));
    const aiUsage = allUsage.find(u => u.featureName === "ai_usage")?.usageCount || 0;
    return {
      users: userCount.count,
      leads: leadCount.count,
      contacts: contactCount.count,
      deals: dealCount.count,
      ai_usage: aiUsage,
      storage_mb: 0,
    };
  }
  async getWhatsappSettings(companyId: number): Promise<WhatsappSettings | undefined> {
    const [settings] = await db.select().from(whatsappSettings).where(eq(whatsappSettings.companyId, companyId));
    return settings;
  }

  async upsertWhatsappSettings(companyId: number, data: Partial<InsertWhatsappSettings>): Promise<WhatsappSettings> {
    const existing = await this.getWhatsappSettings(companyId);
    if (existing) {
      const [updated] = await db.update(whatsappSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(whatsappSettings.companyId, companyId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(whatsappSettings)
      .values({ ...data, companyId })
      .returning();
    return created;
  }

  async getWhatsappMessages(companyId: number, phoneNumber?: string): Promise<WhatsappMessage[]> {
    if (phoneNumber) {
      return db.select().from(whatsappMessages)
        .where(and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.phoneNumber, phoneNumber)))
        .orderBy(desc(whatsappMessages.createdAt));
    }
    return db.select().from(whatsappMessages)
      .where(eq(whatsappMessages.companyId, companyId))
      .orderBy(desc(whatsappMessages.createdAt));
  }

  async createWhatsappMessage(data: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [msg] = await db.insert(whatsappMessages).values(data).returning();
    return msg;
  }

  async getWhatsappContacts(companyId: number): Promise<WhatsappContact[]> {
    return db.select().from(whatsappContacts)
      .where(eq(whatsappContacts.companyId, companyId))
      .orderBy(desc(whatsappContacts.lastMessageAt));
  }

  async getWhatsappContact(id: number, companyId: number): Promise<WhatsappContact | undefined> {
    const [contact] = await db.select().from(whatsappContacts)
      .where(and(eq(whatsappContacts.id, id), eq(whatsappContacts.companyId, companyId)));
    return contact;
  }

  async createWhatsappContact(data: InsertWhatsappContact): Promise<WhatsappContact> {
    const [contact] = await db.insert(whatsappContacts).values(data).returning();
    return contact;
  }

  async updateWhatsappContact(id: number, companyId: number, data: Partial<InsertWhatsappContact>): Promise<WhatsappContact | undefined> {
    const [contact] = await db.update(whatsappContacts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(whatsappContacts.id, id), eq(whatsappContacts.companyId, companyId)))
      .returning();
    return contact;
  }

  async deleteWhatsappContact(id: number, companyId: number): Promise<void> {
    await db.delete(whatsappContacts)
      .where(and(eq(whatsappContacts.id, id), eq(whatsappContacts.companyId, companyId)));
  }

  async getWhatsappCommandLogs(companyId: number): Promise<WhatsappCommandLog[]> {
    return db.select().from(whatsappCommandLogs)
      .where(eq(whatsappCommandLogs.companyId, companyId))
      .orderBy(desc(whatsappCommandLogs.createdAt));
  }

  async createWhatsappCommandLog(data: InsertWhatsappCommandLog): Promise<WhatsappCommandLog> {
    const [log] = await db.insert(whatsappCommandLogs).values(data).returning();
    return log;
  }

  async getAllCompanies(includeArchived = false): Promise<Company[]> {
    if (includeArchived) {
      return db.select().from(companies).orderBy(desc(companies.createdAt));
    }
    return db.select().from(companies).where(eq(companies.isArchived, false)).orderBy(desc(companies.createdAt));
  }

  async getArchivedCompanies(): Promise<Company[]> {
    return db.select().from(companies).where(eq(companies.isArchived, true)).orderBy(desc(companies.archivedAt));
  }

  async archiveCompany(id: number): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  async restoreCompany(id: number): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set({ isArchived: false, archivedAt: null, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  async createTenantWithPlan(data: { company: InsertCompany; admin: { username: string; password: string; email: string; fullName: string }; planId: number }): Promise<{ company: Company; user: User; subscription: CompanySubscription }> {
    return db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values(data.company).returning();
      const [user] = await tx.insert(users).values({
        companyId: company.id,
        username: data.admin.username,
        password: data.admin.password,
        email: data.admin.email,
        fullName: data.admin.fullName,
        role: "company_admin",
      }).returning();
      const [subscription] = await tx.insert(companySubscriptions).values({
        companyId: company.id,
        planId: data.planId,
        status: "active",
        billingCycle: "monthly",
        startDate: new Date(),
      }).returning();
      await tx.insert(pipelineStages).values([
        { companyId: company.id, name: "Qualification", order: 1, probability: 20, color: "#1565C0" },
        { companyId: company.id, name: "Proposal", order: 2, probability: 50, color: "#2196F3" },
        { companyId: company.id, name: "Negotiation", order: 3, probability: 70, color: "#FF9800" },
        { companyId: company.id, name: "Closed Won", order: 4, probability: 100, color: "#4CAF50" },
        { companyId: company.id, name: "Closed Lost", order: 5, probability: 0, color: "#F44336" },
      ]);
      return { company, user, subscription };
    });
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteCompany(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(companyFeatureOverrides).where(eq(companyFeatureOverrides.companyId, id));
      await tx.delete(whatsappCommandLogs).where(eq(whatsappCommandLogs.companyId, id));
      await tx.delete(whatsappMessages).where(eq(whatsappMessages.companyId, id));
      await tx.delete(whatsappContacts).where(eq(whatsappContacts.companyId, id));
      await tx.delete(whatsappSettings).where(eq(whatsappSettings.companyId, id));
      await tx.delete(activities).where(eq(activities.companyId, id));
      await tx.delete(tasks).where(eq(tasks.companyId, id));
      await tx.delete(deals).where(eq(deals.companyId, id));
      await tx.delete(contacts).where(eq(contacts.companyId, id));
      await tx.delete(leads).where(eq(leads.companyId, id));
      await tx.delete(pipelineStages).where(eq(pipelineStages.companyId, id));
      await tx.delete(featureUsage).where(eq(featureUsage.companyId, id));
      await tx.delete(aiInsights).where(eq(aiInsights.companyId, id));
      await tx.delete(aiUsageLogs).where(eq(aiUsageLogs.companyId, id));
      await tx.delete(aiSettings).where(eq(aiSettings.companyId, id));
      await tx.delete(automationRules).where(eq(automationRules.companyId, id));
      const subs = await tx.select().from(companySubscriptions).where(eq(companySubscriptions.companyId, id));
      for (const sub of subs) {
        await tx.delete(paymentTransactions).where(eq(paymentTransactions.subscriptionId, sub.id));
      }
      await tx.delete(paymentTransactions).where(eq(paymentTransactions.companyId, id));
      await tx.delete(companySubscriptions).where(eq(companySubscriptions.companyId, id));
      await tx.delete(users).where(eq(users.companyId, id));
      await tx.delete(companies).where(eq(companies.id, id));
    });
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getAllSubscriptions(): Promise<CompanySubscription[]> {
    return db.select().from(companySubscriptions).orderBy(desc(companySubscriptions.createdAt));
  }

  async deleteSubscriptionPlan(id: number): Promise<void> {
    await db.update(subscriptionPlans).set({ isActive: false }).where(eq(subscriptionPlans.id, id));
  }

  async getPlatformStats(): Promise<{ totalTenants: number; totalUsers: number; activeSubscriptions: number; monthlyRevenue: number }> {
    const [tenantCount] = await db.select({ count: count() }).from(companies);
    const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.isActive, true));
    const [activeSubCount] = await db.select({ count: count() }).from(companySubscriptions)
      .where(sql`${companySubscriptions.status} IN ('active', 'trial')`);
    const revenueResult = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${paymentTransactions.amount} AS numeric)), 0)`
    }).from(paymentTransactions).where(eq(paymentTransactions.status, "completed"));
    return {
      totalTenants: tenantCount.count,
      totalUsers: userCount.count,
      activeSubscriptions: activeSubCount.count,
      monthlyRevenue: Number(revenueResult[0]?.total || 0),
    };
  }

  async getModules(): Promise<ModuleRegistry[]> {
    return db.select().from(moduleRegistry).orderBy(asc(moduleRegistry.sortOrder));
  }

  async getModule(id: number): Promise<ModuleRegistry | undefined> {
    const [m] = await db.select().from(moduleRegistry).where(eq(moduleRegistry.id, id));
    return m;
  }

  async createModule(data: InsertModuleRegistry): Promise<ModuleRegistry> {
    const [m] = await db.insert(moduleRegistry).values(data).returning();
    return m;
  }

  async updateModule(id: number, data: Partial<InsertModuleRegistry>): Promise<ModuleRegistry | undefined> {
    const [m] = await db.update(moduleRegistry).set(data).where(eq(moduleRegistry.id, id)).returning();
    return m;
  }

  async getFeatures(): Promise<FeatureRegistry[]> {
    return db.select().from(featureRegistry).orderBy(asc(featureRegistry.id));
  }

  async getFeaturesByModule(moduleId: number): Promise<FeatureRegistry[]> {
    return db.select().from(featureRegistry).where(eq(featureRegistry.moduleId, moduleId));
  }

  async createFeature(data: InsertFeatureRegistry): Promise<FeatureRegistry> {
    const [f] = await db.insert(featureRegistry).values(data).returning();
    return f;
  }

  async updateFeature(id: number, data: Partial<InsertFeatureRegistry>): Promise<FeatureRegistry | undefined> {
    const [f] = await db.update(featureRegistry).set(data).where(eq(featureRegistry.id, id)).returning();
    return f;
  }

  async getPackageFeatures(planId: number): Promise<PackageFeature[]> {
    return db.select().from(packageFeatures).where(eq(packageFeatures.planId, planId));
  }

  async getAllPackageFeatures(): Promise<PackageFeature[]> {
    return db.select().from(packageFeatures);
  }

  async upsertPackageFeature(data: InsertPackageFeature): Promise<PackageFeature> {
    const existing = await db.select().from(packageFeatures)
      .where(and(eq(packageFeatures.planId, data.planId), eq(packageFeatures.featureId, data.featureId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(packageFeatures)
        .set({ isEnabled: data.isEnabled, limitValue: data.limitValue })
        .where(eq(packageFeatures.id, existing[0].id))
        .returning();
      return updated;
    }

    const [pf] = await db.insert(packageFeatures).values(data).returning();
    return pf;
  }

  async deletePackageFeature(planId: number, featureId: number): Promise<void> {
    await db.delete(packageFeatures)
      .where(and(eq(packageFeatures.planId, planId), eq(packageFeatures.featureId, featureId)));
  }

  async setPackageFeaturesForPlan(planId: number, features: InsertPackageFeature[]): Promise<void> {
    await db.delete(packageFeatures).where(eq(packageFeatures.planId, planId));
    if (features.length > 0) {
      await db.insert(packageFeatures).values(features);
    }
  }

  async getCompanyFeatureOverrides(companyId: number): Promise<CompanyFeatureOverride[]> {
    return db.select().from(companyFeatureOverrides)
      .where(eq(companyFeatureOverrides.companyId, companyId));
  }

  async upsertCompanyFeatureOverride(data: InsertCompanyFeatureOverride): Promise<CompanyFeatureOverride> {
    const existing = await db.select().from(companyFeatureOverrides)
      .where(and(
        eq(companyFeatureOverrides.companyId, data.companyId),
        eq(companyFeatureOverrides.featureId, data.featureId)
      ))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(companyFeatureOverrides)
        .set({ isEnabled: data.isEnabled, customLimit: data.customLimit, updatedAt: new Date() })
        .where(eq(companyFeatureOverrides.id, existing[0].id))
        .returning();
      return updated;
    }

    const [override] = await db.insert(companyFeatureOverrides).values(data).returning();
    return override;
  }

  async deleteCompanyFeatureOverride(companyId: number, featureId: number): Promise<void> {
    await db.delete(companyFeatureOverrides)
      .where(and(
        eq(companyFeatureOverrides.companyId, companyId),
        eq(companyFeatureOverrides.featureId, featureId)
      ));
  }

  async getIntegrationApps(activeOnly = true): Promise<IntegrationApp[]> {
    if (activeOnly) {
      return db.select().from(integrationApps).where(eq(integrationApps.isActive, true)).orderBy(asc(integrationApps.category), asc(integrationApps.name));
    }
    return db.select().from(integrationApps).orderBy(asc(integrationApps.category), asc(integrationApps.name));
  }

  async getIntegrationApp(id: number): Promise<IntegrationApp | undefined> {
    const [app] = await db.select().from(integrationApps).where(eq(integrationApps.id, id)).limit(1);
    return app;
  }

  async createIntegrationApp(data: InsertIntegrationApp): Promise<IntegrationApp> {
    const [app] = await db.insert(integrationApps).values(data).returning();
    return app;
  }

  async updateIntegrationApp(id: number, data: Partial<InsertIntegrationApp>): Promise<IntegrationApp | undefined> {
    const [app] = await db.update(integrationApps).set(data).where(eq(integrationApps.id, id)).returning();
    return app;
  }

  async getCompanyIntegrations(companyId: number): Promise<CompanyIntegration[]> {
    return db.select().from(companyIntegrations)
      .where(eq(companyIntegrations.companyId, companyId))
      .orderBy(desc(companyIntegrations.createdAt));
  }

  async getCompanyIntegration(id: number, companyId: number): Promise<CompanyIntegration | undefined> {
    const [ci] = await db.select().from(companyIntegrations)
      .where(and(eq(companyIntegrations.id, id), eq(companyIntegrations.companyId, companyId)))
      .limit(1);
    return ci;
  }

  async connectIntegration(data: InsertCompanyIntegration): Promise<CompanyIntegration> {
    const [ci] = await db.insert(companyIntegrations).values(data).returning();
    return ci;
  }

  async updateCompanyIntegration(id: number, companyId: number, data: Partial<InsertCompanyIntegration>): Promise<CompanyIntegration | undefined> {
    const [ci] = await db.update(companyIntegrations)
      .set(data)
      .where(and(eq(companyIntegrations.id, id), eq(companyIntegrations.companyId, companyId)))
      .returning();
    return ci;
  }

  async disconnectIntegration(id: number, companyId: number): Promise<void> {
    await db.update(integrationLogs)
      .set({ companyIntegrationId: null })
      .where(eq(integrationLogs.companyIntegrationId, id));
    await db.delete(companyIntegrations)
      .where(and(eq(companyIntegrations.id, id), eq(companyIntegrations.companyId, companyId)));
  }

  async getIntegrationLogs(companyId: number, integrationAppId?: number): Promise<IntegrationLog[]> {
    if (integrationAppId) {
      return db.select().from(integrationLogs)
        .where(and(eq(integrationLogs.companyId, companyId), eq(integrationLogs.integrationAppId, integrationAppId)))
        .orderBy(desc(integrationLogs.createdAt))
        .limit(100);
    }
    return db.select().from(integrationLogs)
      .where(eq(integrationLogs.companyId, companyId))
      .orderBy(desc(integrationLogs.createdAt))
      .limit(100);
  }

  async createIntegrationLog(data: InsertIntegrationLog): Promise<IntegrationLog> {
    const [log] = await db.insert(integrationLogs).values(data).returning();
    return log;
  }
}

export const storage = new DatabaseStorage();
