import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  leads, deals, tasks, activities, pipelineStages, aiSettings, aiInsights, aiUsageLogs,
  type Lead, type Deal, type PipelineStage, type AiSettings,
} from "@shared/schema";

async function getOrCreateAiSettings(companyId: number): Promise<AiSettings> {
  const [existing] = await db.select().from(aiSettings).where(eq(aiSettings.companyId, companyId));
  if (existing) return existing;
  const [created] = await db.insert(aiSettings).values({
    companyId,
    enableAi: true,
    enableLeadScoring: true,
    enableSalesPrediction: true,
    enableTaskAutomation: true,
    enableInsights: true,
    monthlyUsageLimit: 1000,
    usageCount: 0,
  }).returning();
  return created;
}

async function checkAiEnabled(companyId: number, feature?: keyof AiSettings): Promise<boolean> {
  const settings = await getOrCreateAiSettings(companyId);
  if (!settings.enableAi) return false;
  if (settings.usageCount >= settings.monthlyUsageLimit) return false;
  if (feature && typeof settings[feature] === "boolean" && !settings[feature]) return false;
  return true;
}

async function logUsage(companyId: number, feature: string, details?: string) {
  await db.insert(aiUsageLogs).values({ companyId, feature, details });
  await db.update(aiSettings)
    .set({ usageCount: sql`${aiSettings.usageCount} + 1`, updatedAt: new Date() })
    .where(eq(aiSettings.companyId, companyId));
}

export async function scoreLeads(companyId: number): Promise<{ scored: number }> {
  const enabled = await checkAiEnabled(companyId, "enableLeadScoring");
  if (!enabled) return { scored: 0 };

  const allLeads = await db.select().from(leads).where(eq(leads.companyId, companyId));
  const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.companyId, companyId));
  const leadActivities = await db.select().from(activities)
    .where(and(eq(activities.companyId, companyId), eq(activities.entityType, "lead")));

  const stageMap = new Map(stages.map(s => [s.id, s]));

  for (const lead of allLeads) {
    let score = 0;
    let factors: string[] = [];

    if (lead.email) { score += 10; factors.push("has email"); }
    if (lead.phone) { score += 10; factors.push("has phone"); }
    if (lead.company) { score += 8; factors.push("company identified"); }
    if (lead.source) { score += 5; factors.push(`source: ${lead.source}`); }

    const sourceWeights: Record<string, number> = {
      referral: 15, website: 10, event: 12, social: 8, email: 7, cold_call: 5,
    };
    if (lead.source && sourceWeights[lead.source]) {
      score += sourceWeights[lead.source];
      factors.push(`source quality bonus`);
    }

    const value = Number(lead.value || 0);
    if (value > 0) {
      const valueScore = Math.min(20, Math.round(value / 5000));
      score += valueScore;
      factors.push(`value: $${value.toLocaleString()}`);
    }

    if (lead.stageId) {
      const stage = stageMap.get(lead.stageId);
      if (stage) {
        const stageScore = Math.round((stage.probability || 0) * 0.2);
        score += stageScore;
        factors.push(`stage: ${stage.name} (${stage.probability}%)`);
      }
    }

    const activityCount = leadActivities.filter(a => a.entityId === lead.id).length;
    const activityScore = Math.min(15, activityCount * 3);
    score += activityScore;
    if (activityCount > 0) factors.push(`${activityCount} activities`);

    if (lead.notes) { score += 5; factors.push("has notes"); }
    if (lead.tags && lead.tags.length > 0) { score += 3; factors.push(`${lead.tags.length} tags`); }

    const finalScore = Math.min(100, score);
    const probability = Math.min(99, Math.round(finalScore * 0.85));

    let recommendation = "";
    if (finalScore >= 80) recommendation = "Hot lead — prioritize immediate outreach and schedule a demo.";
    else if (finalScore >= 60) recommendation = "Warm lead — nurture with targeted content and follow up within 48 hours.";
    else if (finalScore >= 40) recommendation = "Developing lead — add to email drip campaign and monitor engagement.";
    else if (finalScore >= 20) recommendation = "Cold lead — enrich data and qualify further before investing effort.";
    else recommendation = "New lead — gather more information and verify contact details.";

    await db.update(leads)
      .set({
        aiScore: String(finalScore),
        aiProbability: String(probability),
        aiRecommendation: recommendation,
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, lead.id), eq(leads.companyId, companyId)));
  }

  await logUsage(companyId, "lead_scoring", `Scored ${allLeads.length} leads`);
  return { scored: allLeads.length };
}

export async function predictDeals(companyId: number): Promise<{ predicted: number }> {
  const enabled = await checkAiEnabled(companyId, "enableSalesPrediction");
  if (!enabled) return { predicted: 0 };

  const allDeals = await db.select().from(deals).where(eq(deals.companyId, companyId));
  const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.companyId, companyId));
  const dealActivities = await db.select().from(activities)
    .where(and(eq(activities.companyId, companyId), eq(activities.entityType, "deal")));

  const stageMap = new Map(stages.map(s => [s.id, s]));
  const wonDeals = allDeals.filter(d => d.status === "won");
  const historicalWinRate = allDeals.length > 0 ? wonDeals.length / allDeals.length : 0.3;

  for (const deal of allDeals) {
    if (deal.status === "won" || deal.status === "lost") {
      const prob = deal.status === "won" ? "100" : "0";
      await db.update(deals)
        .set({
          aiCloseProbability: prob,
          aiForecastAmount: deal.status === "won" ? deal.value : "0",
          aiNextAction: deal.status === "won" ? "Deal closed. Focus on upselling." : "Deal lost. Document lessons learned.",
          updatedAt: new Date(),
        })
        .where(and(eq(deals.id, deal.id), eq(deals.companyId, companyId)));
      continue;
    }

    let probability = 0;

    if (deal.stageId) {
      const stage = stageMap.get(deal.stageId);
      if (stage) {
        probability = stage.probability || 20;
      }
    }

    const activityCount = dealActivities.filter(a => a.entityId === deal.id).length;
    if (activityCount > 3) probability = Math.min(95, probability + 10);
    else if (activityCount > 0) probability = Math.min(95, probability + 5);

    const dealAge = (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (dealAge > 60) probability = Math.max(5, probability - 15);
    else if (dealAge > 30) probability = Math.max(5, probability - 5);

    const value = Number(deal.value || 0);
    probability = Math.round(probability * (0.7 + historicalWinRate * 0.3));
    probability = Math.min(95, Math.max(5, probability));

    const forecastAmount = Math.round(value * probability / 100);

    let nextAction = "";
    if (probability >= 70) nextAction = "High probability — prepare proposal and push for close.";
    else if (probability >= 50) nextAction = "Good momentum — schedule a follow-up meeting this week.";
    else if (probability >= 30) nextAction = "Needs attention — re-engage stakeholder and address objections.";
    else nextAction = "At risk — reassess deal viability and consider pivoting approach.";

    if (dealAge > 30 && activityCount === 0) {
      nextAction = "Stale deal — no recent activity. Reach out immediately or consider closing.";
    }

    if (deal.expectedCloseDate) {
      const daysToClose = (new Date(deal.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToClose < 0) nextAction = "Past expected close date — update timeline or close deal.";
      else if (daysToClose < 7) nextAction = "Closing soon — finalize terms and send contract.";
    }

    await db.update(deals)
      .set({
        aiCloseProbability: String(probability),
        aiForecastAmount: String(forecastAmount),
        aiNextAction: nextAction,
        updatedAt: new Date(),
      })
      .where(and(eq(deals.id, deal.id), eq(deals.companyId, companyId)));
  }

  await logUsage(companyId, "sales_prediction", `Predicted ${allDeals.length} deals`);
  return { predicted: allDeals.length };
}

export async function generateAutomatedTasks(companyId: number): Promise<{ created: number }> {
  const enabled = await checkAiEnabled(companyId, "enableTaskAutomation");
  if (!enabled) return { created: 0 };

  let tasksCreated = 0;
  const now = new Date();

  const allLeads = await db.select().from(leads).where(eq(leads.companyId, companyId));
  const allDeals = await db.select().from(deals).where(eq(deals.companyId, companyId));
  const allActivities = await db.select().from(activities).where(eq(activities.companyId, companyId));
  const existingTasks = await db.select().from(tasks).where(
    and(eq(tasks.companyId, companyId), eq(tasks.autoGenerated, true), eq(tasks.status, "pending"))
  );

  const existingTaskEntities = new Set(existingTasks.map(t => `${t.entityType}-${t.entityId}`));

  for (const lead of allLeads) {
    if (existingTaskEntities.has(`lead-${lead.id}`)) continue;

    const leadActs = allActivities.filter(a => a.entityType === "lead" && a.entityId === lead.id);
    const lastActivity = leadActs.length > 0
      ? new Date(Math.max(...leadActs.map(a => new Date(a.createdAt).getTime())))
      : new Date(lead.createdAt);
    const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity > 3) {
      const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await db.insert(tasks).values({
        companyId,
        title: `Follow up with ${lead.firstName} ${lead.lastName}`,
        description: `No activity for ${Math.round(daysSinceActivity)} days. Lead: ${lead.title}`,
        priority: daysSinceActivity > 7 ? "high" : "medium",
        status: "pending",
        entityType: "lead",
        entityId: lead.id,
        dueDate,
        autoGenerated: true,
        aiReason: `No activity detected for ${Math.round(daysSinceActivity)} days`,
      });
      tasksCreated++;
    }
  }

  for (const deal of allDeals) {
    if (deal.status === "won" || deal.status === "lost") continue;
    if (existingTaskEntities.has(`deal-${deal.id}`)) continue;

    const dealActs = allActivities.filter(a => a.entityType === "deal" && a.entityId === deal.id);
    const lastActivity = dealActs.length > 0
      ? new Date(Math.max(...dealActs.map(a => new Date(a.createdAt).getTime())))
      : new Date(deal.createdAt);
    const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity > 7) {
      const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await db.insert(tasks).values({
        companyId,
        title: `Review stale deal: ${deal.title}`,
        description: `Deal has had no activity for ${Math.round(daysSinceActivity)} days. Value: $${Number(deal.value || 0).toLocaleString()}`,
        priority: "high",
        status: "pending",
        entityType: "deal",
        entityId: deal.id,
        dueDate,
        autoGenerated: true,
        aiReason: `Deal stuck — no activity for ${Math.round(daysSinceActivity)} days`,
      });
      tasksCreated++;
    }

    if (deal.expectedCloseDate) {
      const daysToClose = (new Date(deal.expectedCloseDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysToClose > 0 && daysToClose < 3 && !existingTaskEntities.has(`deal-${deal.id}`)) {
        await db.insert(tasks).values({
          companyId,
          title: `Closing soon: ${deal.title}`,
          description: `Expected close date is in ${Math.round(daysToClose)} days. Prepare final steps.`,
          priority: "high",
          status: "pending",
          entityType: "deal",
          entityId: deal.id,
          dueDate: new Date(deal.expectedCloseDate),
          autoGenerated: true,
          aiReason: `Deal closing in ${Math.round(daysToClose)} days`,
        });
        tasksCreated++;
      }
    }
  }

  await logUsage(companyId, "task_automation", `Generated ${tasksCreated} tasks`);
  return { created: tasksCreated };
}

export async function generateInsights(companyId: number): Promise<{ generated: number }> {
  const enabled = await checkAiEnabled(companyId, "enableInsights");
  if (!enabled) return { generated: 0 };

  await db.delete(aiInsights).where(eq(aiInsights.companyId, companyId));

  const insightsToCreate: Array<{
    companyId: number; insightType: string; title: string;
    description: string; severity: string; entityType?: string; entityId?: number;
  }> = [];

  const allDeals = await db.select().from(deals).where(eq(deals.companyId, companyId));
  const allLeads = await db.select().from(leads).where(eq(leads.companyId, companyId));
  const allTasks = await db.select().from(tasks).where(eq(tasks.companyId, companyId));
  const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.companyId, companyId));
  const stageMap = new Map(stages.map(s => [s.id, s]));
  const now = Date.now();

  const openDeals = allDeals.filter(d => d.status === "open");
  const staleDeals = openDeals.filter(d => {
    const age = (now - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return age > 30;
  });

  if (staleDeals.length > 0) {
    const totalAtRisk = staleDeals.reduce((s, d) => s + Number(d.value || 0), 0);
    insightsToCreate.push({
      companyId,
      insightType: "revenue_risk",
      title: `${staleDeals.length} Stagnant Deal${staleDeals.length > 1 ? "s" : ""} Detected`,
      description: `$${totalAtRisk.toLocaleString()} in pipeline value is at risk from ${staleDeals.length} deal(s) with no progress in 30+ days.`,
      severity: totalAtRisk > 50000 ? "critical" : "warning",
    });
  }

  const totalPipeline = openDeals.reduce((s, d) => s + Number(d.value || 0), 0);
  const wonRevenue = allDeals.filter(d => d.status === "won").reduce((s, d) => s + Number(d.value || 0), 0);
  const predictedRevenue = openDeals.reduce((s, d) => {
    const prob = Number(d.aiCloseProbability || 30) / 100;
    return s + Number(d.value || 0) * prob;
  }, 0);

  if (totalPipeline > 0) {
    insightsToCreate.push({
      companyId,
      insightType: "forecast",
      title: "Pipeline Revenue Forecast",
      description: `Current pipeline: $${totalPipeline.toLocaleString()}. AI-predicted revenue: $${Math.round(predictedRevenue).toLocaleString()}. Won so far: $${wonRevenue.toLocaleString()}.`,
      severity: "info",
    });
  }

  const highValueLeads = allLeads.filter(l => Number(l.value || 0) > 25000);
  const lowScoreHighValue = highValueLeads.filter(l => Number(l.aiScore || 0) < 40);
  if (lowScoreHighValue.length > 0) {
    insightsToCreate.push({
      companyId,
      insightType: "growth_opportunity",
      title: `${lowScoreHighValue.length} High-Value Lead${lowScoreHighValue.length > 1 ? "s" : ""} Need Attention`,
      description: `Found ${lowScoreHighValue.length} lead(s) worth over $25K with low engagement scores. Targeted outreach could unlock significant revenue.`,
      severity: "warning",
    });
  }

  const overdueTasks = allTasks.filter(t => {
    if (t.status === "completed" || !t.dueDate) return false;
    return new Date(t.dueDate).getTime() < now;
  });
  if (overdueTasks.length > 0) {
    insightsToCreate.push({
      companyId,
      insightType: "performance",
      title: `${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? "s" : ""}`,
      description: `${overdueTasks.length} task(s) are past due. This may impact deal progression and customer satisfaction.`,
      severity: overdueTasks.length > 5 ? "critical" : "warning",
    });
  }

  const wonCount = allDeals.filter(d => d.status === "won").length;
  const lostCount = allDeals.filter(d => d.status === "lost").length;
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;
  if (wonCount + lostCount >= 3) {
    insightsToCreate.push({
      companyId,
      insightType: "performance",
      title: `Win Rate: ${winRate}%`,
      description: `Based on ${wonCount + lostCount} closed deals: ${wonCount} won, ${lostCount} lost. ${winRate > 50 ? "Above average performance!" : "Consider reviewing your sales process."}`,
      severity: winRate > 50 ? "info" : "warning",
    });
  }

  const newLeadsThisWeek = allLeads.filter(l => {
    const age = (now - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return age <= 7;
  }).length;
  if (newLeadsThisWeek > 0) {
    insightsToCreate.push({
      companyId,
      insightType: "growth_opportunity",
      title: `${newLeadsThisWeek} New Lead${newLeadsThisWeek > 1 ? "s" : ""} This Week`,
      description: `Your pipeline is growing with ${newLeadsThisWeek} new lead(s) in the past 7 days. Make sure to engage them quickly for best conversion rates.`,
      severity: "info",
    });
  }

  for (const insight of insightsToCreate) {
    await db.insert(aiInsights).values(insight);
  }

  await logUsage(companyId, "insights", `Generated ${insightsToCreate.length} insights`);
  return { generated: insightsToCreate.length };
}
