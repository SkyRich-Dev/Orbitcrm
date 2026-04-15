import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { pool, db } from "./db";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { loginSchema, registerSchema, brandingSettingsSchema, homepageSettingsSchema, subdomainSchema,
  platformSettings, notificationChannels, companyEmailSettings, systemNotifications, subscriptionPlans, companies } from "@shared/schema";
import { scoreLeads, predictDeals, generateAutomatedTasks, generateInsights } from "./ai-services";
import { featureAccess, requireFeature, requireModule, requireLimit } from "./feature-access";
import { stripeService, razorpayService } from "./payment-services";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

function sanitizeString(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashedPassword, salt] = stored.split(".");
  const buf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(hashedPassword, "hex"), buf);
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    return res.status(403).json({ message: "Account deactivated" });
  }
  if (user.role !== "super_admin") {
    const company = await storage.getCompany(user.companyId);
    if (company?.isArchived) {
      req.session.destroy(() => {});
      return res.status(403).json({ message: "Company account suspended" });
    }
  }
  next();
}

async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "super_admin") {
    return res.status(403).json({ message: "Forbidden: Super admin access required" });
  }
  next();
}

declare module "express-session" {
  interface SessionData {
    userId: number;
    companyId: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      tenantCompany?: any;
      tenantSubdomain?: string;
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      },
    })
  );

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Too many attempts, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { message: "Too many requests, please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { message: "AI rate limit exceeded, please wait" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/ai/", aiLimiter);
  app.use("/api/", apiLimiter);

  app.get("/download/developer-document", (_req: Request, res: Response) => {
    const filePath = new URL("../SkyRich_Orbit_CRM_Developer_Document.docx", import.meta.url).pathname;
    res.download(filePath, "SkyRich_Orbit_CRM_Developer_Document.docx");
  });

  const CRM_BASE_DOMAIN = process.env.CRM_BASE_DOMAIN || "crm.skyrichorbit.com";

  app.use(async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const host = req.hostname || req.headers.host?.split(":")[0] || "";
      if (host && host !== CRM_BASE_DOMAIN && host.endsWith(`.${CRM_BASE_DOMAIN}`)) {
        const subdomain = host.replace(`.${CRM_BASE_DOMAIN}`, "");
        if (subdomain && subdomain.length >= 3) {
          req.tenantSubdomain = subdomain;
          const company = await storage.getCompanyBySubdomain(subdomain);
          if (company) {
            req.tenantCompany = company;
          }
        }
      }
    } catch (err) {
      console.error("Subdomain middleware error:", err);
    }
    next();
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { username, password, email, fullName, companyName } = parsed.data;

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      const allPlans = await storage.getSubscriptionPlans(true);
      const freePlan = allPlans.find((p) => Number(p.priceMonthly) === 0 && p.isActive) || allPlans.find((p) => p.isActive);
      if (!freePlan) {
        return res.status(500).json({ message: "No plans configured. Please contact support." });
      }

      const hashedPassword = await hashPassword(password);
      const result = await storage.createTenantWithPlan({
        company: { name: companyName, slug, subdomain: slug, domainStatus: "active" },
        admin: { username, password: hashedPassword, email, fullName },
        planId: freePlan.id,
      });

      req.session.userId = result.user.id;
      req.session.companyId = result.company.id;

      const { password: _, ...safeUser } = result.user;
      res.json({ user: safeUser });
    } catch (err: any) {
      console.error("Register error:", err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { username, password } = parsed.data;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await comparePasswords(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "Your account has been deactivated. Please contact your administrator." });
      }

      if (user.role !== "super_admin") {
        const company = await storage.getCompany(user.companyId);
        if (company?.isArchived) {
          return res.status(403).json({ message: "This company account has been suspended. Please contact support." });
        }
      }

      req.session.userId = user.id;
      req.session.companyId = user.companyId;

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      console.error("Auth me error:", err);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/company", requireAuth, async (req: Request, res: Response) => {
    try {
      const company = await storage.getCompany(req.session.companyId!);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (err: any) {
      console.error("Company error:", err);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.patch("/api/company", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyUpdateSchema = z.object({
        name: z.string().min(1).max(200).optional(),
        logo: z.string().max(500).nullable().optional(),
        primaryColor: z.string().max(20).optional(),
        industry: z.string().max(100).optional(),
        website: z.string().url().max(300).or(z.literal("")).optional(),
        phone: z.string().max(50).optional(),
        address: z.string().max(500).optional(),
      });
      const parsed = companyUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const urlFields = new Set(["logo", "website"]);
      const allowed: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) {
          allowed[key] = (typeof value === "string" && !urlFields.has(key)) ? sanitizeString(value) : value;
        }
      }
      const company = await storage.updateCompany(req.session.companyId!, allowed);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (err: any) {
      console.error("Update company error:", err);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  const RESERVED_SUBDOMAINS = new Set([
    "admin", "api", "www", "mail", "ftp", "smtp", "pop", "imap",
    "support", "help", "billing", "status", "app", "dashboard",
    "login", "register", "signup", "signin", "auth", "oauth",
    "static", "assets", "cdn", "dev", "staging", "test", "demo",
    "root", "system", "platform", "crm", "superadmin",
  ]);

  const subdomainRegex = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;

  function validateSubdomain(subdomain: string): string | null {
    if (!subdomain || typeof subdomain !== "string") return "Subdomain is required";
    const s = subdomain.toLowerCase().trim();
    if (s.length < 3 || s.length > 40) return "Subdomain must be 3-40 characters";
    if (!subdomainRegex.test(s)) return "Only lowercase letters, numbers, and hyphens allowed. Must start with a letter and end with letter or number";
    if (RESERVED_SUBDOMAINS.has(s)) return "This subdomain is reserved";
    if (s.includes("--")) return "Cannot contain consecutive hyphens";
    return null;
  }

  app.get("/api/domain/check", async (req: Request, res: Response) => {
    try {
      const subdomain = (req.query.subdomain as string || "").toLowerCase().trim();
      const validationError = validateSubdomain(subdomain);
      if (validationError) {
        return res.json({ available: false, reason: validationError });
      }
      const existing = await storage.getCompanyBySubdomain(subdomain);
      const isOwnSubdomain = req.session?.companyId && existing?.id === req.session.companyId;
      res.json({ available: !existing || isOwnSubdomain, subdomain });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to check domain availability" });
    }
  });

  app.post("/api/company/subdomain", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || (user.role !== "company_admin" && user.role !== "super_admin")) {
        return res.status(403).json({ message: "Only company admins can change subdomain" });
      }
      const parsed = subdomainSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid subdomain" });
      }
      const s = parsed.data.subdomain;
      const validationError = validateSubdomain(s);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }
      const existing = await storage.getCompanyBySubdomain(s);
      if (existing && existing.id !== req.session.companyId) {
        return res.status(409).json({ message: "Subdomain is already taken" });
      }
      const company = await storage.updateCompany(req.session.companyId!, {
        subdomain: s,
        domainStatus: "active",
      });
      if (!company) return res.status(404).json({ message: "Company not found" });
      tenantConfigCache.delete(s);
      res.json(company);
    } catch (err: any) {
      console.error("Set subdomain error:", err);
      res.status(500).json({ message: "Failed to set subdomain" });
    }
  });

  app.get("/api/company/branding", requireAuth, async (req: Request, res: Response) => {
    try {
      const company = await storage.getCompany(req.session.companyId!);
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json({
        brandingSettings: company.brandingSettings || {},
        homepageSettings: company.homepageSettings || {},
        logo: company.logo,
        primaryColor: company.primaryColor,
        subdomain: company.subdomain,
        domainStatus: company.domainStatus,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch branding" });
    }
  });

  app.patch("/api/company/branding", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || (user.role !== "company_admin" && user.role !== "super_admin")) {
        return res.status(403).json({ message: "Only company admins can update branding" });
      }
      const { brandingSettings } = req.body;
      const parsed = brandingSettingsSchema.safeParse(brandingSettings);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid branding settings", errors: parsed.error.flatten() });
      }
      const company = await storage.updateCompany(req.session.companyId!, { brandingSettings: parsed.data });
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (company.subdomain) tenantConfigCache.delete(company.subdomain);
      res.json(company);
    } catch (err: any) {
      console.error("Update branding error:", err);
      res.status(500).json({ message: "Failed to update branding" });
    }
  });

  app.patch("/api/company/homepage", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || (user.role !== "company_admin" && user.role !== "super_admin")) {
        return res.status(403).json({ message: "Only company admins can update homepage settings" });
      }
      const { homepageSettings } = req.body;
      const parsed = homepageSettingsSchema.safeParse(homepageSettings);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid homepage settings", errors: parsed.error.flatten() });
      }
      const company = await storage.updateCompany(req.session.companyId!, { homepageSettings: parsed.data });
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (company.subdomain) tenantConfigCache.delete(company.subdomain);
      res.json(company);
    } catch (err: any) {
      console.error("Update homepage error:", err);
      res.status(500).json({ message: "Failed to update homepage" });
    }
  });

  const tenantConfigCache = new Map<string, { data: any; expiry: number }>();

  app.get("/api/tenant/config", async (req: Request, res: Response) => {
    try {
      const subdomain = (req.query.subdomain as string || "").toLowerCase().trim();
      if (!subdomain) {
        return res.status(400).json({ message: "subdomain query parameter required" });
      }
      const cached = tenantConfigCache.get(subdomain);
      if (cached && cached.expiry > Date.now()) {
        return res.json(cached.data);
      }
      const company = await storage.getCompanyBySubdomain(subdomain);
      if (!company) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      const config = {
        companyName: company.name,
        companyId: company.id,
        brandingSettings: company.brandingSettings || {},
        homepageSettings: company.homepageSettings || {},
        logo: company.logo,
        primaryColor: company.primaryColor,
      };
      tenantConfigCache.set(subdomain, { data: config, expiry: Date.now() + 60000 });
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch tenant config" });
    }
  });

  app.get("/api/pipeline-stages", requireAuth, async (req: Request, res: Response) => {
    try {
      const stages = await storage.getPipelineStages(req.session.companyId!);
      res.json(stages);
    } catch (err: any) {
      console.error("Pipeline stages error:", err);
      res.status(500).json({ message: "Failed to fetch pipeline stages" });
    }
  });

  app.get("/api/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats(req.session.companyId!);
      res.json(stats);
    } catch (err: any) {
      console.error("Dashboard stats error:", err);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await storage.getUsers(req.session.companyId!);
      const safeUsers = result.map(({ password, ...rest }) => rest);
      res.json(safeUsers);
    } catch (err: any) {
      console.error("Users error:", err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/leads", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await storage.getLeads(req.session.companyId!);
      res.json(result);
    } catch (err: any) {
      console.error("Leads error:", err);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.post("/api/leads", requireAuth, requireFeature("lead_create"), requireLimit("max_leads"), async (req: Request, res: Response) => {
    try {
      const bodySchema = z.object({
        title: z.string().min(1).max(200),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email().max(200).nullable().optional(),
        phone: z.string().max(50).nullable().optional(),
        company: z.string().max(200).nullable().optional(),
        source: z.string().max(100).nullable().optional(),
        stageId: z.number().nullable().optional(),
        value: z.string().max(50).optional(),
        notes: z.string().max(5000).nullable().optional(),
        score: z.number().min(0).max(100).nullable().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { title, firstName, lastName, email, phone, company, source, stageId, value, notes, score } = parsed.data;
      const lead = await storage.createLead({
        title: sanitizeString(title), firstName: sanitizeString(firstName), lastName: sanitizeString(lastName),
        email, phone, company: company ? sanitizeString(company) : null, source, stageId,
        value: value || "0", notes: notes ? sanitizeString(notes) : null, score,
        companyId: req.session.companyId!,
        createdBy: req.session.userId!,
        status: "new",
      });

      await storage.createActivity({
        companyId: req.session.companyId!,
        type: "lead_created",
        title: `New lead: ${lead.firstName} ${lead.lastName}`,
        entityType: "lead",
        entityId: lead.id,
        userId: req.session.userId!,
      });

      res.json(lead);
    } catch (err: any) {
      console.error("Create lead error:", err);
      res.status(400).json({ message: "Failed to create lead" });
    }
  });

  app.get("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const lead = await storage.getLead(Number(req.params.id), req.session.companyId!);
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      res.json(lead);
    } catch (err: any) {
      console.error("Get lead error:", err);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.patch("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const leadId = Number(req.params.id);
      const companyId = req.session.companyId!;
      const userId = req.session.userId!;

      const oldLead = await storage.getLead(leadId, companyId);
      if (!oldLead) return res.status(404).json({ message: "Lead not found" });

      const { title, firstName, lastName, email, phone, company, source, stageId, score, value, status, notes, assignedTo, priority, expectedCloseDate } = req.body;
      const allowed: Record<string, any> = {};
      if (title !== undefined) allowed.title = title;
      if (firstName !== undefined) allowed.firstName = firstName;
      if (lastName !== undefined) allowed.lastName = lastName;
      if (email !== undefined) allowed.email = email;
      if (phone !== undefined) allowed.phone = phone;
      if (company !== undefined) allowed.company = company;
      if (source !== undefined) allowed.source = source;
      if (stageId !== undefined) allowed.stageId = stageId;
      if (score !== undefined) allowed.score = score;
      if (value !== undefined) allowed.value = value;
      if (status !== undefined) allowed.status = status;
      if (notes !== undefined) allowed.notes = notes;
      if (assignedTo !== undefined) allowed.assignedTo = assignedTo;
      if (priority !== undefined) allowed.priority = priority;
      if (expectedCloseDate !== undefined) allowed.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;

      const lead = await storage.updateLead(leadId, companyId, allowed);
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      if (stageId !== undefined && stageId !== oldLead.stageId) {
        const stages = await storage.getPipelineStages(companyId);
        const oldStage = stages.find(s => s.id === oldLead.stageId);
        const newStage = stages.find(s => s.id === stageId);
        await storage.createActivity({
          companyId, type: "stage_change",
          title: `Stage changed: ${oldStage?.name || "None"} → ${newStage?.name || "None"}`,
          entityType: "lead", entityId: leadId, userId,
          metadata: { oldStageId: oldLead.stageId, newStageId: stageId },
        });
      }

      if (assignedTo !== undefined && assignedTo !== oldLead.assignedTo) {
        const newUser = assignedTo ? await storage.getUser(assignedTo) : null;
        await storage.createActivity({
          companyId, type: "assignment",
          title: `Assigned to ${newUser?.fullName || "Unassigned"}`,
          entityType: "lead", entityId: leadId, userId,
          metadata: { oldAssignedTo: oldLead.assignedTo, newAssignedTo: assignedTo },
        });
      }

      if (value !== undefined && value !== oldLead.value) {
        await storage.createActivity({
          companyId, type: "value_change",
          title: `Value changed: $${Number(oldLead.value || 0).toLocaleString()} → $${Number(value || 0).toLocaleString()}`,
          entityType: "lead", entityId: leadId, userId,
          metadata: { oldValue: oldLead.value, newValue: value },
        });
      }

      if (status !== undefined && status !== oldLead.status) {
        await storage.createActivity({
          companyId, type: "status_change",
          title: `Status changed: ${oldLead.status} → ${status}`,
          entityType: "lead", entityId: leadId, userId,
        });
      }

      res.json(lead);
    } catch (err: any) {
      console.error("Update lead error:", err);
      res.status(400).json({ message: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteLead(Number(req.params.id), req.session.companyId!);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Delete lead error:", err);
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });

  app.get("/api/leads/:id/activities", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await storage.getLeadActivities(req.session.companyId!, Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      console.error("Lead activities error:", err);
      res.status(500).json({ message: "Failed to fetch lead activities" });
    }
  });

  app.post("/api/leads/:id/activities", requireAuth, async (req: Request, res: Response) => {
    try {
      const leadId = Number(req.params.id);
      const lead = await storage.getLead(leadId, req.session.companyId!);
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      const bodySchema = z.object({
        type: z.string().min(1),
        subject: z.string().min(1),
        description: z.string().optional(),
        scheduledAt: z.string().optional(),
        outcome: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Type and subject are required", errors: parsed.error.flatten() });
      const { type, subject, description, scheduledAt, outcome, metadata } = parsed.data;

      const activity = await storage.createActivity({
        companyId: req.session.companyId!,
        type,
        title: subject,
        description,
        entityType: "lead",
        entityId: leadId,
        userId: req.session.userId!,
        metadata: { ...metadata, scheduledAt, outcome },
      });

      res.json(activity);
    } catch (err: any) {
      console.error("Create lead activity error:", err);
      res.status(400).json({ message: "Failed to create activity" });
    }
  });

  app.get("/api/contacts", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await storage.getContacts(req.session.companyId!);
      res.json(result);
    } catch (err: any) {
      console.error("Contacts error:", err);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", requireAuth, requireFeature("contact_create"), requireLimit("max_contacts"), async (req: Request, res: Response) => {
    try {
      const contactSchema = z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email().max(200).nullable().optional(),
        phone: z.string().max(50).nullable().optional(),
        company: z.string().max(200).nullable().optional(),
        jobTitle: z.string().max(200).nullable().optional(),
        notes: z.string().max(5000).nullable().optional(),
      });
      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { firstName, lastName, email, phone, company, jobTitle, notes } = parsed.data;
      const contact = await storage.createContact({
        firstName, lastName, email, phone, company, jobTitle, notes,
        companyId: req.session.companyId!,
        createdBy: req.session.userId!,
      });

      await storage.createActivity({
        companyId: req.session.companyId!,
        type: "contact_created",
        title: `New contact: ${contact.firstName} ${contact.lastName}`,
        entityType: "contact",
        entityId: contact.id,
        userId: req.session.userId!,
      });

      res.json(contact);
    } catch (err: any) {
      console.error("Create contact error:", err);
      res.status(400).json({ message: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, email, phone, company, jobTitle, notes } = req.body;
      const allowed: Record<string, any> = {};
      if (firstName !== undefined) allowed.firstName = firstName;
      if (lastName !== undefined) allowed.lastName = lastName;
      if (email !== undefined) allowed.email = email;
      if (phone !== undefined) allowed.phone = phone;
      if (company !== undefined) allowed.company = company;
      if (jobTitle !== undefined) allowed.jobTitle = jobTitle;
      if (notes !== undefined) allowed.notes = notes;
      const contact = await storage.updateContact(Number(req.params.id), req.session.companyId!, allowed);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (err: any) {
      console.error("Update contact error:", err);
      res.status(400).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteContact(Number(req.params.id), req.session.companyId!);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Delete contact error:", err);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  app.get("/api/deals", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await storage.getDeals(req.session.companyId!);
      res.json(result);
    } catch (err: any) {
      console.error("Deals error:", err);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  app.post("/api/deals", requireAuth, requireFeature("deal_create"), requireLimit("max_deals"), async (req: Request, res: Response) => {
    try {
      const { title, value, stageId, status, notes, contactId, leadId } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }
      const deal = await storage.createDeal({
        title, value: value || "0", stageId, status: status || "open", notes, contactId, leadId,
        companyId: req.session.companyId!,
        createdBy: req.session.userId!,
        assignedTo: req.session.userId!,
      });

      await storage.createActivity({
        companyId: req.session.companyId!,
        type: "deal_created",
        title: `New deal: ${deal.title}`,
        entityType: "deal",
        entityId: deal.id,
        userId: req.session.userId!,
      });

      res.json(deal);
    } catch (err: any) {
      console.error("Create deal error:", err);
      res.status(400).json({ message: "Failed to create deal" });
    }
  });

  app.patch("/api/deals/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { title, value, stageId, status, notes, contactId, leadId, expectedCloseDate } = req.body;
      const allowed: Record<string, any> = {};
      if (title !== undefined) allowed.title = title;
      if (value !== undefined) allowed.value = value;
      if (stageId !== undefined) allowed.stageId = stageId;
      if (status !== undefined) allowed.status = status;
      if (notes !== undefined) allowed.notes = notes;
      if (contactId !== undefined) allowed.contactId = contactId;
      if (leadId !== undefined) allowed.leadId = leadId;
      if (expectedCloseDate !== undefined) allowed.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
      const deal = await storage.updateDeal(Number(req.params.id), req.session.companyId!, allowed);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      res.json(deal);
    } catch (err: any) {
      console.error("Update deal error:", err);
      res.status(400).json({ message: "Failed to update deal" });
    }
  });

  app.delete("/api/deals/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteDeal(Number(req.params.id), req.session.companyId!);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Delete deal error:", err);
      res.status(500).json({ message: "Failed to delete deal" });
    }
  });

  app.get("/api/tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await storage.getTasks(req.session.companyId!);
      res.json(result);
    } catch (err: any) {
      console.error("Tasks error:", err);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", requireAuth, requireFeature("task_create"), async (req: Request, res: Response) => {
    try {
      const { title, description, priority, status, dueDate } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }
      const task = await storage.createTask({
        title, description, priority: priority || "medium", status: status || "pending",
        dueDate: dueDate ? new Date(dueDate) : null,
        companyId: req.session.companyId!,
        assignedTo: req.session.userId!,
        createdBy: req.session.userId!,
      });
      res.json(task);
    } catch (err: any) {
      console.error("Create task error:", err);
      res.status(400).json({ message: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { title, description, priority, status, dueDate } = req.body;
      const allowed: Record<string, any> = {};
      if (title !== undefined) allowed.title = title;
      if (description !== undefined) allowed.description = description;
      if (priority !== undefined) allowed.priority = priority;
      if (status !== undefined) allowed.status = status;
      if (dueDate !== undefined) allowed.dueDate = dueDate ? new Date(dueDate) : null;
      const task = await storage.updateTask(Number(req.params.id), req.session.companyId!, allowed);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (err: any) {
      console.error("Update task error:", err);
      res.status(400).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteTask(Number(req.params.id), req.session.companyId!);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Delete task error:", err);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  app.get("/api/activities", requireAuth, async (req: Request, res: Response) => {
    try {
      const entityType = req.query.entityType as string | undefined;
      const result = await storage.getActivities(req.session.companyId!, 50, entityType);
      res.json(result);
    } catch (err: any) {
      console.error("Activities error:", err);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get("/api/ai/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      let settings = await storage.getAiSettings(req.session.companyId!);
      if (!settings) {
        settings = await storage.upsertAiSettings(req.session.companyId!, {
          companyId: req.session.companyId!,
          enableAi: true,
          enableLeadScoring: true,
          enableSalesPrediction: true,
          enableTaskAutomation: true,
          enableInsights: true,
          monthlyUsageLimit: 1000,
          usageCount: 0,
        });
      }
      res.json(settings);
    } catch (err: any) {
      console.error("AI settings error:", err);
      res.status(500).json({ message: "Failed to fetch AI settings" });
    }
  });

  app.put("/api/ai/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const { enableAi, enableLeadScoring, enableSalesPrediction, enableTaskAutomation, enableInsights, monthlyUsageLimit } = req.body;
      const settings = await storage.upsertAiSettings(req.session.companyId!, {
        enableAi,
        enableLeadScoring,
        enableSalesPrediction,
        enableTaskAutomation,
        enableInsights,
        monthlyUsageLimit,
      });
      res.json(settings);
    } catch (err: any) {
      console.error("AI settings update error:", err);
      res.status(500).json({ message: "Failed to update AI settings" });
    }
  });

  app.get("/api/ai/automation-rules", requireAuth, async (req: Request, res: Response) => {
    try {
      const rules = await storage.getAutomationRules(req.session.companyId!);
      res.json(rules);
    } catch (err: any) {
      console.error("Automation rules error:", err);
      res.status(500).json({ message: "Failed to fetch automation rules" });
    }
  });

  app.post("/api/ai/automation-rules", requireAuth, requireFeature("automation_rules"), async (req: Request, res: Response) => {
    try {
      const { name, triggerType, conditions, actions, isActive } = req.body;
      if (!name || !triggerType) {
        return res.status(400).json({ message: "Name and trigger type required" });
      }
      const rule = await storage.createAutomationRule({
        companyId: req.session.companyId!,
        name,
        triggerType,
        conditions: conditions || {},
        actions: actions || {},
        isActive: isActive !== false,
      });
      res.json(rule);
    } catch (err: any) {
      console.error("Create automation rule error:", err);
      res.status(500).json({ message: "Failed to create automation rule" });
    }
  });

  app.patch("/api/ai/automation-rules/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { name, triggerType, conditions, actions, isActive } = req.body;
      const rule = await storage.updateAutomationRule(id, req.session.companyId!, {
        name, triggerType, conditions, actions, isActive,
      });
      if (!rule) return res.status(404).json({ message: "Rule not found" });
      res.json(rule);
    } catch (err: any) {
      console.error("Update automation rule error:", err);
      res.status(500).json({ message: "Failed to update automation rule" });
    }
  });

  app.delete("/api/ai/automation-rules/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAutomationRule(id, req.session.companyId!);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Delete automation rule error:", err);
      res.status(500).json({ message: "Failed to delete automation rule" });
    }
  });

  app.get("/api/ai/insights", requireAuth, async (req: Request, res: Response) => {
    try {
      const insights = await storage.getAiInsights(req.session.companyId!);
      res.json(insights);
    } catch (err: any) {
      console.error("AI insights error:", err);
      res.status(500).json({ message: "Failed to fetch AI insights" });
    }
  });

  app.patch("/api/ai/insights/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const insight = await storage.markInsightRead(id, req.session.companyId!);
      if (!insight) return res.status(404).json({ message: "Insight not found" });
      res.json(insight);
    } catch (err: any) {
      console.error("Mark insight read error:", err);
      res.status(500).json({ message: "Failed to mark insight read" });
    }
  });

  app.post("/api/ai/score-leads", requireAuth, requireFeature("ai_scoring"), async (req: Request, res: Response) => {
    try {
      const result = await scoreLeads(req.session.companyId!);
      res.json(result);
    } catch (err: any) {
      console.error("Score leads error:", err);
      res.status(500).json({ message: "Failed to score leads" });
    }
  });

  app.post("/api/ai/predict-deals", requireAuth, requireFeature("ai_predictions"), async (req: Request, res: Response) => {
    try {
      const result = await predictDeals(req.session.companyId!);
      res.json(result);
    } catch (err: any) {
      console.error("Predict deals error:", err);
      res.status(500).json({ message: "Failed to predict deals" });
    }
  });

  app.post("/api/ai/generate-tasks", requireAuth, requireFeature("ai_task_automation"), async (req: Request, res: Response) => {
    try {
      const result = await generateAutomatedTasks(req.session.companyId!);
      res.json(result);
    } catch (err: any) {
      console.error("Generate tasks error:", err);
      res.status(500).json({ message: "Failed to generate tasks" });
    }
  });

  app.post("/api/ai/generate-insights", requireAuth, requireFeature("ai_insights"), async (req: Request, res: Response) => {
    try {
      const result = await generateInsights(req.session.companyId!);
      res.json(result);
    } catch (err: any) {
      console.error("Generate insights error:", err);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  app.get("/api/billing/plans", async (_req: Request, res: Response) => {
    try {
      const plans = await storage.getSubscriptionPlans(true);
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  app.get("/api/billing/subscription", requireAuth, async (req: Request, res: Response) => {
    try {
      const sub = await storage.getCompanySubscription(req.session.companyId!);
      if (!sub) return res.json(null);
      const plan = await storage.getSubscriptionPlan(sub.planId);
      res.json({ subscription: sub, plan });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  app.get("/api/billing/usage", requireAuth, async (req: Request, res: Response) => {
    try {
      const info = await featureAccess.getCompanyPlanInfo(req.session.companyId!);
      if (!info) return res.json({ usage: {}, limits: {} });
      res.json({ usage: info.usage, limits: info.limits, features: info.features });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch usage" });
    }
  });

  app.get("/api/billing/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const txs = await storage.getPaymentTransactions(req.session.companyId!);
      res.json(txs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/billing/gateways", requireAuth, async (_req: Request, res: Response) => {
    res.json({
      stripe: { configured: stripeService.isConfigured() },
      razorpay: { configured: razorpayService.isConfigured() },
    });
  });

  app.post("/api/billing/check-feature", requireAuth, async (req: Request, res: Response) => {
    try {
      const { feature } = req.body;
      if (!feature) return res.status(400).json({ message: "Feature name required" });
      const result = await featureAccess.checkFeature(req.session.companyId!, feature);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to check feature" });
    }
  });

  app.post("/api/billing/check-limit", requireAuth, async (req: Request, res: Response) => {
    try {
      const { limit } = req.body;
      if (!limit) return res.status(400).json({ message: "Limit name required" });
      const result = await featureAccess.checkLimit(req.session.companyId!, limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to check limit" });
    }
  });

  app.post("/api/billing/subscribe", requireAuth, async (req: Request, res: Response) => {
    try {
      const bodySchema = z.object({
        planId: z.number(),
        billingCycle: z.enum(["monthly", "yearly"]),
        gateway: z.enum(["stripe", "razorpay"]),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });

      const { planId, billingCycle, gateway } = parsed.data;
      const companyId = req.session.companyId!;
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });

      const price = billingCycle === "yearly" ? Number(plan.priceYearly) : Number(plan.priceMonthly);

      if (price <= 0) {
        const existing = await storage.getCompanySubscription(companyId);
        if (existing) {
          await storage.updateCompanySubscription(existing.id, {
            planId,
            billingCycle,
            status: "active",
            gateway: null,
            startDate: new Date(),
            endDate: null,
          });
        } else {
          await storage.createCompanySubscription({
            companyId,
            planId,
            billingCycle,
            status: "active",
          });
        }
        return res.json({ success: true, message: "Switched to free plan" });
      }

      const user = await storage.getUser(req.session.userId!);
      const company = await storage.getCompany(companyId);

      if (gateway === "stripe") {
        if (!stripeService.isConfigured()) {
          return res.status(400).json({ message: "Stripe is not configured. Please add STRIPE_SECRET_KEY to environment." });
        }
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const result = await stripeService.createCheckoutSession({
          companyId,
          planId,
          billingCycle,
          customerEmail: user?.email || "admin@company.com",
          successUrl: `${baseUrl}/settings/billing?success=true`,
          cancelUrl: `${baseUrl}/settings/billing?cancelled=true`,
        });
        if (!result.success) return res.status(400).json({ message: result.error });
        return res.json({ success: true, sessionUrl: result.sessionUrl, gateway: "stripe" });
      }

      if (gateway === "razorpay") {
        if (!razorpayService.isConfigured()) {
          return res.status(400).json({ message: "Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment." });
        }
        const result = await razorpayService.createSubscription({
          companyId,
          planId,
          billingCycle,
          customerEmail: user?.email || "admin@company.com",
          customerName: company?.name || "Company",
        });
        if (!result.success) return res.status(400).json({ message: result.error });
        return res.json({
          success: true,
          subscriptionId: result.subscriptionId,
          gateway: "razorpay",
          razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        });
      }

      return res.status(400).json({ message: "Invalid gateway" });
    } catch (err: any) {
      console.error("Subscribe error:", err);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.post("/api/billing/cancel", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const sub = await storage.getCompanySubscription(companyId);
      if (!sub) return res.status(404).json({ message: "No active subscription" });

      if (sub.stripeSubscriptionId && stripeService.isConfigured()) {
        await stripeService.cancelSubscription(sub.stripeSubscriptionId);
      }
      if (sub.razorpaySubscriptionId && razorpayService.isConfigured()) {
        await razorpayService.cancelSubscription(sub.razorpaySubscriptionId);
      }

      await storage.updateCompanySubscription(sub.id, {
        cancelAtPeriodEnd: true,
        status: sub.endDate && new Date(sub.endDate) > new Date() ? sub.status : "cancelled",
      });

      res.json({ success: true, message: "Subscription will be cancelled at end of billing period" });
    } catch (err: any) {
      console.error("Cancel subscription error:", err);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.post("/api/billing/change-plan", requireAuth, async (req: Request, res: Response) => {
    try {
      const bodySchema = z.object({
        planId: z.number(),
        billingCycle: z.enum(["monthly", "yearly"]).optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request" });

      const { planId, billingCycle } = parsed.data;
      const companyId = req.session.companyId!;
      const sub = await storage.getCompanySubscription(companyId);
      if (!sub) return res.status(404).json({ message: "No active subscription" });

      const newPlan = await storage.getSubscriptionPlan(planId);
      if (!newPlan) return res.status(404).json({ message: "Plan not found" });
      const oldPlan = await storage.getSubscriptionPlan(sub.planId);

      const isUpgrade = (newPlan.sortOrder || 0) > (oldPlan?.sortOrder || 0);
      const effectiveCycle = billingCycle || sub.billingCycle;
      const newPrice = effectiveCycle === "yearly" ? Number(newPlan.priceYearly) : Number(newPlan.priceMonthly);
      const oldPrice = oldPlan
        ? (sub.billingCycle === "yearly" ? Number(oldPlan.priceYearly) : Number(oldPlan.priceMonthly))
        : 0;

      const cycleDays = sub.billingCycle === "yearly" ? 365 : 30;
      const startDate = sub.startDate ? new Date(sub.startDate) : new Date();
      const now = new Date();
      const daysUsed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const daysRemaining = Math.max(0, cycleDays - daysUsed);
      const unusedCredit = oldPrice > 0 ? parseFloat(((oldPrice / cycleDays) * daysRemaining).toFixed(2)) : 0;

      const newCycleDays = effectiveCycle === "yearly" ? 365 : 30;
      const newDailyRate = newPrice > 0 ? newPrice / newCycleDays : 0;
      const proratedCharge = parseFloat((newDailyRate * daysRemaining).toFixed(2));
      const netAmount = parseFloat((proratedCharge - unusedCredit).toFixed(2));

      if (newPrice <= 0) {
        await storage.updateCompanySubscription(sub.id, {
          planId,
          billingCycle: effectiveCycle,
          status: "active",
          gateway: null,
        });
        return res.json({
          success: true, message: "Switched to free plan", immediate: true,
          prorata: { unusedCredit, proratedCharge: 0, netAmount: -unusedCredit, daysRemaining },
        });
      }

      if (isUpgrade) {
        await storage.updateCompanySubscription(sub.id, {
          planId,
          billingCycle: effectiveCycle,
        });
        await storage.resetFeatureUsage(companyId);
        return res.json({
          success: true, message: "Plan upgraded successfully", immediate: true,
          prorata: { unusedCredit, proratedCharge, netAmount, daysRemaining, oldPrice, newPrice },
        });
      }

      const usage = await storage.getCompanyUsageSummary(companyId);
      const newLimits = (newPlan.limits || {}) as Record<string, number>;
      const warnings: string[] = [];

      if (newLimits.max_users && newLimits.max_users !== -1 && usage.users > newLimits.max_users) {
        warnings.push(`Current users (${usage.users}) exceeds new limit (${newLimits.max_users})`);
      }
      if (newLimits.max_leads && newLimits.max_leads !== -1 && usage.leads > newLimits.max_leads) {
        warnings.push(`Current leads (${usage.leads}) exceeds new limit (${newLimits.max_leads})`);
      }

      await storage.updateCompanySubscription(sub.id, {
        planId,
        billingCycle: effectiveCycle,
      });

      return res.json({
        success: true,
        message: warnings.length > 0
          ? "Plan downgraded. Warning: some current usage exceeds new limits."
          : "Plan downgraded successfully",
        warnings,
        immediate: false,
        prorata: { unusedCredit, proratedCharge, netAmount, daysRemaining, oldPrice, newPrice },
      });
    } catch (err: any) {
      console.error("Change plan error:", err);
      res.status(500).json({ message: "Failed to change plan" });
    }
  });

  app.post("/api/billing/stripe/webhook", async (req: Request, res: Response) => {
    try {
      const sig = req.headers["stripe-signature"] as string;
      if (!sig) return res.status(400).json({ message: "No signature" });

      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const event = await stripeService.handleWebhook(rawBody, sig);
      if (!event) return res.status(400).json({ message: "Invalid webhook" });

      const data = event.data;

      if (event.type === "checkout.session.completed") {
        const companyId = Number(data.metadata?.companyId);
        const planId = Number(data.metadata?.planId);
        const billingCycle = data.metadata?.billingCycle || "monthly";

        if (companyId && planId) {
          const existing = await storage.getCompanySubscription(companyId);
          const now = new Date();
          const endDate = new Date(now);
          if (billingCycle === "yearly") endDate.setFullYear(endDate.getFullYear() + 1);
          else endDate.setMonth(endDate.getMonth() + 1);

          if (existing) {
            await storage.updateCompanySubscription(existing.id, {
              planId,
              billingCycle,
              status: "active",
              gateway: "stripe",
              stripeCustomerId: data.customer,
              stripeSubscriptionId: data.subscription,
              startDate: now,
              endDate,
              nextBillingDate: endDate,
              cancelAtPeriodEnd: false,
            });
          } else {
            await storage.createCompanySubscription({
              companyId,
              planId,
              billingCycle,
              status: "active",
              gateway: "stripe",
              stripeCustomerId: data.customer,
              stripeSubscriptionId: data.subscription,
              startDate: now,
              endDate,
              nextBillingDate: endDate,
            });
          }

          await storage.createPaymentTransaction({
            companyId,
            amount: String(data.amount_total / 100),
            currency: data.currency?.toUpperCase() || "USD",
            gateway: "stripe",
            transactionId: data.payment_intent,
            status: "completed",
            invoiceReference: data.invoice,
            metadata: { sessionId: data.id },
          });

          await storage.resetFeatureUsage(companyId);
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const stripeSubId = data.id;
        const companyId = Number(data.metadata?.companyId);
        if (companyId) {
          const sub = await storage.getCompanySubscription(companyId);
          if (sub && sub.stripeSubscriptionId === stripeSubId) {
            await storage.updateCompanySubscription(sub.id, {
              status: "cancelled",
            });
          }
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("Stripe webhook error:", err);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  app.post("/api/billing/razorpay/webhook", async (req: Request, res: Response) => {
    try {
      const sig = req.headers["x-razorpay-signature"] as string;
      if (razorpayService.isConfigured() && sig) {
        const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        if (!razorpayService.verifyWebhookSignature(rawBody, sig)) {
          return res.status(400).json({ message: "Invalid webhook signature" });
        }
      }

      const event = req.body;
      if (!event || !event.event) return res.status(400).json({ message: "Invalid webhook" });

      if (event.event === "subscription.activated" || event.event === "subscription.charged") {
        const payload = event.payload?.subscription?.entity;
        if (payload) {
          const notes = payload.notes || {};
          const companyId = Number(notes.companyId);
          const planId = Number(notes.planId);
          const billingCycle = notes.billingCycle || "monthly";

          if (companyId && planId) {
            const existing = await storage.getCompanySubscription(companyId);
            const now = new Date();
            const endDate = new Date(now);
            if (billingCycle === "yearly") endDate.setFullYear(endDate.getFullYear() + 1);
            else endDate.setMonth(endDate.getMonth() + 1);

            if (existing) {
              await storage.updateCompanySubscription(existing.id, {
                planId,
                billingCycle,
                status: "active",
                gateway: "razorpay",
                razorpaySubscriptionId: payload.id,
                startDate: now,
                endDate,
                nextBillingDate: endDate,
                cancelAtPeriodEnd: false,
              });
            } else {
              await storage.createCompanySubscription({
                companyId,
                planId,
                billingCycle,
                status: "active",
                gateway: "razorpay",
                razorpaySubscriptionId: payload.id,
                startDate: now,
                endDate,
                nextBillingDate: endDate,
              });
            }

            const payment = event.payload?.payment?.entity;
            if (payment) {
              await storage.createPaymentTransaction({
                companyId,
                amount: String(payment.amount / 100),
                currency: payment.currency?.toUpperCase() || "INR",
                gateway: "razorpay",
                transactionId: payment.id,
                status: "completed",
                metadata: { subscriptionId: payload.id },
              });
            }

            await storage.resetFeatureUsage(companyId);
          }
        }
      }

      if (event.event === "subscription.cancelled") {
        const payload = event.payload?.subscription?.entity;
        if (payload) {
          const companyId = Number(payload.notes?.companyId);
          if (companyId) {
            const sub = await storage.getCompanySubscription(companyId);
            if (sub) {
              await storage.updateCompanySubscription(sub.id, { status: "cancelled" });
            }
          }
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("Razorpay webhook error:", err);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  app.post("/api/billing/razorpay/verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, planId, billingCycle } = req.body;

      if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
        return res.status(400).json({ message: "Missing payment details" });
      }

      const isValid = razorpayService.verifyPaymentSignature({
        razorpay_payment_id,
        razorpay_subscription_id,
        razorpay_signature,
      });

      if (!isValid) return res.status(400).json({ message: "Invalid payment signature" });

      const companyId = req.session.companyId!;
      const existing = await storage.getCompanySubscription(companyId);
      const now = new Date();
      const endDate = new Date(now);
      const cycle = billingCycle || "monthly";
      if (cycle === "yearly") endDate.setFullYear(endDate.getFullYear() + 1);
      else endDate.setMonth(endDate.getMonth() + 1);

      if (existing) {
        await storage.updateCompanySubscription(existing.id, {
          planId: planId || existing.planId,
          billingCycle: cycle,
          status: "active",
          gateway: "razorpay",
          razorpaySubscriptionId: razorpay_subscription_id,
          startDate: now,
          endDate,
          nextBillingDate: endDate,
          cancelAtPeriodEnd: false,
        });
      } else {
        await storage.createCompanySubscription({
          companyId,
          planId: planId || 1,
          billingCycle: cycle,
          status: "active",
          gateway: "razorpay",
          razorpaySubscriptionId: razorpay_subscription_id,
          startDate: now,
          endDate,
          nextBillingDate: endDate,
        });
      }

      await storage.createPaymentTransaction({
        companyId,
        amount: "0",
        currency: "INR",
        gateway: "razorpay",
        transactionId: razorpay_payment_id,
        status: "completed",
        metadata: { subscriptionId: razorpay_subscription_id, signature: razorpay_signature },
      });

      await storage.resetFeatureUsage(companyId);

      res.json({ success: true, message: "Payment verified and subscription activated" });
    } catch (err: any) {
      console.error("Razorpay verify error:", err);
      res.status(500).json({ message: "Failed to verify payment" });
    }
  });

  // ============================================================
  // WHATSAPP INTEGRATION ROUTES
  // ============================================================

  const whatsappSettingsBodySchema = z.object({
    enabled: z.boolean().optional(),
    provider: z.string().optional(),
    apiKey: z.string().optional(),
    webhookUrl: z.string().optional(),
    businessNumber: z.string().optional(),
  });

  const whatsappContactBodySchema = z.object({
    phoneNumber: z.string().min(1, "Phone number is required"),
    whatsappName: z.string().nullable().optional(),
    contactId: z.number().nullable().optional(),
    assignedTo: z.number().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
  });

  const whatsappContactUpdateSchema = z.object({
    conversationStatus: z.enum(["open", "closed", "pending"]).optional(),
    assignedTo: z.number().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    whatsappName: z.string().nullable().optional(),
    contactId: z.number().nullable().optional(),
  });

  const whatsappMessageBodySchema = z.object({
    contactId: z.number().nullable().optional(),
    phoneNumber: z.string().min(1, "Phone number is required"),
    messageText: z.string().min(1, "Message text is required"),
    direction: z.enum(["incoming", "outgoing"]).optional(),
  });

  const whatsappCommandBodySchema = z.object({
    command: z.string().min(1, "Command is required"),
    rawMessage: z.string().min(1, "Raw message is required"),
  });

  async function requireWhatsappEnabled(req: Request, res: Response, next: NextFunction) {
    const settings = await storage.getWhatsappSettings(req.session.companyId!);
    if (!settings?.enabled) {
      return res.status(403).json({ message: "WhatsApp integration is not enabled" });
    }
    next();
  }

  app.get("/api/whatsapp/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getWhatsappSettings(req.session.companyId!);
      res.json(settings || { enabled: false, provider: "whatsapp_business" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch WhatsApp settings" });
    }
  });

  app.put("/api/whatsapp/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = whatsappSettingsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const settings = await storage.upsertWhatsappSettings(req.session.companyId!, parsed.data);
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update WhatsApp settings" });
    }
  });

  app.get("/api/whatsapp/contacts", requireAuth, requireWhatsappEnabled, async (req: Request, res: Response) => {
    try {
      const waContacts = await storage.getWhatsappContacts(req.session.companyId!);
      res.json(waContacts);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch WhatsApp contacts" });
    }
  });

  app.post("/api/whatsapp/contacts", requireAuth, requireWhatsappEnabled, async (req: Request, res: Response) => {
    try {
      const parsed = whatsappContactBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const contact = await storage.createWhatsappContact({
        companyId: req.session.companyId!,
        phoneNumber: parsed.data.phoneNumber,
        whatsappName: parsed.data.whatsappName ?? null,
        contactId: parsed.data.contactId ?? null,
        assignedTo: parsed.data.assignedTo ?? null,
        tags: parsed.data.tags ?? null,
        conversationStatus: "open",
      });
      res.json(contact);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create WhatsApp contact" });
    }
  });

  app.patch("/api/whatsapp/contacts/:id", requireAuth, requireWhatsappEnabled, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = whatsappContactUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const contact = await storage.updateWhatsappContact(id, req.session.companyId!, parsed.data);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      res.json(contact);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update WhatsApp contact" });
    }
  });

  app.delete("/api/whatsapp/contacts/:id", requireAuth, requireWhatsappEnabled, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWhatsappContact(id, req.session.companyId!);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete WhatsApp contact" });
    }
  });

  app.get("/api/whatsapp/messages", requireAuth, requireWhatsappEnabled, async (req: Request, res: Response) => {
    try {
      const phoneNumber = req.query.phone as string | undefined;
      const messages = await storage.getWhatsappMessages(req.session.companyId!, phoneNumber);
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/whatsapp/messages", requireAuth, requireWhatsappEnabled, async (req: Request, res: Response) => {
    try {
      const parsed = whatsappMessageBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const message = await storage.createWhatsappMessage({
        companyId: req.session.companyId!,
        contactId: parsed.data.contactId ?? null,
        employeeId: req.session.userId,
        direction: parsed.data.direction || "outgoing",
        messageText: parsed.data.messageText,
        phoneNumber: parsed.data.phoneNumber,
        status: "sent",
      });
      res.json(message);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/whatsapp/command-logs", requireAuth, requireWhatsappEnabled, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getWhatsappCommandLogs(req.session.companyId!);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch command logs" });
    }
  });

  app.post("/api/whatsapp/commands", requireAuth, requireWhatsappEnabled, async (req: Request, res: Response) => {
    try {
      const parsed = whatsappCommandBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { command, rawMessage } = parsed.data;

      let result = "";
      let success = false;
      const companyId = req.session.companyId!;

      if (command === "status") {
        const stats = await storage.getDashboardStats(companyId);
        result = `Leads: ${stats.totalLeads}, Deals: ${stats.totalDeals}, Contacts: ${stats.totalContacts}`;
        success = true;
      } else if (command === "leads") {
        const allLeads = await storage.getLeads(companyId);
        result = allLeads.slice(0, 5).map((l: any) => `${l.firstName} ${l.lastName} (${l.status})`).join(", ") || "No leads found";
        success = true;
      } else if (command === "deals") {
        const allDeals = await storage.getDeals(companyId);
        result = allDeals.slice(0, 5).map((d: any) => `${d.title} ($${d.value})`).join(", ") || "No deals found";
        success = true;
      } else if (command === "tasks") {
        const allTasks = await storage.getTasks(companyId);
        const pending = allTasks.filter((t: any) => t.status !== "completed");
        result = pending.slice(0, 5).map((t: any) => `${t.title} (${t.priority})`).join(", ") || "No pending tasks";
        success = true;
      } else if (command === "help") {
        result = "Commands: /status, /leads, /deals, /tasks, /help";
        success = true;
      } else {
        result = `Unknown command: ${command}. Type /help for available commands.`;
        success = false;
      }

      const log = await storage.createWhatsappCommandLog({
        companyId,
        employeeId: req.session.userId,
        command,
        rawMessage,
        result,
        success,
      });
      res.json({ ...log, result });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to execute command" });
    }
  });

  // ============================================================
  // PLATFORM ADMIN ROUTES (super_admin only)
  // ============================================================

  app.get("/api/admin/stats", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getPlatformStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch platform stats" });
    }
  });

  app.get("/api/admin/tenants", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const allCompanies = await storage.getAllCompanies();
      const allUsers = await storage.getAllUsers();
      const allSubs = await storage.getAllSubscriptions();
      const allPlans = await storage.getSubscriptionPlans(false);

      const tenants = allCompanies.map((c) => {
        const userCount = allUsers.filter((u) => u.companyId === c.id).length;
        const sub = allSubs.find((s) => s.companyId === c.id);
        const plan = sub ? allPlans.find((p) => p.id === sub.planId) : null;
        return {
          ...c,
          userCount,
          subscription: sub || null,
          planName: plan?.name || "No Plan",
          subscriptionStatus: sub?.status || "none",
        };
      });
      res.json(tenants);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.get("/api/admin/tenants/archived", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const archived = await storage.getArchivedCompanies();
      const allUsers = await storage.getAllUsers();
      const allSubs = await storage.getAllSubscriptions();
      const allPlans = await storage.getSubscriptionPlans(false);
      const tenants = archived.map((c) => {
        const userCount = allUsers.filter((u) => u.companyId === c.id).length;
        const sub = allSubs.find((s) => s.companyId === c.id);
        const plan = sub ? allPlans.find((p) => p.id === sub.planId) : null;
        return { ...c, userCount, subscription: sub || null, planName: plan?.name || "No Plan", subscriptionStatus: sub?.status || "none" };
      });
      res.json(tenants);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch archived tenants" });
    }
  });

  app.get("/api/admin/tenants/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ message: "Tenant not found" });
      const allUsers = await storage.getAllUsers();
      const companyUsers = allUsers.filter((u) => u.companyId === id).map(({ password, ...u }) => u);
      const sub = await storage.getCompanySubscription(id);
      const plan = sub ? await storage.getSubscriptionPlan(sub.planId) : null;
      const usage = await storage.getCompanyUsageSummary(id);
      res.json({ company, users: companyUsers, subscription: sub, plan, usage });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch tenant details" });
    }
  });

  app.patch("/api/admin/tenants/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const tenantUpdateSchema = z.object({
        name: z.string().min(1).max(200).optional(),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
        subdomain: z.string().max(100).optional(),
        industry: z.string().max(100).optional(),
        website: z.string().max(500).optional(),
        phone: z.string().max(50).optional(),
        address: z.string().max(500).optional(),
        logo: z.string().max(1000).optional(),
        primaryColor: z.string().max(20).optional(),
      });
      const parsed = tenantUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const updated = await storage.updateCompany(id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Tenant not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update tenant" });
    }
  });

  const createTenantSchema = z.object({
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
    industry: z.string().max(100).optional(),
    website: z.string().max(500).optional(),
    phone: z.string().max(50).optional(),
    address: z.string().max(500).optional(),
    planId: z.number().int().positive("A plan is required"),
    adminUsername: z.string().min(3).max(50),
    adminPassword: z.string().min(6).max(100),
    adminEmail: z.string().email(),
    adminFullName: z.string().min(1).max(100),
  });

  app.post("/api/admin/tenants", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createTenantSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid data", errors: parsed.error.flatten() });

      const plan = await storage.getSubscriptionPlan(parsed.data.planId);
      if (!plan) return res.status(400).json({ message: "Selected plan does not exist" });

      const existingUser = await storage.getUserByUsername(parsed.data.adminUsername);
      if (existingUser) return res.status(400).json({ message: "Admin username already taken" });

      const hashedPassword = await hashPassword(parsed.data.adminPassword);
      const result = await storage.createTenantWithPlan({
        company: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          industry: parsed.data.industry,
          website: parsed.data.website,
          phone: parsed.data.phone,
          address: parsed.data.address,
        },
        admin: {
          username: parsed.data.adminUsername,
          password: hashedPassword,
          email: parsed.data.adminEmail,
          fullName: parsed.data.adminFullName,
        },
        planId: parsed.data.planId,
      });

      const { password, ...safeUser } = result.user;
      res.json({ company: result.company, user: safeUser, subscription: result.subscription });
    } catch (err: any) {
      console.error("Create tenant error:", err);
      if (err.code === "23505") return res.status(400).json({ message: "Company slug already exists" });
      res.status(500).json({ message: "Failed to create tenant" });
    }
  });

  app.post("/api/admin/tenants/:id/archive", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.archiveCompany(id);
      if (!company) return res.status(404).json({ message: "Tenant not found" });
      res.json(company);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to archive tenant" });
    }
  });

  app.post("/api/admin/tenants/:id/restore", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.restoreCompany(id);
      if (!company) return res.status(404).json({ message: "Tenant not found" });
      res.json(company);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to restore tenant" });
    }
  });

  app.patch("/api/admin/tenants/:id/subscription", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const subUpdateSchema = z.object({
        planId: z.number().int().positive().optional(),
        status: z.enum(["trial", "active", "cancelled", "expired"]).optional(),
        billingCycle: z.enum(["monthly", "yearly"]).optional(),
      });
      const parsed = subUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data" });

      if (parsed.data.planId) {
        const plan = await storage.getSubscriptionPlan(parsed.data.planId);
        if (!plan) return res.status(400).json({ message: "Plan not found" });
      }

      const sub = await storage.getCompanySubscription(id);
      if (!sub) return res.status(404).json({ message: "No subscription found for this tenant" });

      const updated = await storage.updateCompanySubscription(sub.id, parsed.data);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  app.post("/api/admin/tenants/:id/staff", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ message: "Tenant not found" });

      const staffSchema = z.object({
        username: z.string().min(3).max(50),
        password: z.string().min(6).max(100),
        email: z.string().email(),
        fullName: z.string().min(1).max(100),
        role: z.enum(["company_admin", "sales_manager", "sales_executive"]),
        permissions: z.record(z.boolean()).optional(),
      });
      const parsed = staffSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid data" });

      const existingUser = await storage.getUserByUsername(parsed.data.username);
      if (existingUser) return res.status(400).json({ message: "Username already taken" });

      const hashedPassword = await hashPassword(parsed.data.password);
      const user = await storage.createUser({
        companyId,
        username: parsed.data.username,
        password: hashedPassword,
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        role: parsed.data.role,
        permissions: parsed.data.permissions || null,
      });

      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      console.error("Create staff error:", err);
      res.status(500).json({ message: "Failed to create staff member" });
    }
  });

  app.patch("/api/admin/tenants/:id/staff/:userId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      const user = await storage.getUser(userId);
      if (!user || user.companyId !== companyId) return res.status(404).json({ message: "Staff member not found" });

      const updateSchema = z.object({
        fullName: z.string().min(1).max(100).optional(),
        email: z.string().email().optional(),
        role: z.enum(["company_admin", "sales_manager", "sales_executive"]).optional(),
        permissions: z.record(z.boolean()).optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data" });

      const updated = await storage.updateUser(userId, parsed.data);
      if (!updated) return res.status(404).json({ message: "Staff member not found" });

      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update staff member" });
    }
  });

  app.delete("/api/admin/tenants/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCompany(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete tenant error:", err);
      res.status(500).json({ message: "Failed to delete tenant" });
    }
  });

  app.get("/api/admin/plans", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const plans = await storage.getSubscriptionPlans(false);
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  const planBodySchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    priceMonthly: z.union([z.string(), z.number()]).transform(String),
    priceYearly: z.union([z.string(), z.number()]).transform(String),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    features: z.record(z.boolean()).optional(),
    limits: z.record(z.number()).optional(),
  });

  app.post("/api/admin/plans", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = planBodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const plan = await storage.createSubscriptionPlan(parsed.data);
      res.json(plan);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create plan" });
    }
  });

  app.patch("/api/admin/plans/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = planBodySchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const updated = await storage.updateSubscriptionPlan(id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Plan not found" });
      featureAccess.invalidateAllCaches();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  app.delete("/api/admin/plans/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSubscriptionPlan(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete plan" });
    }
  });

  app.get("/api/admin/subscriptions", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const allSubs = await storage.getAllSubscriptions();
      const allCompanies = await storage.getAllCompanies();
      const allPlans = await storage.getSubscriptionPlans(false);

      const subscriptions = allSubs.map((s) => ({
        ...s,
        companyName: allCompanies.find((c) => c.id === s.companyId)?.name || "Unknown",
        planName: allPlans.find((p) => p.id === s.planId)?.name || "Unknown",
      }));
      res.json(subscriptions);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // ============================================================
  // TENANT FEATURE ACCESS API
  // ============================================================

  app.get("/api/features/my", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const featureMap = await featureAccess.getCompanyFeatureMap(companyId);
      const usage = await storage.getCompanyUsageSummary(companyId);
      res.json({ ...featureMap, usage });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch features" });
    }
  });

  app.patch("/api/admin/subscriptions/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const subUpdateSchema = z.object({
        planId: z.number().int().positive().optional(),
        status: z.enum(["trial", "active", "cancelled", "expired"]).optional(),
        billingCycle: z.enum(["monthly", "yearly"]).optional(),
      }).strict();
      const parsed = subUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const updated = await storage.updateCompanySubscription(id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Subscription not found" });
      featureAccess.invalidateCache(updated.companyId);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // ============================================================
  // ADMIN MODULE & FEATURE REGISTRY ROUTES
  // ============================================================

  app.get("/api/admin/modules", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const modules = await storage.getModules();
      const features = await storage.getFeatures();
      const modulesWithFeatures = modules.map((m) => ({
        ...m,
        features: features.filter((f) => f.moduleId === m.id),
      }));
      res.json(modulesWithFeatures);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch modules" });
    }
  });

  app.patch("/api/admin/modules/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const moduleUpdateSchema = z.object({
        moduleName: z.string().min(1).optional(),
        moduleDescription: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      });
      const parsed = moduleUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const updated = await storage.updateModule(id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Module not found" });
      featureAccess.invalidateAllCaches();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update module" });
    }
  });

  app.get("/api/admin/features", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const features = await storage.getFeatures();
      res.json(features);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch features" });
    }
  });

  app.post("/api/admin/features", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const featureCreateSchema = z.object({
        featureKey: z.string().min(1),
        featureName: z.string().min(1),
        moduleId: z.number().int().positive(),
        description: z.string().optional(),
        defaultEnabled: z.boolean().optional(),
      });
      const parsed = featureCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const feature = await storage.createFeature(parsed.data);
      featureAccess.invalidateAllCaches();
      res.json(feature);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create feature" });
    }
  });

  app.get("/api/admin/package-features/:planId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const planId = parseInt(req.params.planId);
      const pkgFeatures = await storage.getPackageFeatures(planId);
      res.json(pkgFeatures);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch package features" });
    }
  });

  app.put("/api/admin/package-features/:planId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const planId = parseInt(req.params.planId);
      const schema = z.array(z.object({
        featureId: z.number().int().positive(),
        isEnabled: z.boolean(),
        limitValue: z.number().int().nullable().optional(),
      }));
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });

      const features = parsed.data.map((f) => ({
        planId,
        featureId: f.featureId,
        isEnabled: f.isEnabled,
        limitValue: f.limitValue ?? null,
      }));

      await storage.setPackageFeaturesForPlan(planId, features);
      featureAccess.invalidateAllCaches();

      const updated = await storage.getPackageFeatures(planId);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update package features" });
    }
  });

  app.get("/api/admin/company-features/:companyId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const featureMap = await featureAccess.getCompanyFeatureMap(companyId);
      const overrides = await storage.getCompanyFeatureOverrides(companyId);
      res.json({ ...featureMap, overrides });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch company features" });
    }
  });

  app.patch("/api/admin/company-features/:companyId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const schema = z.object({
        featureId: z.number().int().positive(),
        isEnabled: z.boolean(),
        customLimit: z.number().int().nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });

      const override = await storage.upsertCompanyFeatureOverride({
        companyId,
        featureId: parsed.data.featureId,
        isEnabled: parsed.data.isEnabled,
        customLimit: parsed.data.customLimit ?? null,
      });

      featureAccess.invalidateCache(companyId);
      res.json(override);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update company feature override" });
    }
  });

  app.delete("/api/admin/company-features/:companyId/:featureId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const featureId = parseInt(req.params.featureId);
      await storage.deleteCompanyFeatureOverride(companyId, featureId);
      featureAccess.invalidateCache(companyId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete company feature override" });
    }
  });

  app.get("/api/integrations", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const result = await featureAccess.checkFeature(companyId, "integration_marketplace");
      if (!result.allowed) {
        return res.status(403).json({ message: "Integration feature available only for paid plans" });
      }

      const apps = await storage.getIntegrationApps(true);
      const grouped: Record<string, typeof apps> = {};
      for (const app of apps) {
        if (!grouped[app.category]) grouped[app.category] = [];
        grouped[app.category].push(app);
      }
      res.json({ apps, grouped });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.get("/api/integrations/connected", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const result = await featureAccess.checkFeature(companyId, "integration_marketplace");
      if (!result.allowed) {
        return res.status(403).json({ message: "Integration feature available only for paid plans" });
      }

      const connections = await storage.getCompanyIntegrations(companyId);
      const apps = await storage.getIntegrationApps(true);
      const appMap = new Map(apps.map(a => [a.id, a]));

      const enriched = connections.map(c => ({
        ...c,
        credentials: undefined,
        app: appMap.get(c.integrationAppId),
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch connected integrations" });
    }
  });

  app.post("/api/integrations/connect", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const user = await storage.getUser(req.session.userId!);
      if (!user || (user.role !== "company_admin" && user.role !== "super_admin")) {
        return res.status(403).json({ message: "Only admins can connect integrations" });
      }

      const result = await featureAccess.checkFeature(companyId, "integration_marketplace");
      if (!result.allowed) {
        return res.status(403).json({ message: "Integration feature available only for paid plans" });
      }

      const schema = z.object({
        integrationId: z.number(),
        credentials: z.record(z.string()).optional(),
        configSettings: z.record(z.any()).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }

      const app = await storage.getIntegrationApp(parsed.data.integrationId);
      if (!app) {
        return res.status(404).json({ message: "Integration app not found" });
      }

      const existing = await storage.getCompanyIntegrations(companyId);
      const alreadyConnected = existing.find(e => e.integrationAppId === parsed.data.integrationId && e.status === "active");
      if (alreadyConnected) {
        return res.status(409).json({ message: "This integration is already connected" });
      }

      const connection = await storage.connectIntegration({
        companyId,
        integrationAppId: parsed.data.integrationId,
        status: "active",
        credentials: parsed.data.credentials || null,
        configSettings: parsed.data.configSettings || null,
      });

      await storage.createIntegrationLog({
        companyId,
        integrationAppId: parsed.data.integrationId,
        companyIntegrationId: connection.id,
        actionType: "connect",
        status: "success",
        message: `Connected ${app.name} integration`,
      });

      res.json({ ...connection, credentials: undefined });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to connect integration" });
    }
  });

  app.patch("/api/integrations/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const user = await storage.getUser(req.session.userId!);
      if (!user || (user.role !== "company_admin" && user.role !== "super_admin")) {
        return res.status(403).json({ message: "Only admins can update integrations" });
      }

      const id = parseInt(req.params.id);
      const existing = await storage.getCompanyIntegration(id, companyId);
      if (!existing) {
        return res.status(404).json({ message: "Integration connection not found" });
      }

      const schema = z.object({
        credentials: z.record(z.string()).optional(),
        configSettings: z.record(z.any()).optional(),
        status: z.enum(["active", "inactive"]).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }

      const updated = await storage.updateCompanyIntegration(id, companyId, parsed.data);

      await storage.createIntegrationLog({
        companyId,
        integrationAppId: existing.integrationAppId,
        companyIntegrationId: id,
        actionType: "update",
        status: "success",
        message: `Updated integration configuration`,
      });

      res.json({ ...updated, credentials: undefined });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update integration" });
    }
  });

  app.delete("/api/integrations/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const user = await storage.getUser(req.session.userId!);
      if (!user || (user.role !== "company_admin" && user.role !== "super_admin")) {
        return res.status(403).json({ message: "Only admins can disconnect integrations" });
      }

      const id = parseInt(req.params.id);
      const existing = await storage.getCompanyIntegration(id, companyId);
      if (!existing) {
        return res.status(404).json({ message: "Integration connection not found" });
      }

      const app = await storage.getIntegrationApp(existing.integrationAppId);

      await storage.disconnectIntegration(id, companyId);

      await storage.createIntegrationLog({
        companyId,
        integrationAppId: existing.integrationAppId,
        actionType: "disconnect",
        status: "success",
        message: `Disconnected ${app?.name || "unknown"} integration`,
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to disconnect integration" });
    }
  });

  app.post("/api/integrations/:id/sync", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const user = await storage.getUser(req.session.userId!);
      if (!user || (user.role !== "company_admin" && user.role !== "super_admin")) {
        return res.status(403).json({ message: "Only admins can trigger syncs" });
      }

      const id = parseInt(req.params.id);
      const existing = await storage.getCompanyIntegration(id, companyId);
      if (!existing) {
        return res.status(404).json({ message: "Integration connection not found" });
      }

      if (existing.status !== "active") {
        return res.status(400).json({ message: "Integration is not active" });
      }

      const app = await storage.getIntegrationApp(existing.integrationAppId);

      await storage.updateCompanyIntegration(id, companyId, { lastSyncAt: new Date() });

      await storage.createIntegrationLog({
        companyId,
        integrationAppId: existing.integrationAppId,
        companyIntegrationId: id,
        actionType: "sync",
        status: "success",
        message: `Sync triggered for ${app?.name || "unknown"}`,
      });

      res.json({ success: true, message: `Sync triggered for ${app?.name || "integration"}`, syncedAt: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to trigger sync" });
    }
  });

  app.get("/api/integrations/logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const integrationAppId = req.query.integrationAppId ? parseInt(req.query.integrationAppId as string) : undefined;
      const logs = await storage.getIntegrationLogs(companyId, integrationAppId);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch integration logs" });
    }
  });

  app.get("/api/admin/config/settings", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const rows = await db.select().from(platformSettings).orderBy(platformSettings.category, platformSettings.settingKey);
      const filtered = category ? rows.filter(r => r.category === category) : rows;
      const safe = filtered.map(r => ({ ...r, settingValue: r.isSecret && r.settingValue ? "••••••••" : r.settingValue }));
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch platform settings" });
    }
  });

  app.put("/api/admin/config/settings", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { settings } = req.body as { settings: Array<{ settingKey: string; settingValue: string }> };
      if (!settings || !Array.isArray(settings)) return res.status(400).json({ message: "Invalid settings payload" });
      for (const s of settings) {
        if (s.settingValue === "••••••••") continue;
        await db.update(platformSettings)
          .set({ settingValue: s.settingValue, updatedAt: new Date() })
          .where(eq(platformSettings.settingKey, s.settingKey));
      }
      res.json({ success: true, message: "Settings updated" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.get("/api/admin/config/notifications", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const channels = await db.select().from(notificationChannels).orderBy(notificationChannels.channel);
      res.json(channels);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch notification channels" });
    }
  });

  app.put("/api/admin/config/notifications/:channel", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { channel } = req.params;
      const { enabled, provider, config } = req.body;
      const [updated] = await db.update(notificationChannels)
        .set({ enabled: enabled ?? false, provider: provider ?? null, config: config ?? null, updatedAt: new Date() })
        .where(eq(notificationChannels.channel, channel))
        .returning();
      if (!updated) return res.status(404).json({ message: "Channel not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update notification channel" });
    }
  });

  app.get("/api/admin/config/system-notifications", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const notifs = await db.select().from(systemNotifications).orderBy(desc(systemNotifications.createdAt)).limit(50);
      res.json(notifs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch system notifications" });
    }
  });

  app.post("/api/admin/config/system-notifications", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { title, message: msg, type, targetAudience, targetCompanyId, expiresAt } = req.body;
      if (!title || !msg) return res.status(400).json({ message: "Title and message are required" });
      const [notif] = await db.insert(systemNotifications).values({
        title, message: msg, type: type || "info", targetAudience: targetAudience || "all",
        targetCompanyId: targetCompanyId || null, expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: req.session.userId!, isActive: true,
      }).returning();
      res.json(notif);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.delete("/api/admin/config/system-notifications/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(systemNotifications).where(eq(systemNotifications.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  app.get("/api/admin/config/email-limits", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const plans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true)).orderBy(subscriptionPlans.sortOrder);
      const rawEmailSettings = await db.select().from(companyEmailSettings);
      const safeEmailSettings = rawEmailSettings.map(s => ({ ...s, smtpPassword: s.smtpPassword ? "••••••••" : null }));
      const companies_list = await db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.isArchived, false));
      res.json({ plans, emailSettings: safeEmailSettings, companies: companies_list });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch email limits" });
    }
  });

  app.get("/api/admin/config/company-email/:companyId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) return res.status(400).json({ message: "Invalid company ID" });
      const [settings] = await db.select().from(companyEmailSettings).where(eq(companyEmailSettings.companyId, companyId));
      if (settings) {
        settings.smtpPassword = settings.smtpPassword ? "••••••••" : null;
      }
      res.json(settings || null);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch company email settings" });
    }
  });

  const emailSettingsSchema = z.object({
    enabled: z.boolean().optional(),
    smtpHost: z.string().max(255).optional().nullable(),
    smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
    smtpUsername: z.string().max(255).optional().nullable(),
    smtpPassword: z.string().max(255).optional().nullable(),
    fromAddress: z.string().email().max(255).optional().nullable().or(z.literal("")),
    fromName: z.string().max(255).optional().nullable(),
    encryption: z.enum(["none", "tls", "ssl"]).optional().nullable(),
  });

  app.put("/api/admin/config/company-email/:companyId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) return res.status(400).json({ message: "Invalid company ID" });
      const parsed = emailSettingsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid email settings", errors: parsed.error.flatten() });
      const { enabled, smtpHost, smtpPort, smtpUsername, smtpPassword, fromAddress, fromName, encryption } = parsed.data;
      const [existing] = await db.select().from(companyEmailSettings).where(eq(companyEmailSettings.companyId, companyId));
      if (existing) {
        const updateData: any = { enabled, smtpHost, smtpPort, smtpUsername, fromAddress, fromName, encryption, updatedAt: new Date() };
        if (smtpPassword && smtpPassword !== "••••••••") updateData.smtpPassword = smtpPassword;
        const [updated] = await db.update(companyEmailSettings).set(updateData).where(eq(companyEmailSettings.companyId, companyId)).returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(companyEmailSettings).values({
          companyId, enabled: enabled ?? false, smtpHost, smtpPort: smtpPort || 587,
          smtpUsername, smtpPassword, fromAddress, fromName, encryption: encryption || "tls",
        }).returning();
        res.json(created);
      }
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update company email settings" });
    }
  });

  app.get("/api/company/email-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const [settings] = await db.select().from(companyEmailSettings).where(eq(companyEmailSettings.companyId, companyId));
      if (settings) {
        settings.smtpPassword = settings.smtpPassword ? "••••••••" : null;
      }
      res.json(settings || null);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch email settings" });
    }
  });

  app.put("/api/company/email-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || (user.role !== "company_admin" && user.role !== "super_admin")) {
        return res.status(403).json({ message: "Only company admins can update email settings" });
      }
      const companyId = req.session.companyId!;
      const parsed = emailSettingsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid email settings", errors: parsed.error.flatten() });
      const { enabled, smtpHost, smtpPort, smtpUsername, smtpPassword, fromAddress, fromName, encryption } = parsed.data;
      const [existing] = await db.select().from(companyEmailSettings).where(eq(companyEmailSettings.companyId, companyId));
      if (existing) {
        const updateData: any = { enabled, smtpHost, smtpPort, smtpUsername, fromAddress, fromName, encryption, updatedAt: new Date() };
        if (smtpPassword && smtpPassword !== "••••••••") updateData.smtpPassword = smtpPassword;
        const [updated] = await db.update(companyEmailSettings).set(updateData).where(eq(companyEmailSettings.companyId, companyId)).returning();
        updated.smtpPassword = updated.smtpPassword ? "••••••••" : null;
        res.json(updated);
      } else {
        const [created] = await db.insert(companyEmailSettings).values({
          companyId, enabled: enabled ?? false, smtpHost, smtpPort: smtpPort || 587,
          smtpUsername, smtpPassword, fromAddress, fromName, encryption: encryption || "tls",
        }).returning();
        created.smtpPassword = created.smtpPassword ? "••••••••" : null;
        res.json(created);
      }
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update email settings" });
    }
  });

  app.get("/api/system-notifications/active", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId!;
      const now = new Date();
      const notifs = await db.select().from(systemNotifications)
        .where(eq(systemNotifications.isActive, true))
        .orderBy(desc(systemNotifications.createdAt));
      const filtered = notifs.filter(n => {
        if (n.expiresAt && n.expiresAt < now) return false;
        if (n.targetAudience === "all") return true;
        if (n.targetAudience === "specific" && n.targetCompanyId === companyId) return true;
        return false;
      });
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  return httpServer;
}
