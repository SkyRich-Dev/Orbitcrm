import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, serial, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type BrandingSettings = {
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;
  sidebarColor?: string;
  buttonColor?: string;
  crmTitle?: string;
  loginPageTitle?: string;
  footerText?: string;
  customCss?: string;
};

export type HomepageSettings = {
  welcomeMessage?: string;
  heroImage?: string;
  backgroundImage?: string;
  helpLinks?: { label: string; url: string }[];
  contactInfo?: string;
  supportEmail?: string;
};

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  subdomain: text("subdomain").unique(),
  domainStatus: text("domain_status").default("pending"),
  logo: text("logo"),
  primaryColor: text("primary_color").default("#1565C0"),
  brandingSettings: jsonb("branding_settings").$type<BrandingSettings>(),
  homepageSettings: jsonb("homepage_settings").$type<HomepageSettings>(),
  industry: text("industry"),
  website: text("website"),
  phone: text("phone"),
  address: text("address"),
  isArchived: boolean("is_archived").default(false).notNull(),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("sales_executive"),
  avatar: text("avatar"),
  permissions: jsonb("permissions").$type<Record<string, boolean>>(),
  isActive: boolean("is_active").default(true).notNull(),
  themePreference: text("theme_preference").default("light"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pipelineStages = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  probability: integer("probability").default(0),
  color: text("color").default("#1565C0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  title: text("title").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  source: text("source"),
  stageId: integer("stage_id").references(() => pipelineStages.id),
  score: integer("score").default(0),
  value: decimal("value", { precision: 12, scale: 2 }).default("0"),
  assignedTo: integer("assigned_to").references(() => users.id),
  status: text("status").default("new"),
  priority: text("priority").default("medium"),
  expectedCloseDate: timestamp("expected_close_date"),
  notes: text("notes"),
  tags: text("tags").array(),
  createdBy: integer("created_by").references(() => users.id),
  aiScore: decimal("ai_score", { precision: 5, scale: 2 }),
  aiProbability: decimal("ai_probability", { precision: 5, scale: 2 }),
  aiRecommendation: text("ai_recommendation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  jobTitle: text("job_title"),
  avatar: text("avatar"),
  tags: text("tags").array(),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  title: text("title").notNull(),
  value: decimal("value", { precision: 12, scale: 2 }).default("0"),
  stageId: integer("stage_id").references(() => pipelineStages.id),
  contactId: integer("contact_id").references(() => contacts.id),
  leadId: integer("lead_id").references(() => leads.id),
  assignedTo: integer("assigned_to").references(() => users.id),
  expectedCloseDate: timestamp("expected_close_date"),
  status: text("status").default("open"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  aiCloseProbability: decimal("ai_close_probability", { precision: 5, scale: 2 }),
  aiForecastAmount: decimal("ai_forecast_amount", { precision: 12, scale: 2 }),
  aiNextAction: text("ai_next_action"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  userId: integer("user_id").references(() => users.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  priority: text("priority").default("medium"),
  status: text("status").default("pending"),
  assignedTo: integer("assigned_to").references(() => users.id),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  createdBy: integer("created_by").references(() => users.id),
  autoGenerated: boolean("auto_generated").default(false),
  aiReason: text("ai_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiSettings = pgTable("ai_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull().unique(),
  enableAi: boolean("enable_ai").default(true).notNull(),
  enableLeadScoring: boolean("enable_lead_scoring").default(true).notNull(),
  enableSalesPrediction: boolean("enable_sales_prediction").default(true).notNull(),
  enableTaskAutomation: boolean("enable_task_automation").default(true).notNull(),
  enableInsights: boolean("enable_insights").default(true).notNull(),
  monthlyUsageLimit: integer("monthly_usage_limit").default(1000).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const automationRules = pgTable("automation_rules", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(),
  conditions: jsonb("conditions"),
  actions: jsonb("actions"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  insightType: text("insight_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").default("info").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  feature: text("feature").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").default("USD").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  features: jsonb("features").notNull().default({}),
  limits: jsonb("limits").notNull().default({}),
  sortOrder: integer("sort_order").default(0).notNull(),
  stripePriceMonthlyId: text("stripe_price_monthly_id"),
  stripePriceYearlyId: text("stripe_price_yearly_id"),
  razorpayPlanMonthlyId: text("razorpay_plan_monthly_id"),
  razorpayPlanYearlyId: text("razorpay_plan_yearly_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companySubscriptions = pgTable("company_subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  planId: integer("plan_id").references(() => subscriptionPlans.id).notNull(),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("trial"),
  gateway: text("gateway"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  razorpayCustomerId: text("razorpay_customer_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  nextBillingDate: timestamp("next_billing_date"),
  autoRenew: boolean("auto_renew").default(true).notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  subscriptionId: integer("subscription_id").references(() => companySubscriptions.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  gateway: text("gateway").notNull(),
  transactionId: text("transaction_id"),
  status: text("status").notNull().default("pending"),
  invoiceReference: text("invoice_reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const featureUsage = pgTable("feature_usage", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  featureName: text("feature_name").notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  resetDate: timestamp("reset_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whatsappSettings = pgTable("whatsapp_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  provider: text("provider").default("whatsapp_business"),
  apiKey: text("api_key"),
  webhookUrl: text("webhook_url"),
  businessNumber: text("business_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  contactId: integer("contact_id").references(() => contacts.id),
  employeeId: integer("employee_id").references(() => users.id),
  direction: text("direction").notNull(),
  messageText: text("message_text"),
  attachmentUrl: text("attachment_url"),
  externalMessageId: text("external_message_id"),
  status: text("status").default("sent").notNull(),
  phoneNumber: text("phone_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const whatsappContacts = pgTable("whatsapp_contacts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  contactId: integer("contact_id").references(() => contacts.id),
  phoneNumber: text("phone_number").notNull(),
  whatsappName: text("whatsapp_name"),
  lastMessageAt: timestamp("last_message_at"),
  conversationStatus: text("conversation_status").default("open").notNull(),
  assignedTo: integer("assigned_to").references(() => users.id),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whatsappCommandLogs = pgTable("whatsapp_command_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  employeeId: integer("employee_id").references(() => users.id),
  command: text("command").notNull(),
  rawMessage: text("raw_message").notNull(),
  result: text("result"),
  success: boolean("success").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const integrationApps = pgTable("integration_apps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  providerName: text("provider_name").notNull(),
  description: text("description"),
  icon: text("icon"),
  authType: text("auth_type").notNull().default("api_key"),
  configSchema: jsonb("config_schema").$type<{ fields: Array<{ name: string; type: string; label: string; required?: boolean; placeholder?: string }> }>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companyIntegrations = pgTable("company_integrations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  integrationAppId: integer("integration_app_id").references(() => integrationApps.id).notNull(),
  status: text("status").default("active").notNull(),
  credentials: jsonb("credentials").$type<Record<string, string>>(),
  configSettings: jsonb("config_settings").$type<Record<string, any>>(),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const integrationLogs = pgTable("integration_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  integrationAppId: integer("integration_app_id").references(() => integrationApps.id).notNull(),
  companyIntegrationId: integer("company_integration_id").references(() => companyIntegrations.id),
  actionType: text("action_type").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const moduleRegistry = pgTable("module_registry", {
  id: serial("id").primaryKey(),
  moduleKey: text("module_key").notNull().unique(),
  moduleName: text("module_name").notNull(),
  moduleDescription: text("module_description"),
  moduleIcon: text("module_icon"),
  routePath: text("route_path"),
  isCore: boolean("is_core").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const featureRegistry = pgTable("feature_registry", {
  id: serial("id").primaryKey(),
  featureKey: text("feature_key").notNull().unique(),
  featureName: text("feature_name").notNull(),
  moduleId: integer("module_id").references(() => moduleRegistry.id).notNull(),
  description: text("description"),
  defaultEnabled: boolean("default_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const packageFeatures = pgTable("package_features", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").references(() => subscriptionPlans.id).notNull(),
  featureId: integer("feature_id").references(() => featureRegistry.id).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  limitValue: integer("limit_value"),
});

export const companyFeatureOverrides = pgTable("company_feature_overrides", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  featureId: integer("feature_id").references(() => featureRegistry.id).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  customLimit: integer("custom_limit"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIntegrationAppSchema = createInsertSchema(integrationApps).omit({ id: true, createdAt: true });
export const insertCompanyIntegrationSchema = createInsertSchema(companyIntegrations).omit({ id: true, createdAt: true });
export const insertIntegrationLogSchema = createInsertSchema(integrationLogs).omit({ id: true, createdAt: true });

export const insertModuleRegistrySchema = createInsertSchema(moduleRegistry).omit({ id: true, createdAt: true });
export const insertFeatureRegistrySchema = createInsertSchema(featureRegistry).omit({ id: true, createdAt: true });
export const insertPackageFeatureSchema = createInsertSchema(packageFeatures).omit({ id: true });
export const insertCompanyFeatureOverrideSchema = createInsertSchema(companyFeatureOverrides).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWhatsappSettingsSchema = createInsertSchema(whatsappSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({ id: true, createdAt: true });
export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWhatsappCommandLogSchema = createInsertSchema(whatsappCommandLogs).omit({ id: true, createdAt: true });

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiSettingsSchema = createInsertSchema(aiSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAutomationRuleSchema = createInsertSchema(automationRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiInsightSchema = createInsertSchema(aiInsights).omit({ id: true, createdAt: true });
export const insertAiUsageLogSchema = createInsertSchema(aiUsageLogs).omit({ id: true, createdAt: true });
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCompanySubscriptionSchema = createInsertSchema(companySubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({ id: true, createdAt: true });
export const insertFeatureUsageSchema = createInsertSchema(featureUsage).omit({ id: true, createdAt: true, updatedAt: true });

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type AiSettings = typeof aiSettings.$inferSelect;
export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>;
export type AutomationRule = typeof automationRules.$inferSelect;
export type InsertAutomationRule = z.infer<typeof insertAutomationRuleSchema>;
export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;
export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type CompanySubscription = typeof companySubscriptions.$inferSelect;
export type InsertCompanySubscription = z.infer<typeof insertCompanySubscriptionSchema>;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type FeatureUsage = typeof featureUsage.$inferSelect;
export type InsertFeatureUsage = z.infer<typeof insertFeatureUsageSchema>;

export type ModuleRegistry = typeof moduleRegistry.$inferSelect;
export type InsertModuleRegistry = z.infer<typeof insertModuleRegistrySchema>;
export type FeatureRegistry = typeof featureRegistry.$inferSelect;
export type InsertFeatureRegistry = z.infer<typeof insertFeatureRegistrySchema>;
export type PackageFeature = typeof packageFeatures.$inferSelect;
export type InsertPackageFeature = z.infer<typeof insertPackageFeatureSchema>;
export type CompanyFeatureOverride = typeof companyFeatureOverrides.$inferSelect;
export type InsertCompanyFeatureOverride = z.infer<typeof insertCompanyFeatureOverrideSchema>;

export type IntegrationApp = typeof integrationApps.$inferSelect;
export type InsertIntegrationApp = z.infer<typeof insertIntegrationAppSchema>;
export type CompanyIntegration = typeof companyIntegrations.$inferSelect;
export type InsertCompanyIntegration = z.infer<typeof insertCompanyIntegrationSchema>;
export type IntegrationLog = typeof integrationLogs.$inferSelect;
export type InsertIntegrationLog = z.infer<typeof insertIntegrationLogSchema>;

export type WhatsappSettings = typeof whatsappSettings.$inferSelect;
export type InsertWhatsappSettings = z.infer<typeof insertWhatsappSettingsSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;
export type WhatsappCommandLog = typeof whatsappCommandLogs.$inferSelect;
export type InsertWhatsappCommandLog = z.infer<typeof insertWhatsappCommandLogSchema>;

export type PlanFeatures = {
  kanban_view?: boolean;
  calendar_view?: boolean;
  ai_scoring?: boolean;
  automation?: boolean;
  api_access?: boolean;
  activity_timeline?: boolean;
  lead_detail?: boolean;
  multi_view?: boolean;
  custom_pipeline?: boolean;
  export_data?: boolean;
};

export type PlanLimits = {
  max_users?: number;
  max_leads?: number;
  max_contacts?: number;
  max_deals?: number;
  max_storage_mb?: number;
  monthly_ai_usage?: number;
};

export const brandingSettingsSchema = z.object({
  logo: z.string().max(500).optional(),
  favicon: z.string().max(500).optional(),
  primaryColor: z.string().max(20).optional(),
  secondaryColor: z.string().max(20).optional(),
  sidebarColor: z.string().max(20).optional(),
  buttonColor: z.string().max(20).optional(),
  crmTitle: z.string().max(100).optional(),
  loginPageTitle: z.string().max(200).optional(),
  footerText: z.string().max(300).optional(),
  customCss: z.string().max(5000).optional(),
}).strict();

export const homepageSettingsSchema = z.object({
  welcomeMessage: z.string().max(500).optional(),
  heroImage: z.string().max(500).optional(),
  backgroundImage: z.string().max(500).optional(),
  helpLinks: z.array(z.object({ label: z.string().max(100), url: z.string().max(500) })).max(10).optional(),
  contactInfo: z.string().max(1000).optional(),
  supportEmail: z.string().max(200).optional(),
}).strict();

export const subdomainSchema = z.object({
  subdomain: z.string()
    .min(3, "Subdomain must be at least 3 characters")
    .max(40, "Subdomain must be at most 40 characters")
    .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, "Must start with a letter, end with letter/number, only lowercase letters, numbers, and hyphens")
    .refine(s => !s.includes("--"), "Cannot contain consecutive hyphens"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(1, "Full name is required"),
  companyName: z.string().min(1, "Company name is required"),
});

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
