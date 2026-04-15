import { useQuery, useMutation } from "@tanstack/react-query";
import { Brain, TrendingUp, Target, Lightbulb, RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AiInsight } from "@shared/schema";

export default function AiInsightsPage() {
  const { toast } = useToast();

  const { data: rawInsights, isLoading } = useQuery<AiInsight[]>({
    queryKey: ["/api/ai/insights"],
  });
  const insights = rawInsights ?? [];

  const scoreMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/score-leads"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/insights"] });
      toast({ title: "Lead scoring complete" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to score leads", variant: "destructive" });
    },
  });

  const predictMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/predict-deals"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/insights"] });
      toast({ title: "Deal predictions generated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to predict deals", variant: "destructive" });
    },
  });

  const insightsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/generate-insights"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/insights"] });
      toast({ title: "Insights generated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate insights", variant: "destructive" });
    },
  });

  const tasksMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/generate-tasks"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/insights"] });
      toast({ title: "Automated tasks generated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate tasks", variant: "destructive" });
    },
  });

  const typeIcons: Record<string, typeof Brain> = {
    risk_alert: AlertTriangle,
    opportunity: TrendingUp,
    recommendation: Lightbulb,
    anomaly: AlertTriangle,
    scoring: Target,
    prediction: TrendingUp,
  };

  const typeColors: Record<string, string> = {
    risk_alert: "text-red-500",
    opportunity: "text-green-500",
    recommendation: "text-blue-500",
    anomaly: "text-yellow-500",
    scoring: "text-purple-500",
    prediction: "text-indigo-500",
  };

  const severityVariant = (severity: string) => {
    if (severity === "high" || severity === "critical") return "destructive" as const;
    if (severity === "medium" || severity === "warning") return "default" as const;
    return "secondary" as const;
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">AI & Insights</h1>
        <p className="text-muted-foreground text-sm mt-1">AI-powered analytics and recommendations for your CRM</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-1"
          onClick={() => scoreMutation.mutate()}
          disabled={scoreMutation.isPending}
          data-testid="button-score-leads"
        >
          <Target className="w-5 h-5 text-purple-500" />
          <span className="text-xs font-medium">{scoreMutation.isPending ? "Scoring..." : "Score Leads"}</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-1"
          onClick={() => predictMutation.mutate()}
          disabled={predictMutation.isPending}
          data-testid="button-predict-deals"
        >
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          <span className="text-xs font-medium">{predictMutation.isPending ? "Predicting..." : "Predict Deals"}</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-1"
          onClick={() => insightsMutation.mutate()}
          disabled={insightsMutation.isPending}
          data-testid="button-generate-insights"
        >
          <Lightbulb className="w-5 h-5 text-blue-500" />
          <span className="text-xs font-medium">{insightsMutation.isPending ? "Generating..." : "Generate Insights"}</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-1"
          onClick={() => tasksMutation.mutate()}
          disabled={tasksMutation.isPending}
          data-testid="button-auto-tasks"
        >
          <RefreshCw className="w-5 h-5 text-green-500" />
          <span className="text-xs font-medium">{tasksMutation.isPending ? "Generating..." : "Auto Tasks"}</span>
        </Button>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Insights</h2>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : insights.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold mb-1">No Insights Yet</h3>
              <p className="text-xs text-muted-foreground">Run the AI tools above to generate insights from your CRM data</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => {
              const insightKind = insight.insightType || "recommendation";
              const Icon = typeIcons[insightKind] || Lightbulb;
              const color = typeColors[insightKind] || "text-muted-foreground";
              return (
                <Card key={insight.id} data-testid={`card-insight-${insight.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-muted mt-0.5">
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold">{insight.title}</h4>
                          <Badge variant={severityVariant(insight.severity || "info")} className="text-xs capitalize">
                            {insight.severity || "info"}
                          </Badge>
                          {insight.isRead ? (
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                          ) : (
                            <Clock className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{insight.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
