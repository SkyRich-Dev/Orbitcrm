import { storage } from "./storage";
import { db } from "./db";
import { companies, users, subscriptionPlans, companySubscriptions, moduleRegistry, featureRegistry, packageFeatures, integrationApps } from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seedSuperAdmin() {
  const existingSuperAdmin = await db.select().from(users).where(eq(users.role, "super_admin")).limit(1);
  if (existingSuperAdmin.length > 0) return;

  const existingCompanies = await db.select().from(companies).limit(1);
  if (existingCompanies.length === 0) return;

  const hashedPassword = await hashPassword("admin123");
  await storage.createUser({
    companyId: existingCompanies[0].id,
    username: "superadmin",
    password: hashedPassword,
    email: "superadmin@skyrich.io",
    fullName: "Platform Admin",
    role: "super_admin",
  });
  console.log("Super admin seeded: superadmin / admin123");
}

export async function seedDatabase() {
  const existing = await db.select().from(companies).limit(1);
  if (existing.length > 0) {
    await seedSuperAdmin();
    await seedModulesAndFeatures();
    await seedIntegrationModule();
    await seedIntegrationApps();
    console.log("Database already seeded, skipping.");
    return;
  }

  console.log("Seeding database...");

  const company = await storage.createCompany({
    name: "SkyRich Technologies",
    slug: "skyrich-technologies",
    subdomain: "skyrich-technologies",
    domainStatus: "active",
    industry: "Technology",
    website: "https://skyrich.io",
    phone: "+1 (555) 100-2000",
    address: "100 Innovation Drive, San Francisco, CA 94105",
  });

  const stages = [
    { name: "New", order: 1, probability: 10, color: "#6366F1" },
    { name: "Qualified", order: 2, probability: 25, color: "#3B82F6" },
    { name: "Proposal", order: 3, probability: 50, color: "#F59E0B" },
    { name: "Negotiation", order: 4, probability: 75, color: "#F97316" },
    { name: "Won", order: 5, probability: 100, color: "#22C55E" },
  ];

  const createdStages = [];
  for (const stage of stages) {
    const s = await storage.createPipelineStage({ ...stage, companyId: company.id });
    createdStages.push(s);
  }

  const hashedPassword = await hashPassword("demo123");

  const admin = await storage.createUser({
    companyId: company.id,
    username: "admin",
    password: hashedPassword,
    email: "admin@skyrich.io",
    fullName: "Alex Rivera",
    role: "company_admin",
  });

  const salesMgr = await storage.createUser({
    companyId: company.id,
    username: "sarah",
    password: hashedPassword,
    email: "sarah@skyrich.io",
    fullName: "Sarah Chen",
    role: "sales_manager",
  });

  const seedLeads = [
    { title: "Enterprise SaaS License", firstName: "Michael", lastName: "Thompson", email: "michael.t@techcorp.com", phone: "+1 (555) 234-5678", company: "TechCorp Industries", source: "website", value: "45000", score: 85 },
    { title: "Annual Support Contract", firstName: "Jennifer", lastName: "Martinez", email: "j.martinez@globalretail.com", phone: "+1 (555) 345-6789", company: "Global Retail Co", source: "referral", value: "28000", score: 72 },
    { title: "Cloud Migration Project", firstName: "David", lastName: "Kim", email: "david.kim@innovatelab.io", phone: "+1 (555) 456-7890", company: "InnovateLab", source: "social", value: "120000", score: 91 },
    { title: "Data Analytics Platform", firstName: "Emma", lastName: "Wilson", email: "emma.w@dataprime.com", phone: "+1 (555) 567-8901", company: "DataPrime Solutions", source: "email", value: "65000", score: 58 },
    { title: "Security Audit Package", firstName: "Robert", lastName: "Johnson", email: "r.johnson@securenet.com", phone: "+1 (555) 678-9012", company: "SecureNet Corp", source: "cold_call", value: "35000", score: 44 },
    { title: "API Integration Suite", firstName: "Lisa", lastName: "Anderson", email: "lisa.a@connecthub.io", phone: "+1 (555) 789-0123", company: "ConnectHub", source: "event", value: "52000", score: 67 },
    { title: "Mobile App Development", firstName: "James", lastName: "Brown", email: "james.b@appworks.co", phone: "+1 (555) 890-1234", company: "AppWorks Studio", source: "website", value: "88000", score: 79 },
  ];

  for (let i = 0; i < seedLeads.length; i++) {
    const stageIdx = i < 2 ? 0 : i < 4 ? 1 : i < 5 ? 2 : i < 6 ? 3 : 4;
    await storage.createLead({
      ...seedLeads[i],
      companyId: company.id,
      stageId: createdStages[stageIdx].id,
      assignedTo: i % 2 === 0 ? admin.id : salesMgr.id,
      createdBy: admin.id,
      status: "active",
    });
  }

  const seedContacts = [
    { firstName: "Patricia", lastName: "Davis", email: "patricia@techcorp.com", phone: "+1 (555) 111-2222", company: "TechCorp Industries", jobTitle: "VP of Engineering" },
    { firstName: "William", lastName: "Garcia", email: "william.g@globalretail.com", phone: "+1 (555) 222-3333", company: "Global Retail Co", jobTitle: "CTO" },
    { firstName: "Amanda", lastName: "Lee", email: "amanda.lee@innovatelab.io", phone: "+1 (555) 333-4444", company: "InnovateLab", jobTitle: "Head of Operations" },
    { firstName: "Christopher", lastName: "Taylor", email: "chris.t@dataprime.com", phone: "+1 (555) 444-5555", company: "DataPrime Solutions", jobTitle: "Director of IT" },
    { firstName: "Michelle", lastName: "White", email: "m.white@securenet.com", phone: "+1 (555) 555-6666", company: "SecureNet Corp", jobTitle: "CISO" },
  ];

  for (const contact of seedContacts) {
    await storage.createContact({
      ...contact,
      companyId: company.id,
      createdBy: admin.id,
    });
  }

  const seedDeals = [
    { title: "TechCorp Enterprise Deal", value: "45000", status: "open" },
    { title: "Global Retail Annual Contract", value: "28000", status: "open" },
    { title: "InnovateLab Cloud Project", value: "120000", status: "open" },
    { title: "DataPrime Analytics", value: "65000", status: "won" },
    { title: "SecureNet Audit", value: "35000", status: "lost" },
  ];

  for (let i = 0; i < seedDeals.length; i++) {
    await storage.createDeal({
      ...seedDeals[i],
      companyId: company.id,
      stageId: createdStages[i].id,
      assignedTo: i % 2 === 0 ? admin.id : salesMgr.id,
      createdBy: admin.id,
    });
  }

  const seedTasks = [
    { title: "Follow up with TechCorp on proposal", description: "Send revised pricing and schedule demo", priority: "high", status: "pending" },
    { title: "Prepare Q4 sales report", description: "Compile revenue data and forecasts", priority: "medium", status: "pending" },
    { title: "Update CRM pipeline stages", description: "Review and optimize pipeline configuration", priority: "low", status: "completed" },
    { title: "Schedule discovery call with ConnectHub", description: "Discuss integration requirements", priority: "high", status: "pending" },
    { title: "Send welcome email to new contacts", description: "Onboard 3 new contacts this week", priority: "medium", status: "in_progress" },
  ];

  for (const task of seedTasks) {
    await storage.createTask({
      ...task,
      companyId: company.id,
      assignedTo: admin.id,
      createdBy: admin.id,
    });
  }

  const seedActivities = [
    { type: "lead_created", title: "New lead: Michael Thompson from TechCorp" },
    { type: "deal_created", title: "New deal: TechCorp Enterprise Deal ($45,000)" },
    { type: "contact_created", title: "New contact: Patricia Davis, VP of Engineering" },
    { type: "lead_created", title: "New lead: David Kim from InnovateLab" },
    { type: "deal_created", title: "Deal won: DataPrime Analytics ($65,000)" },
    { type: "lead_created", title: "New lead: James Brown from AppWorks Studio" },
  ];

  for (const activity of seedActivities) {
    await storage.createActivity({
      ...activity,
      companyId: company.id,
      userId: admin.id,
    });
  }

  const existingPlans = await db.select().from(subscriptionPlans).limit(1);
  if (existingPlans.length === 0) {
    const plans = [
      {
        name: "Free",
        description: "Get started with basic CRM features",
        priceMonthly: "0",
        priceYearly: "0",
        sortOrder: 1,
        features: {
          kanban_view: false,
          calendar_view: false,
          ai_scoring: false,
          automation: false,
          api_access: false,
          activity_timeline: true,
          lead_detail: true,
          multi_view: false,
          custom_pipeline: false,
          export_data: false,
        },
        limits: {
          max_users: 2,
          max_leads: 100,
          max_contacts: 50,
          max_deals: 25,
          max_storage_mb: 100,
          monthly_ai_usage: 0,
        },
      },
      {
        name: "Starter",
        description: "Essential tools for growing sales teams",
        priceMonthly: "29",
        priceYearly: "290",
        sortOrder: 2,
        features: {
          kanban_view: true,
          calendar_view: true,
          ai_scoring: false,
          automation: false,
          api_access: false,
          activity_timeline: true,
          lead_detail: true,
          multi_view: true,
          custom_pipeline: true,
          export_data: true,
        },
        limits: {
          max_users: 5,
          max_leads: 1000,
          max_contacts: 500,
          max_deals: 200,
          max_storage_mb: 1000,
          monthly_ai_usage: 50,
        },
      },
      {
        name: "Professional",
        description: "Advanced features with AI-powered insights",
        priceMonthly: "79",
        priceYearly: "790",
        sortOrder: 3,
        features: {
          kanban_view: true,
          calendar_view: true,
          ai_scoring: true,
          automation: true,
          api_access: true,
          activity_timeline: true,
          lead_detail: true,
          multi_view: true,
          custom_pipeline: true,
          export_data: true,
        },
        limits: {
          max_users: 25,
          max_leads: 10000,
          max_contacts: 5000,
          max_deals: 2000,
          max_storage_mb: 5000,
          monthly_ai_usage: 500,
        },
      },
      {
        name: "Enterprise",
        description: "Unlimited power for large organizations",
        priceMonthly: "199",
        priceYearly: "1990",
        sortOrder: 4,
        features: {
          kanban_view: true,
          calendar_view: true,
          ai_scoring: true,
          automation: true,
          api_access: true,
          activity_timeline: true,
          lead_detail: true,
          multi_view: true,
          custom_pipeline: true,
          export_data: true,
        },
        limits: {
          max_users: -1,
          max_leads: -1,
          max_contacts: -1,
          max_deals: -1,
          max_storage_mb: -1,
          monthly_ai_usage: -1,
        },
      },
    ];

    const createdPlans = [];
    for (const plan of plans) {
      const [p] = await db.insert(subscriptionPlans).values(plan).returning();
      createdPlans.push(p);
    }

    const existingSubs = await db.select().from(companySubscriptions).where(eq(companySubscriptions.companyId, company.id)).limit(1);
    if (existingSubs.length === 0) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      await db.insert(companySubscriptions).values({
        companyId: company.id,
        planId: createdPlans[2].id,
        billingCycle: "monthly",
        status: "trial",
        endDate: trialEnd,
        nextBillingDate: trialEnd,
      });
    }

    console.log("Billing plans seeded: Free, Starter, Professional, Enterprise");
    console.log("Company assigned Professional trial (14 days)");
  }

  await seedModulesAndFeatures();
  await seedIntegrationModule();
  await seedIntegrationApps();

  console.log("Database seeded successfully!");
  console.log("Demo credentials: admin / demo123");
}

async function seedModulesAndFeatures() {
  const existingModules = await db.select().from(moduleRegistry).limit(1);
  if (existingModules.length > 0) {
    console.log("Module registry already seeded, skipping.");
    return;
  }

  console.log("Seeding module and feature registry...");

  const moduleDefs = [
    { moduleKey: "dashboard", moduleName: "Dashboard", moduleDescription: "Main dashboard with KPIs and analytics", moduleIcon: "LayoutDashboard", routePath: "/", isCore: true, sortOrder: 1 },
    { moduleKey: "leads", moduleName: "Leads", moduleDescription: "Lead management and pipeline tracking", moduleIcon: "Users", routePath: "/leads", isCore: true, sortOrder: 2 },
    { moduleKey: "deals", moduleName: "Deals", moduleDescription: "Deal pipeline and revenue tracking", moduleIcon: "Handshake", routePath: "/deals", isCore: false, sortOrder: 3 },
    { moduleKey: "contacts", moduleName: "Contacts", moduleDescription: "Contact directory and relationship management", moduleIcon: "Contact2", routePath: "/contacts", isCore: true, sortOrder: 4 },
    { moduleKey: "tasks", moduleName: "Tasks", moduleDescription: "Task management and team collaboration", moduleIcon: "CheckSquare", routePath: "/tasks", isCore: true, sortOrder: 5 },
    { moduleKey: "whatsapp", moduleName: "WhatsApp", moduleDescription: "WhatsApp Business messaging integration", moduleIcon: "MessageSquare", routePath: "/whatsapp", isCore: false, sortOrder: 6 },
    { moduleKey: "automation", moduleName: "Automation", moduleDescription: "Workflow automation and rule engine", moduleIcon: "Zap", routePath: "/automation", isCore: false, sortOrder: 7 },
    { moduleKey: "ai", moduleName: "AI & Insights", moduleDescription: "AI-powered scoring, predictions, and insights", moduleIcon: "Brain", routePath: "/ai", isCore: false, sortOrder: 8 },
    { moduleKey: "billing", moduleName: "Billing", moduleDescription: "Subscription plans and billing management", moduleIcon: "CreditCard", routePath: "/billing", isCore: false, sortOrder: 9 },
    { moduleKey: "reports", moduleName: "Reports", moduleDescription: "Analytics, reports, and data export", moduleIcon: "BarChart3", routePath: "/reports", isCore: false, sortOrder: 10 },
    { moduleKey: "settings", moduleName: "Settings", moduleDescription: "Company settings and configuration", moduleIcon: "Settings", routePath: "/settings", isCore: true, sortOrder: 11 },
  ];

  const createdModules: Record<string, number> = {};
  for (const mod of moduleDefs) {
    const [m] = await db.insert(moduleRegistry).values(mod).returning();
    createdModules[mod.moduleKey] = m.id;
  }

  const featureDefs = [
    { featureKey: "lead_create", featureName: "Create Leads", moduleKey: "leads", description: "Ability to create new leads" },
    { featureKey: "lead_edit", featureName: "Edit Leads", moduleKey: "leads", description: "Ability to edit existing leads" },
    { featureKey: "lead_delete", featureName: "Delete Leads", moduleKey: "leads", description: "Ability to delete leads" },
    { featureKey: "lead_import", featureName: "Import Leads", moduleKey: "leads", description: "Bulk import leads from CSV/Excel" },
    { featureKey: "lead_export", featureName: "Export Leads", moduleKey: "leads", description: "Export leads to CSV/Excel" },
    { featureKey: "kanban_view", featureName: "Kanban View", moduleKey: "leads", description: "Drag-and-drop Kanban board view" },
    { featureKey: "calendar_view", featureName: "Calendar View", moduleKey: "leads", description: "Calendar view for leads and activities" },
    { featureKey: "activity_timeline", featureName: "Activity Timeline", moduleKey: "leads", description: "Activity timeline and history tracking" },
    { featureKey: "lead_detail", featureName: "Lead Detail Page", moduleKey: "leads", description: "Detailed lead view with full information" },
    { featureKey: "multi_view", featureName: "Multiple Views", moduleKey: "leads", description: "Switch between list, kanban, calendar views" },
    { featureKey: "custom_pipeline", featureName: "Custom Pipeline", moduleKey: "leads", description: "Create and customize pipeline stages" },

    { featureKey: "deal_create", featureName: "Create Deals", moduleKey: "deals", description: "Ability to create new deals" },
    { featureKey: "deal_edit", featureName: "Edit Deals", moduleKey: "deals", description: "Ability to edit existing deals" },
    { featureKey: "deal_pipeline", featureName: "Deal Pipeline", moduleKey: "deals", description: "Visual deal pipeline management" },

    { featureKey: "contact_create", featureName: "Create Contacts", moduleKey: "contacts", description: "Ability to create new contacts" },
    { featureKey: "contact_edit", featureName: "Edit Contacts", moduleKey: "contacts", description: "Ability to edit existing contacts" },

    { featureKey: "task_create", featureName: "Create Tasks", moduleKey: "tasks", description: "Ability to create tasks" },
    { featureKey: "task_assign", featureName: "Assign Tasks", moduleKey: "tasks", description: "Ability to assign tasks to team members" },

    { featureKey: "whatsapp_messaging", featureName: "WhatsApp Messaging", moduleKey: "whatsapp", description: "Send and receive WhatsApp messages" },
    { featureKey: "whatsapp_commands", featureName: "WhatsApp Commands", moduleKey: "whatsapp", description: "CRM commands via WhatsApp" },

    { featureKey: "automation_rules", featureName: "Automation Rules", moduleKey: "automation", description: "Create and manage automation rules" },
    { featureKey: "workflow_builder", featureName: "Workflow Builder", moduleKey: "automation", description: "Visual workflow builder for automations" },

    { featureKey: "ai_scoring", featureName: "AI Lead Scoring", moduleKey: "ai", description: "AI-powered lead scoring and prioritization" },
    { featureKey: "ai_predictions", featureName: "AI Predictions", moduleKey: "ai", description: "AI-powered sales predictions and forecasting" },
    { featureKey: "ai_insights", featureName: "AI Insights", moduleKey: "ai", description: "AI-generated business insights and recommendations" },
    { featureKey: "ai_task_automation", featureName: "AI Task Automation", moduleKey: "ai", description: "AI-generated follow-up tasks" },

    { featureKey: "export_data", featureName: "Data Export", moduleKey: "reports", description: "Export data to CSV/Excel" },
    { featureKey: "api_access", featureName: "API Access", moduleKey: "reports", description: "REST API access for integrations" },
    { featureKey: "analytics_dashboard", featureName: "Analytics Dashboard", moduleKey: "reports", description: "Advanced analytics and charts" },

    { featureKey: "max_users", featureName: "User Limit", moduleKey: "settings", description: "Maximum number of users", defaultEnabled: true },
    { featureKey: "max_leads", featureName: "Lead Limit", moduleKey: "leads", description: "Maximum number of leads", defaultEnabled: true },
    { featureKey: "max_contacts", featureName: "Contact Limit", moduleKey: "contacts", description: "Maximum number of contacts", defaultEnabled: true },
    { featureKey: "max_deals", featureName: "Deal Limit", moduleKey: "deals", description: "Maximum number of deals", defaultEnabled: true },
    { featureKey: "max_storage_mb", featureName: "Storage Limit (MB)", moduleKey: "settings", description: "Maximum storage in megabytes", defaultEnabled: true },
    { featureKey: "monthly_ai_usage", featureName: "Monthly AI Usage Limit", moduleKey: "ai", description: "Maximum AI API calls per month", defaultEnabled: true },
  ];

  const createdFeatures: Record<string, number> = {};
  for (const feat of featureDefs) {
    const { moduleKey, ...featureData } = feat;
    const [f] = await db.insert(featureRegistry).values({
      ...featureData,
      moduleId: createdModules[moduleKey],
      defaultEnabled: feat.defaultEnabled ?? true,
    }).returning();
    createdFeatures[feat.featureKey] = f.id;
  }

  const plans = await db.select().from(subscriptionPlans);

  const planFeatureMap: Record<string, Record<string, { enabled: boolean; limit?: number }>> = {
    "Free": {
      lead_create: { enabled: true }, lead_edit: { enabled: true }, lead_delete: { enabled: true },
      lead_import: { enabled: false }, lead_export: { enabled: false },
      kanban_view: { enabled: false }, calendar_view: { enabled: false },
      activity_timeline: { enabled: true }, lead_detail: { enabled: true },
      multi_view: { enabled: false }, custom_pipeline: { enabled: false },
      deal_create: { enabled: true }, deal_edit: { enabled: true }, deal_pipeline: { enabled: false },
      contact_create: { enabled: true }, contact_edit: { enabled: true },
      task_create: { enabled: true }, task_assign: { enabled: false },
      whatsapp_messaging: { enabled: false }, whatsapp_commands: { enabled: false },
      automation_rules: { enabled: false }, workflow_builder: { enabled: false },
      ai_scoring: { enabled: false }, ai_predictions: { enabled: false },
      ai_insights: { enabled: false }, ai_task_automation: { enabled: false },
      export_data: { enabled: false }, api_access: { enabled: false }, analytics_dashboard: { enabled: false },
      max_users: { enabled: true, limit: 2 }, max_leads: { enabled: true, limit: 100 },
      max_contacts: { enabled: true, limit: 50 }, max_deals: { enabled: true, limit: 25 },
      max_storage_mb: { enabled: true, limit: 100 }, monthly_ai_usage: { enabled: true, limit: 0 },
    },
    "Starter": {
      lead_create: { enabled: true }, lead_edit: { enabled: true }, lead_delete: { enabled: true },
      lead_import: { enabled: true }, lead_export: { enabled: true },
      kanban_view: { enabled: true }, calendar_view: { enabled: true },
      activity_timeline: { enabled: true }, lead_detail: { enabled: true },
      multi_view: { enabled: true }, custom_pipeline: { enabled: true },
      deal_create: { enabled: true }, deal_edit: { enabled: true }, deal_pipeline: { enabled: true },
      contact_create: { enabled: true }, contact_edit: { enabled: true },
      task_create: { enabled: true }, task_assign: { enabled: true },
      whatsapp_messaging: { enabled: false }, whatsapp_commands: { enabled: false },
      automation_rules: { enabled: false }, workflow_builder: { enabled: false },
      ai_scoring: { enabled: false }, ai_predictions: { enabled: false },
      ai_insights: { enabled: false }, ai_task_automation: { enabled: false },
      export_data: { enabled: true }, api_access: { enabled: false }, analytics_dashboard: { enabled: true },
      max_users: { enabled: true, limit: 5 }, max_leads: { enabled: true, limit: 1000 },
      max_contacts: { enabled: true, limit: 500 }, max_deals: { enabled: true, limit: 200 },
      max_storage_mb: { enabled: true, limit: 1000 }, monthly_ai_usage: { enabled: true, limit: 50 },
    },
    "Professional": {
      lead_create: { enabled: true }, lead_edit: { enabled: true }, lead_delete: { enabled: true },
      lead_import: { enabled: true }, lead_export: { enabled: true },
      kanban_view: { enabled: true }, calendar_view: { enabled: true },
      activity_timeline: { enabled: true }, lead_detail: { enabled: true },
      multi_view: { enabled: true }, custom_pipeline: { enabled: true },
      deal_create: { enabled: true }, deal_edit: { enabled: true }, deal_pipeline: { enabled: true },
      contact_create: { enabled: true }, contact_edit: { enabled: true },
      task_create: { enabled: true }, task_assign: { enabled: true },
      whatsapp_messaging: { enabled: true }, whatsapp_commands: { enabled: true },
      automation_rules: { enabled: true }, workflow_builder: { enabled: true },
      ai_scoring: { enabled: true }, ai_predictions: { enabled: true },
      ai_insights: { enabled: true }, ai_task_automation: { enabled: true },
      export_data: { enabled: true }, api_access: { enabled: true }, analytics_dashboard: { enabled: true },
      max_users: { enabled: true, limit: 25 }, max_leads: { enabled: true, limit: 10000 },
      max_contacts: { enabled: true, limit: 5000 }, max_deals: { enabled: true, limit: 2000 },
      max_storage_mb: { enabled: true, limit: 5000 }, monthly_ai_usage: { enabled: true, limit: 500 },
    },
    "Enterprise": {
      lead_create: { enabled: true }, lead_edit: { enabled: true }, lead_delete: { enabled: true },
      lead_import: { enabled: true }, lead_export: { enabled: true },
      kanban_view: { enabled: true }, calendar_view: { enabled: true },
      activity_timeline: { enabled: true }, lead_detail: { enabled: true },
      multi_view: { enabled: true }, custom_pipeline: { enabled: true },
      deal_create: { enabled: true }, deal_edit: { enabled: true }, deal_pipeline: { enabled: true },
      contact_create: { enabled: true }, contact_edit: { enabled: true },
      task_create: { enabled: true }, task_assign: { enabled: true },
      whatsapp_messaging: { enabled: true }, whatsapp_commands: { enabled: true },
      automation_rules: { enabled: true }, workflow_builder: { enabled: true },
      ai_scoring: { enabled: true }, ai_predictions: { enabled: true },
      ai_insights: { enabled: true }, ai_task_automation: { enabled: true },
      export_data: { enabled: true }, api_access: { enabled: true }, analytics_dashboard: { enabled: true },
      max_users: { enabled: true, limit: -1 }, max_leads: { enabled: true, limit: -1 },
      max_contacts: { enabled: true, limit: -1 }, max_deals: { enabled: true, limit: -1 },
      max_storage_mb: { enabled: true, limit: -1 }, monthly_ai_usage: { enabled: true, limit: -1 },
    },
  };

  for (const plan of plans) {
    const mapping = planFeatureMap[plan.name];
    if (!mapping) continue;

    for (const [featureKey, config] of Object.entries(mapping)) {
      const featureId = createdFeatures[featureKey];
      if (!featureId) continue;

      await db.insert(packageFeatures).values({
        planId: plan.id,
        featureId,
        isEnabled: config.enabled,
        limitValue: config.limit ?? null,
      });
    }
  }

  console.log(`Seeded ${Object.keys(createdModules).length} modules, ${Object.keys(createdFeatures).length} features, and package mappings.`);
}

async function seedIntegrationApps() {
  const existing = await db.select().from(integrationApps).limit(1);
  if (existing.length > 0) {
    console.log("Integration apps already seeded, skipping.");
    return;
  }

  console.log("Seeding integration apps...");

  const apps = [
    { name: "WhatsApp Business", category: "Communication & Messaging", providerName: "Meta", description: "Send automated follow-ups and support chat alerts via WhatsApp Business API", icon: "MessageSquare", authType: "api_key", configSchema: { fields: [{ name: "api_key", type: "text", label: "API Key", required: true, placeholder: "Enter your WhatsApp Business API key" }, { name: "phone_number_id", type: "text", label: "Phone Number ID", required: true, placeholder: "Your phone number ID" }, { name: "webhook_url", type: "text", label: "Webhook URL", required: false, placeholder: "https://..." }] } },
    { name: "Slack", category: "Communication & Messaging", providerName: "Slack Technologies", description: "Notify team about leads and deals via Slack channels and direct messages", icon: "Hash", authType: "oauth", configSchema: { fields: [{ name: "bot_token", type: "text", label: "Bot Token", required: true, placeholder: "xoxb-..." }, { name: "channel_id", type: "text", label: "Default Channel ID", required: false, placeholder: "C0123456789" }] } },
    { name: "Microsoft Teams", category: "Communication & Messaging", providerName: "Microsoft", description: "Team collaboration and notification alerts for CRM events", icon: "Users", authType: "oauth", configSchema: { fields: [{ name: "client_id", type: "text", label: "Client ID", required: true, placeholder: "Azure AD Client ID" }, { name: "client_secret", type: "password", label: "Client Secret", required: true, placeholder: "Client secret" }, { name: "tenant_id", type: "text", label: "Tenant ID", required: true, placeholder: "Azure AD Tenant ID" }] } },
    { name: "Telegram", category: "Communication & Messaging", providerName: "Telegram", description: "Send CRM notifications and alerts via Telegram bots", icon: "Send", authType: "api_key", configSchema: { fields: [{ name: "bot_token", type: "text", label: "Bot Token", required: true, placeholder: "Your Telegram bot token" }, { name: "chat_id", type: "text", label: "Chat ID", required: true, placeholder: "Target chat ID" }] } },
    { name: "Intercom", category: "Communication & Messaging", providerName: "Intercom", description: "Customer messaging platform for support and engagement", icon: "MessageCircle", authType: "api_key", configSchema: { fields: [{ name: "access_token", type: "text", label: "Access Token", required: true, placeholder: "Your Intercom access token" }] } },

    { name: "Gmail", category: "Email Platforms", providerName: "Google", description: "Email campaigns, tracking, and automated follow-ups via Gmail", icon: "Mail", authType: "oauth", configSchema: { fields: [{ name: "client_id", type: "text", label: "Client ID", required: true, placeholder: "Google OAuth Client ID" }, { name: "client_secret", type: "password", label: "Client Secret", required: true, placeholder: "Client secret" }, { name: "refresh_token", type: "text", label: "Refresh Token", required: true, placeholder: "OAuth refresh token" }] } },
    { name: "Microsoft Outlook", category: "Email Platforms", providerName: "Microsoft", description: "Email integration for campaigns and automated follow-ups", icon: "Mail", authType: "oauth", configSchema: { fields: [{ name: "client_id", type: "text", label: "Client ID", required: true, placeholder: "Azure AD Client ID" }, { name: "client_secret", type: "password", label: "Client Secret", required: true, placeholder: "Client secret" }] } },
    { name: "SendGrid", category: "Email Platforms", providerName: "Twilio", description: "Transactional and marketing email delivery service", icon: "Mail", authType: "api_key", configSchema: { fields: [{ name: "api_key", type: "text", label: "API Key", required: true, placeholder: "SG.xxxx..." }, { name: "from_email", type: "text", label: "From Email", required: true, placeholder: "noreply@yourdomain.com" }] } },
    { name: "Mailchimp", category: "Email Platforms", providerName: "Intuit", description: "Email marketing automation and drip campaigns", icon: "Mail", authType: "api_key", configSchema: { fields: [{ name: "api_key", type: "text", label: "API Key", required: true, placeholder: "Your Mailchimp API key" }, { name: "server_prefix", type: "text", label: "Server Prefix", required: true, placeholder: "us1" }] } },
    { name: "Amazon SES", category: "Email Platforms", providerName: "Amazon", description: "Scalable email sending service for high-volume campaigns", icon: "Mail", authType: "api_key", configSchema: { fields: [{ name: "access_key_id", type: "text", label: "Access Key ID", required: true, placeholder: "AKIA..." }, { name: "secret_access_key", type: "password", label: "Secret Access Key", required: true, placeholder: "Secret key" }, { name: "region", type: "text", label: "AWS Region", required: true, placeholder: "us-east-1" }] } },

    { name: "Stripe", category: "Payment Gateways", providerName: "Stripe", description: "Invoice payments, subscription billing, and payment tracking", icon: "CreditCard", authType: "api_key", configSchema: { fields: [{ name: "secret_key", type: "password", label: "Secret Key", required: true, placeholder: "sk_live_..." }, { name: "webhook_secret", type: "password", label: "Webhook Secret", required: false, placeholder: "whsec_..." }] } },
    { name: "Razorpay", category: "Payment Gateways", providerName: "Razorpay", description: "Payment gateway popular in India for invoices and subscriptions", icon: "CreditCard", authType: "api_key", configSchema: { fields: [{ name: "key_id", type: "text", label: "Key ID", required: true, placeholder: "rzp_live_..." }, { name: "key_secret", type: "password", label: "Key Secret", required: true, placeholder: "Secret key" }] } },
    { name: "PayPal", category: "Payment Gateways", providerName: "PayPal", description: "Global payment processing for invoices and online payments", icon: "CreditCard", authType: "api_key", configSchema: { fields: [{ name: "client_id", type: "text", label: "Client ID", required: true, placeholder: "PayPal Client ID" }, { name: "client_secret", type: "password", label: "Client Secret", required: true, placeholder: "Client secret" }] } },
    { name: "Square", category: "Payment Gateways", providerName: "Square", description: "Payment processing and point-of-sale integration", icon: "CreditCard", authType: "api_key", configSchema: { fields: [{ name: "access_token", type: "text", label: "Access Token", required: true, placeholder: "Your Square access token" }, { name: "location_id", type: "text", label: "Location ID", required: true, placeholder: "Location ID" }] } },
    { name: "Payoneer", category: "Payment Gateways", providerName: "Payoneer", description: "Cross-border payment platform for international transactions", icon: "CreditCard", authType: "api_key", configSchema: { fields: [{ name: "api_key", type: "text", label: "API Key", required: true, placeholder: "Your Payoneer API key" }, { name: "partner_id", type: "text", label: "Partner ID", required: true, placeholder: "Partner ID" }] } },

    { name: "QuickBooks", category: "Accounting Software", providerName: "Intuit", description: "Sync invoices, customers, and revenue reporting", icon: "Calculator", authType: "oauth", configSchema: { fields: [{ name: "client_id", type: "text", label: "Client ID", required: true, placeholder: "QuickBooks Client ID" }, { name: "client_secret", type: "password", label: "Client Secret", required: true, placeholder: "Client secret" }, { name: "realm_id", type: "text", label: "Realm ID", required: true, placeholder: "Company ID" }] } },
    { name: "Xero", category: "Accounting Software", providerName: "Xero", description: "Cloud accounting for syncing invoices and financial data", icon: "Calculator", authType: "oauth", configSchema: { fields: [{ name: "client_id", type: "text", label: "Client ID", required: true, placeholder: "Xero Client ID" }, { name: "client_secret", type: "password", label: "Client Secret", required: true, placeholder: "Client secret" }] } },
    { name: "Tally", category: "Accounting Software", providerName: "Tally Solutions", description: "Accounting integration popular in India for financial management", icon: "Calculator", authType: "api_key", configSchema: { fields: [{ name: "api_key", type: "text", label: "API Key", required: true, placeholder: "Your Tally API key" }, { name: "company_name", type: "text", label: "Company Name", required: true, placeholder: "Tally company name" }] } },
    { name: "FreshBooks", category: "Accounting Software", providerName: "FreshBooks", description: "Invoicing and expense tracking for small businesses", icon: "Calculator", authType: "oauth", configSchema: { fields: [{ name: "client_id", type: "text", label: "Client ID", required: true, placeholder: "FreshBooks Client ID" }, { name: "client_secret", type: "password", label: "Client Secret", required: true, placeholder: "Client secret" }] } },

    { name: "Shopify", category: "E-commerce Platforms", providerName: "Shopify", description: "Order syncing, customer purchase tracking, and upsell automation", icon: "ShoppingCart", authType: "api_key", configSchema: { fields: [{ name: "api_key", type: "text", label: "API Key", required: true, placeholder: "Shopify API key" }, { name: "api_secret", type: "password", label: "API Secret", required: true, placeholder: "API secret" }, { name: "store_url", type: "text", label: "Store URL", required: true, placeholder: "your-store.myshopify.com" }] } },
    { name: "WooCommerce", category: "E-commerce Platforms", providerName: "Automattic", description: "WordPress e-commerce integration for order and customer syncing", icon: "ShoppingCart", authType: "api_key", configSchema: { fields: [{ name: "consumer_key", type: "text", label: "Consumer Key", required: true, placeholder: "ck_..." }, { name: "consumer_secret", type: "password", label: "Consumer Secret", required: true, placeholder: "cs_..." }, { name: "store_url", type: "text", label: "Store URL", required: true, placeholder: "https://your-store.com" }] } },
    { name: "Magento", category: "E-commerce Platforms", providerName: "Adobe", description: "Enterprise e-commerce platform integration", icon: "ShoppingCart", authType: "api_key", configSchema: { fields: [{ name: "access_token", type: "text", label: "Access Token", required: true, placeholder: "Your Magento access token" }, { name: "base_url", type: "text", label: "Base URL", required: true, placeholder: "https://your-store.com" }] } },
    { name: "BigCommerce", category: "E-commerce Platforms", providerName: "BigCommerce", description: "E-commerce platform for order and inventory syncing", icon: "ShoppingCart", authType: "api_key", configSchema: { fields: [{ name: "access_token", type: "text", label: "Access Token", required: true, placeholder: "Your BigCommerce access token" }, { name: "store_hash", type: "text", label: "Store Hash", required: true, placeholder: "Store hash" }] } },

    { name: "Google Ads", category: "Marketing & Advertising", providerName: "Google", description: "Capture ad leads and track campaign ROI within CRM", icon: "Megaphone", authType: "oauth", configSchema: { fields: [{ name: "client_id", type: "text", label: "Client ID", required: true, placeholder: "Google OAuth Client ID" }, { name: "client_secret", type: "password", label: "Client Secret", required: true, placeholder: "Client secret" }, { name: "customer_id", type: "text", label: "Customer ID", required: true, placeholder: "Google Ads Customer ID" }] } },
    { name: "Facebook Ads", category: "Marketing & Advertising", providerName: "Meta", description: "Lead capture from Facebook campaigns with attribution tracking", icon: "Megaphone", authType: "oauth", configSchema: { fields: [{ name: "access_token", type: "text", label: "Access Token", required: true, placeholder: "Facebook long-lived token" }, { name: "ad_account_id", type: "text", label: "Ad Account ID", required: true, placeholder: "act_..." }] } },
    { name: "LinkedIn Ads", category: "Marketing & Advertising", providerName: "Microsoft", description: "B2B lead generation from LinkedIn advertising campaigns", icon: "Megaphone", authType: "oauth", configSchema: { fields: [{ name: "access_token", type: "text", label: "Access Token", required: true, placeholder: "LinkedIn access token" }, { name: "account_id", type: "text", label: "Account ID", required: true, placeholder: "LinkedIn Ads Account ID" }] } },
    { name: "HubSpot Marketing Hub", category: "Marketing & Advertising", providerName: "HubSpot", description: "Marketing automation and attribution for CRM leads", icon: "Megaphone", authType: "api_key", configSchema: { fields: [{ name: "api_key", type: "text", label: "API Key", required: true, placeholder: "Your HubSpot API key" }] } },

    { name: "Google Calendar", category: "Calendar & Productivity", providerName: "Google", description: "Meeting scheduling and calendar sync with CRM activities", icon: "Calendar", authType: "oauth", configSchema: { fields: [{ name: "client_id", type: "text", label: "Client ID", required: true, placeholder: "Google OAuth Client ID" }, { name: "client_secret", type: "password", label: "Client Secret", required: true, placeholder: "Client secret" }] } },
    { name: "Calendly", category: "Calendar & Productivity", providerName: "Calendly", description: "Automated meeting scheduling integrated with CRM deals", icon: "Calendar", authType: "api_key", configSchema: { fields: [{ name: "api_key", type: "text", label: "Personal Access Token", required: true, placeholder: "Your Calendly API key" }] } },
    { name: "Notion", category: "Calendar & Productivity", providerName: "Notion", description: "Knowledge base and project management sync", icon: "FileText", authType: "api_key", configSchema: { fields: [{ name: "api_key", type: "text", label: "Internal Integration Token", required: true, placeholder: "secret_..." }, { name: "database_id", type: "text", label: "Database ID", required: false, placeholder: "Notion database ID" }] } },
    { name: "Trello", category: "Calendar & Productivity", providerName: "Atlassian", description: "Task synchronization and project board integration", icon: "Kanban", authType: "api_key", configSchema: { fields: [{ name: "api_key", type: "text", label: "API Key", required: true, placeholder: "Your Trello API key" }, { name: "token", type: "text", label: "Token", required: true, placeholder: "Trello token" }] } },
  ];

  for (const app of apps) {
    await db.insert(integrationApps).values(app);
  }

  console.log(`Seeded ${apps.length} integration apps across 7 categories.`);
}

async function seedIntegrationModule() {
  const existingModule = await db.select().from(moduleRegistry).where(eq(moduleRegistry.moduleKey, "integrations")).limit(1);
  if (existingModule.length > 0) {
    console.log("Integrations module already registered, skipping.");
    return;
  }

  const [mod] = await db.insert(moduleRegistry).values({
    moduleKey: "integrations",
    moduleName: "Integrations",
    moduleDescription: "Third-party app integration marketplace",
    moduleIcon: "Puzzle",
    routePath: "/integrations",
    isCore: false,
    sortOrder: 12,
  }).returning();

  const [feature] = await db.insert(featureRegistry).values({
    featureKey: "integration_marketplace",
    featureName: "Integration Marketplace",
    moduleId: mod.id,
    description: "Access to connect and manage third-party integrations",
    defaultEnabled: false,
  }).returning();

  const plans = await db.select().from(subscriptionPlans);
  for (const plan of plans) {
    const isEnabled = plan.name !== "Free";
    await db.insert(packageFeatures).values({
      planId: plan.id,
      featureId: feature.id,
      isEnabled: isEnabled,
      limitValue: null,
    });
  }

  console.log("Integrations module and feature registered. Enabled for paid plans only.");
}
