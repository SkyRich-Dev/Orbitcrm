import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Edit,
  Briefcase,
  Calendar,
  Brain,
  Target,
} from "lucide-react";
import type { Deal, PipelineStage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ViewSwitcher, type ViewType } from "@/components/view-switcher";
import { KanbanBoard, type KanbanColumn, type KanbanItem } from "@/components/kanban-board";
import { CalendarView, type CalendarEvent } from "@/components/calendar-view";
import { ActivityTimeline } from "@/components/activity-timeline";

const createDealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  value: z.string().optional().or(z.literal("")),
  stageId: z.number().optional(),
  status: z.string().default("open"),
  notes: z.string().optional().or(z.literal("")),
});

type CreateDealForm = z.infer<typeof createDealSchema>;

const editDealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  value: z.string().optional().or(z.literal("")),
  stageId: z.number().optional(),
  status: z.string().default("open"),
  notes: z.string().optional().or(z.literal("")),
});

type EditDealForm = z.infer<typeof editDealSchema>;

function DealCard({ deal, stages }: { deal: Deal; stages: PipelineStage[] }) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const stage = stages.find((s) => s.id === deal.stageId);

  const editForm = useForm<EditDealForm>({
    resolver: zodResolver(editDealSchema),
    defaultValues: {
      title: deal.title,
      value: deal.value ? String(deal.value) : "",
      stageId: deal.stageId ?? undefined,
      status: deal.status ?? "open",
      notes: deal.notes ?? "",
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/deals/${deal.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "Deal deleted" });
    },
  });

  const editMutation = useMutation({
    mutationFn: (data: EditDealForm) =>
      apiRequest("PATCH", `/api/deals/${deal.id}`, {
        ...data,
        value: data.value || "0",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setEditOpen(false);
      toast({ title: "Deal updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusVariant = deal.status === "won" ? "default" : deal.status === "lost" ? "destructive" : "secondary";

  return (
    <>
      <Card data-testid={`card-deal-${deal.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold truncate">{deal.title}</h3>
                <Badge variant={statusVariant} className="text-xs capitalize">{deal.status}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {stage && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color || "#1565C0" }} />
                    {stage.name}
                  </span>
                )}
                {deal.value && Number(deal.value) > 0 && (
                  <span className="text-sm font-semibold">${Number(deal.value).toLocaleString()}</span>
                )}
                {deal.expectedCloseDate && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(deal.expectedCloseDate).toLocaleDateString()}
                  </span>
                )}
                {deal.aiCloseProbability !== null && deal.aiCloseProbability !== undefined && Number(deal.aiCloseProbability) > 0 && (
                  <span className="flex items-center gap-1 text-xs" data-testid={`ai-prob-deal-${deal.id}`} title={deal.aiNextAction || "AI Prediction"}>
                    <Target className="w-3 h-3 text-chart-4" />
                    <span className={`font-bold ${Number(deal.aiCloseProbability) >= 70 ? "text-chart-2" : Number(deal.aiCloseProbability) >= 40 ? "text-chart-4" : "text-muted-foreground"}`}>
                      {Math.round(Number(deal.aiCloseProbability))}%
                    </span>
                  </span>
                )}
                {deal.aiForecastAmount !== null && deal.aiForecastAmount !== undefined && Number(deal.aiForecastAmount) > 0 && (
                  <span className="text-xs text-muted-foreground" data-testid={`ai-forecast-deal-${deal.id}`}>
                    Forecast: ${Number(deal.aiForecastAmount).toLocaleString()}
                  </span>
                )}
              </div>
              {deal.aiNextAction && (
                <p className="text-xs text-chart-4 mt-1 truncate" data-testid={`ai-action-deal-${deal.id}`}>
                  <Brain className="w-3 h-3 inline mr-1" />{deal.aiNextAction}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-deal-menu-${deal.id}`}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    editForm.reset({
                      title: deal.title,
                      value: deal.value ? String(deal.value) : "",
                      stageId: deal.stageId ?? undefined,
                      status: deal.status ?? "open",
                      notes: deal.notes ?? "",
                    });
                    setEditOpen(true);
                  }}
                  data-testid={`button-edit-deal-${deal.id}`}
                >
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate()}
                  data-testid={`button-delete-deal-${deal.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Deal</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d))} className="space-y-4">
              <FormField control={editForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Title</FormLabel>
                  <FormControl><Input data-testid="input-edit-deal-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value ($)</FormLabel>
                    <FormControl><Input type="number" data-testid="input-edit-deal-value" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="stageId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-deal-stage">
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-deal-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea data-testid="input-edit-deal-notes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={editMutation.isPending} data-testid="button-submit-edit-deal">
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DealsPage() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewType>("list");
  const { toast } = useToast();

  const { data: rawDeals, isLoading } = useQuery<Deal[]>({ queryKey: ["/api/deals"] });
  const { data: rawStages } = useQuery<PipelineStage[]>({ queryKey: ["/api/pipeline-stages"] });
  const deals = rawDeals ?? [];
  const stages = rawStages ?? [];

  const form = useForm<CreateDealForm>({
    resolver: zodResolver(createDealSchema),
    defaultValues: { title: "", value: "", status: "open", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDealForm) =>
      apiRequest("POST", "/api/deals", {
        ...data,
        value: data.value || "0",
        stageId: data.stageId || stages[0]?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      form.reset();
      setOpen(false);
      toast({ title: "Deal created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: number; stageId: number }) =>
      apiRequest("PATCH", `/api/deals/${id}`, { stageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "Deal moved", description: "Stage updated successfully." });
    },
  });

  const aiPredictMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/predict-deals"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "AI Predictions Complete", description: "Deal predictions have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run AI predictions", variant: "destructive" });
    },
  });

  const filteredDeals = deals.filter((d) => {
    if (!search) return true;
    return d.title.toLowerCase().includes(search.toLowerCase());
  });

  const totalValue = filteredDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  const kanbanColumns: KanbanColumn[] = sortedStages.map((s) => ({
    id: String(s.id),
    title: s.name,
    color: s.color || "#1565C0",
  }));

  const kanbanItems: KanbanItem[] = filteredDeals
    .filter((d) => d.stageId)
    .map((d) => ({
      id: String(d.id),
      columnId: String(d.stageId),
      title: d.title,
      subtitle: d.status ?? undefined,
      value: Number(d.value || 0),
      badge: d.status ?? undefined,
      meta: d.expectedCloseDate
        ? `Close: ${new Date(d.expectedCloseDate).toLocaleDateString()}`
        : undefined,
    }));

  const calendarEvents: CalendarEvent[] = filteredDeals.map((d) => ({
    id: String(d.id),
    title: d.title,
    date: d.expectedCloseDate ? new Date(d.expectedCloseDate) : new Date(d.createdAt),
    color: sortedStages.find((s) => s.id === d.stageId)?.color || "#1565C0",
    meta: `$${Number(d.value || 0).toLocaleString()} - ${d.status}`,
  }));

  function handleStageChange(itemId: string, newColumnId: string) {
    stageMutation.mutate({ id: Number(itemId), stageId: Number(newColumnId) });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Deals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {filteredDeals.length} deals worth ${totalValue.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => aiPredictMutation.mutate()}
            disabled={aiPredictMutation.isPending}
            data-testid="button-ai-predict-deals"
          >
            <Brain className="w-4 h-4 mr-2" />
            {aiPredictMutation.isPending ? "Predicting..." : "AI Predict"}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-deal">
                <Plus className="w-4 h-4 mr-2" /> Add Deal
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Deal</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Title</FormLabel>
                    <FormControl><Input placeholder="Enterprise Contract" data-testid="input-deal-title" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="value" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value ($)</FormLabel>
                      <FormControl><Input type="number" placeholder="50000" data-testid="input-deal-value" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="stageId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage</FormLabel>
                      <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-deal-stage">
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stages.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea placeholder="Deal details..." data-testid="input-deal-notes" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-deal">
                  {createMutation.isPending ? "Creating..." : "Create Deal"}
                </Button>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-deals"
          />
        </div>
        <ViewSwitcher value={view} onChange={setView} />
      </div>

      {view === "list" && (
        <div className="space-y-2">
          {filteredDeals.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold">No deals found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Create your first deal to get started"}
              </p>
            </div>
          ) : (
            filteredDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} stages={stages} />
            ))
          )}
        </div>
      )}

      {view === "kanban" && (
        <KanbanBoard
          columns={kanbanColumns}
          items={kanbanItems}
          onStageChange={handleStageChange}
        />
      )}

      {view === "calendar" && (
        <CalendarView events={calendarEvents} />
      )}

      {view === "activity" && (
        <ActivityTimeline entityType="deal" />
      )}
    </div>
  );
}
