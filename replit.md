# Orbit CRM

## Overview

Orbit CRM (by SkyRich Tech Solutions Pte Ltd) is a multi-tenant SaaS CRM platform for SMEs, offering lead, contact, deal management, task tracking, and analytics. It ensures data isolation, role-based access, and supports theming. Built as a full-stack TypeScript monorepo with React and Express, its vision is to provide a scalable, user-friendly CRM to streamline sales, improve customer relations, and drive SME growth, aiming for a significant market share with a feature-rich, competitively priced platform focused on UX and data security.

### Brand Identity
- **Logo**: "Orbit CRM" text with gradient (rose-500 → red-400 → orange-500) on "CRM", orbital SVG icon in gradient pill.
- **Primary Color**: HSL 2 76% 44% (rose/red), replacing previous blue (217 91% 35%).
- **Font**: Inter (sans-serif).
- **Logo Component**: `client/src/components/orbit-logo.tsx` — reusable `OrbitLogo` component with variants (default, dark, mono, icon-only) and sizes (sm, md, lg, xl).
- **Branding applied to**: Landing page, login, register, app sidebar, admin sidebar, HTML title.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Structure
- **Monorepo**: Consists of `client/` (React), `server/` (Express), and `shared/` (common types/schemas).
- **Path Aliases**: `@/` for `client/src/` and `@shared/` for `shared/`.

### Frontend Architecture
- **Framework**: React (Vite, TypeScript, TSX) with `wouter` for routing.
- **State Management**: React Context API for auth/theming; TanStack React Query for server state.
- **UI**: `shadcn/ui` (New York style) on Radix UI, styled with Tailwind CSS.
- **Forms**: React Hook Form with Zod for validation.
- **Charts**: Recharts for analytics.
- **Theming**: Light/dark mode.
- **Error Handling**: Global `ErrorBoundary`.

### Backend Architecture
- **Framework**: Express 5 (TypeScript, ESM).
- **Data Storage**: Drizzle ORM via `IStorage` interface.
- **Authentication**: Session-based using `express-session` and `connect-pg-simple`; passwords hashed with Node.js `crypto.scrypt`.
- **Validation**: Zod schemas.
- **Error Handling**: Structured JSON error responses.
- **Build**: Vite for frontend, esbuild for server.

### Multi-Tenant Architecture
- Data isolation enforced by `companyId` in core tables and storage methods.
- Session stores `userId` and `companyId`.

### Database Schema (PostgreSQL via Drizzle ORM)
- Key tables include `companies`, `users`, `leads`, `contacts`, `deals`, `activities`, `tasks`, and tables for subscriptions, payments, AI features, WhatsApp integration, dynamic module/feature control, `platform_settings`, `notification_channels`, `company_email_settings`, and `system_notifications`.

### Platform Super Admin
- Dedicated `super_admin` role with access to `/api/admin/*` routes for managing tenants, plans, subscriptions, and staff.
- Frontend includes `AdminLayout` and `AdminSidebar` for super admin functionalities.
- **Tenant Management**: Full CRUD with add/edit/archive/restore. Archive = soft delete (sets `isArchived=true`, `archivedAt` timestamp). Tenant creation requires a plan selection. Archived tenants cannot log in.
- **Staff Management**: Super admin can create staff members for any tenant, assign roles (company_admin, sales_manager, sales_executive), and toggle granular permissions (manage_leads, manage_contacts, etc.). Staff can be activated/deactivated. Deactivated users cannot log in.
- **Plan Management**: Upgrade/downgrade tenant subscription plans, change billing cycle, update status from admin panel.
- **Configuration Center** (`/admin/config`): Tabbed interface for platform-wide settings management:
  - **Payment Gateways**: Stripe & Razorpay API key config, mode (test/live), webhook secrets. Secrets masked in API responses.
  - **Notifications**: Enable/disable notification channels (Email, SMS, WhatsApp, Push), configure providers.
  - **System Email**: Platform-level SMTP settings for system emails (password resets, alerts).
  - **System Alerts**: Create/delete system-wide notifications sent to all or specific tenants, with type (info/warning/error/maintenance/success) and optional expiration.
  - **Client Email**: View email limits per plan, email usage per company, and configure per-tenant SMTP settings.
- **Client Email Settings (Tenant)**: Company admins can configure their own SMTP settings via the Settings page (`/settings`) — Email Settings section with SMTP host/port/username/password/from address/name, usage counter.
- Admin pages: `/admin` (dashboard), `/admin/tenants`, `/admin/staff`, `/admin/plans`, `/admin/subscriptions`, `/admin/config`.

### API Routes
- Comprehensive CRUD operations for CRM entities (leads, contacts, deals, tasks, settings).
- Authentication required for most routes, handled by `requireAuth` middleware.
- Specific APIs for authentication, user management, dashboard statistics, pipeline, AI features, billing, and platform administration.

### Landing Page
- Public landing page at `/` with hero, features, pricing, about, contact, and CTA sections.
- Navigation links for "Sign In" and "Get Started".

### Authentication Flow
- Session-based authentication; `AuthProvider` restores session via `/api/auth/me`.
- `AuthGate` manages views for authenticated vs. unauthenticated users.

### Multi-View System
- Supports List, Kanban, Calendar, and Activity Timeline views for various modules.

### AI Smart Features
- Algorithmic AI engine (no external API) for lead scoring, sales prediction, task automation, and AI insights (risk alerts, anomalies).
- Dedicated `/ai` page for configuration, insights, and actions.

### Automation Page
- `/automation` provides full management of automation rules, including viewing, creating, and activating rules with triggers, conditions, and actions.

### Reports & Analytics Page
- `/reports` offers CRM analytics including summary cards, leads by source/status, and deal pipeline summaries.

### Lead Detail Page
- Two-column layout with lead overview, activity composer, timeline, salesperson allocation, and AI insights. Supports inline editing and activity logging.

### WhatsApp Integration
- Database tables for settings, messages, contacts, and command logs.
- Backend API for managing WhatsApp settings, contacts, messages, and commands.
- Frontend tabbed page at `/whatsapp` for inbox, contacts, commands, and settings, including a chat UI and CRM command console.

### SaaS Billing & Subscription System
- Configurable Free, Starter, Professional, Enterprise plans with feature gating and usage limits.
- **Auto Free Plan**: New tenant registrations automatically receive the Free plan (no signup without a plan). Registration uses `createTenantWithPlan` transactionally.
- **Pro-Rata Billing**: Plan upgrades/downgrades calculate pro-rata adjustments based on days remaining in the billing cycle. Response includes `unusedCredit`, `proratedCharge`, and `netAmount`. Frontend shows a Pro-Rata Adjustment dialog with the breakdown.
- Database tables for plans, subscriptions, transactions, and feature usage.
- Backend services for feature access (`FeatureAccessService`) and payment gateways (`StripeService`, `RazorpayService`).
- Frontend `/settings/billing` page for managing plans, usage, and payment history.

### Dynamic Module & Feature Control System
- Dynamic registration of CRM modules and features in `module_registry` and `feature_registry`.
- `PackageFeatures` maps features to subscription plans; `CompanyFeatureOverrides` allows per-company customization.
- `FeatureAccessService` resolves feature access with caching, providing `requireFeature`, `requireModule`, `requireLimit` middleware.
- Frontend hook `useCompanyFeatures()` and `useFeatureAccess()` for dynamic UI rendering.
- Dynamic sidebar and feature management in settings based on enabled modules and features.

### Third-Party Integration Marketplace
- **Database tables**: `integration_apps` (31 apps across 7 categories), `company_integrations` (tracks which company connected which app), `integration_logs` (logs sync activities).
- **7 Categories**: Communication & Messaging, Email Platforms, Payment Gateways, Accounting Software, E-commerce Platforms, Marketing & Advertising, Calendar & Productivity.
- **Feature gating**: `integration_marketplace` feature registered in `feature_registry` and `package_features`. Only paid plans (Starter, Professional, Enterprise) have access; Free plan users see an upgrade prompt.
- **API endpoints**: `GET /api/integrations` (marketplace list grouped by category), `GET /api/integrations/connected` (company's connected apps), `POST /api/integrations/connect`, `PATCH /api/integrations/:id`, `DELETE /api/integrations/:id`, `POST /api/integrations/:id/sync`, `GET /api/integrations/logs`.
- **Permissions**: Only `company_admin` and `super_admin` can connect/disconnect/update/sync integrations. Other users can view status only.
- **Credentials**: Stored in `credentials` JSONB column. Never returned in API responses. Each integration has a dynamic `config_schema` defining the credential fields.
- **Frontend**: `/integrations` or `/settings/integrations` page with Marketplace (grid cards with search/filter), Connected (management table), and Activity Logs tabs.
- **Sidebar**: Integrations module registered in `module_registry` with `Puzzle` icon.

### Tenant Custom Subdomain & Branding System
- `companies` table includes `subdomain`, `domainStatus`, `brandingSettings` (logo, colors, CRM title, etc.), and `homepageSettings` (welcome message, hero image, contact info).
- Subdomain system allows tenants to have unique subdomains with validation and reserved subdomain blocking.
- API routes for checking subdomain availability, setting subdomains, and managing branding/homepage settings.
- Frontend `BrandingProvider` applies custom branding via CSS variables, updates document title/favicon, and injects custom CSS.
- Settings page provides UI for subdomain, branding, and homepage configuration.

## External Dependencies

### Database
- PostgreSQL
- Drizzle ORM
- drizzle-zod

### Session Storage
- connect-pg-simple

### UI / Frontend Libraries
- Radix UI
- shadcn/ui
- Tailwind CSS
- Recharts
- wouter
- TanStack React Query
- React Hook Form + @hookform/resolvers
- date-fns
- lucide-react
- @dnd-kit (for drag-and-drop)

### Build Tools
- Vite
- esbuild
- tsx

### Security Hardening
- Helmet (security headers)
- express-rate-limit (rate limiting)
- Input sanitization (XSS prevention)
- Zod (input validation with length limits)
- Session security (HttpOnly, SameSite=Strict cookies, secure flag, no hardcoded secret)
- Request size limits
- Disabled X-Powered-By header
- Drizzle ORM (SQL injection protection)
- Multi-tenant isolation enforced by `companyId` filtering.

### Environment Variables
- `DATABASE_URL`
- `SESSION_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`