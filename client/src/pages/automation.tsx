import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Zap, Plus, Power, PowerOff, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AutomationRule } from "@shared/schema";

export default function AutomationPage() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState("lead_created");
  const [formConditions, setFormConditions] = useState("{}");
  const [formActions, setFormActions] = useState("{}");

  const { data: rawRules, isLoading } = useQuery<AutomationRule[]>({
    queryKey: ["/api/ai/automation-rules"],
  });
  const rules = rawRules ?? [];

  const createMutation = useMutation({
    mutationFn: (data: { name: string; triggerType: string; conditions: any; actions: any; isActive: boolean }) =>
      apiRequest("POST", "/api/ai/automation-rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/automation-rules"] });
      toast({ title: "Automation rule created" });
      setShowCreate(false);
      setFormName("");
      setFormTrigger("lead_created");
      setFormConditions("{}");
      setFormActions("{}");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create automation rule", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/ai/automation-rules/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/automation-rules"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update rule", variant: "destructive" });
    },
  });

  const triggerLabels: Record<string, string> = {
    lead_created: "Lead Created",
    lead_updated: "Lead Updated",
    deal_stage_changed: "Deal Stage Changed",
    task_overdue: "Task Overdue",
    contact_created: "Contact Created",
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Automation</h1>
          <p className="text-muted-foreground text-sm mt-1">Create rules to automate your CRM workflows</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} data-testid="button-create-rule">
          <Plus className="w-4 h-4 mr-1" />
          New Rule
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="text-sm font-semibold">Create Automation Rule</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Rule Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Auto-assign new leads"
                data-testid="input-rule-name"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Trigger Type</Label>
              <select
                value={formTrigger}
                onChange={(e) => setFormTrigger(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-trigger-type"
              >
                {Object.entries(triggerLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Conditions (JSON)</Label>
              <Input
                value={formConditions}
                onChange={(e) => setFormConditions(e.target.value)}
                placeholder='{"source": "website"}'
                data-testid="input-conditions"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Actions (JSON)</Label>
              <Input
                value={formActions}
                onChange={(e) => setFormActions(e.target.value)}
                placeholder='{"action": "assign", "to": "sales_team"}'
                data-testid="input-actions"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  let cond, act;
                  try { cond = JSON.parse(formConditions); } catch { cond = {}; }
                  try { act = JSON.parse(formActions); } catch { act = {}; }
                  createMutation.mutate({ name: formName, triggerType: formTrigger, conditions: cond, actions: act, isActive: true });
                }}
                disabled={!formName || createMutation.isPending}
                data-testid="button-save-rule"
              >
                {createMutation.isPending ? "Creating..." : "Create Rule"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)} data-testid="button-cancel-rule">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-semibold mb-1">No Automation Rules</h3>
            <p className="text-xs text-muted-foreground">Create your first rule to automate CRM workflows</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${rule.isActive ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
                      {rule.isActive ? <Power className="w-4 h-4 text-green-600" /> : <PowerOff className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        Trigger: <Badge variant="secondary" className="text-xs ml-1">{triggerLabels[rule.triggerType] || rule.triggerType}</Badge>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, isActive: checked })}
                      data-testid={`switch-rule-${rule.id}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
