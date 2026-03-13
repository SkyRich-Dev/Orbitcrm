import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import {
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Trash2,
  Edit,
  Users,
  Brain,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import type { Lead, PipelineStage } from "@shared/schema";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ViewSwitcher, type ViewType } from "@/components/view-switcher";
import { KanbanBoard, type KanbanColumn, type KanbanItem } from "@/components/kanban-board";
import { CalendarView, type CalendarEvent } from "@/components/calendar-view";
import { ActivityTimeline } from "@/components/activity-timeline";

const createLeadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  source: z.string().optional().or(z.literal("")),
  value: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type CreateLeadForm = z.infer<typeof createLeadSchema>;

function LeadCard({ lead, stages }: { lead: Lead; stages: PipelineStage[] }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const stage = stages.find((s) => s.id === lead.stageId);

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/leads/${lead.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete lead", description: err.message, variant: "destructive" });
    },
  });

  const initials = `${lead.firstName[0]}${lead.lastName[0]}`.toUpperCase();
  const scoreColor =
    (lead.score || 0) >= 70
      ? "text-chart-2"
      : (lead.score || 0) >= 40
        ? "text-chart-4"
        : "text-muted-foreground";

  return (
    <Card data-testid={`card-lead-${lead.id}`} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation(`/leads/${lead.id}`)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar className="w-10 h-10 shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold truncate">{lead.firstName} {lead.lastName}</h3>
                {stage && (
                  <Badge variant="secondary" className="text-xs">{stage.name}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{lead.title}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {lead.email && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" /> {lead.email}
                  </span>
                )}
                {lead.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" /> {lead.phone}
                  </span>
                )}
                {lead.company && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3" /> {lead.company}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lead.aiScore !== null && lead.aiScore !== undefined && Number(lead.aiScore) > 0 && (
              <div className="flex items-center gap-1" data-testid={`ai-score-lead-${lead.id}`} title={lead.aiRecommendation || "AI Score"}>
                <Sparkles className="w-3 h-3 text-chart-4" />
                <span className={`text-xs font-bold ${Number(lead.aiScore) >= 70 ? "text-chart-2" : Number(lead.aiScore) >= 40 ? "text-chart-4" : "text-muted-foreground"}`}>
                  {Math.round(Number(lead.aiScore))}
                </span>
              </div>
            )}
            {lead.value && Number(lead.value) > 0 && (
              <span className="text-sm font-semibold">${Number(lead.value).toLocaleString()}</span>
            )}
            <span className={`text-xs font-medium ${scoreColor}`}>{lead.score || 0}pts</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-lead-menu-${lead.id}`} onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => setLocation(`/leads/${lead.id}`)} data-testid={`button-view-lead-${lead.id}`}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation(`/leads/${lead.id}`)} data-testid={`button-edit-lead-${lead.id}`}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate()}
                  data-testid={`button-delete-lead-${lead.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LeadsPage() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewType>("list");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: rawLeads, isLoading } = useQuery<Lead[]>({ queryKey: ["/api/leads"] });
  const { data: rawStages } = useQuery<PipelineStage[]>({ queryKey: ["/api/pipeline-stages"] });
  const leads = rawLeads ?? [];
  const stages = rawStages ?? [];

  const form = useForm<CreateLeadForm>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      title: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      source: "",
      value: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLeadForm) =>
      apiRequest("POST", "/api/leads", {
        ...data,
        value: data.value || "0",
        stageId: stages[0]?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      form.reset();
      setOpen(false);
      toast({ title: "Lead created", description: "New lead has been added to the pipeline." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: number; stageId: number }) =>
      apiRequest("PATCH", `/api/leads/${id}`, { stageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead moved", description: "Stage updated successfully." });
    },
  });

  const aiScoreMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/score-leads"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "AI Scoring Complete", description: "Lead scores have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run AI scoring", variant: "destructive" });
    },
  });

  const filteredLeads = leads.filter((lead) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      lead.firstName.toLowerCase().includes(s) ||
      lead.lastName.toLowerCase().includes(s) ||
      lead.title.toLowerCase().includes(s) ||
      (lead.email || "").toLowerCase().includes(s) ||
      (lead.company || "").toLowerCase().includes(s)
    );
  });

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  const kanbanColumns: KanbanColumn[] = sortedStages.map((s) => ({
    id: String(s.id),
    title: s.name,
    color: s.color || "#1565C0",
  }));

  const kanbanItems: KanbanItem[] = filteredLeads
    .filter((l) => l.stageId)
    .map((l) => ({
      id: String(l.id),
      columnId: String(l.stageId),
      title: `${l.firstName} ${l.lastName}`,
      subtitle: l.title,
      value: Number(l.value || 0),
      badge: l.source || "Direct",
      meta: l.company || undefined,
    }));

  const calendarEvents: CalendarEvent[] = filteredLeads.map((l) => ({
    id: String(l.id),
    title: `${l.firstName} ${l.lastName}`,
    date: new Date(l.createdAt),
    color: sortedStages.find((s) => s.id === l.stageId)?.color || "#1565C0",
    meta: `${l.title} - $${Number(l.value || 0).toLocaleString()}`,
  }));

  function handleStageChange(itemId: string, newColumnId: string) {
    stageMutation.mutate({ id: Number(itemId), stageId: Number(newColumnId) });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and track your sales leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => aiScoreMutation.mutate()}
            disabled={aiScoreMutation.isPending}
            data-testid="button-ai-score-leads"
          >
            <Brain className="w-4 h-4 mr-2" />
            {aiScoreMutation.isPending ? "Scoring..." : "AI Score"}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-lead">
                <Plus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title / Deal Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enterprise License" data-testid="input-lead-title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" data-testid="input-lead-firstname" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" data-testid="input-lead-lastname" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" data-testid="input-lead-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 234 567 890" data-testid="input-lead-phone" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Inc." data-testid="input-lead-company" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lead-source">
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="website">Website</SelectItem>
                            <SelectItem value="referral">Referral</SelectItem>
                            <SelectItem value="social">Social Media</SelectItem>
                            <SelectItem value="email">Email Campaign</SelectItem>
                            <SelectItem value="cold_call">Cold Call</SelectItem>
                            <SelectItem value="event">Event</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Value ($)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="10000" data-testid="input-lead-value" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes..." data-testid="input-lead-notes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-lead">
                  {createMutation.isPending ? "Creating..." : "Create Lead"}
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
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-leads"
          />
        </div>
        <ViewSwitcher value={view} onChange={setView} />
      </div>

      {view === "list" && (
        <div className="space-y-2">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold">No leads found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Add your first lead to get started"}
              </p>
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} stages={stages} />
            ))
          )}
        </div>
      )}

      {view === "kanban" && (
        <KanbanBoard
          columns={kanbanColumns}
          items={kanbanItems}
          onStageChange={handleStageChange}
          onItemClick={(item) => setLocation(`/leads/${item.id}`)}
        />
      )}

      {view === "calendar" && (
        <CalendarView
          events={calendarEvents}
          onEventClick={(event) => setLocation(`/leads/${event.id}`)}
        />
      )}

      {view === "activity" && (
        <ActivityTimeline
          entityType="lead"
          onEntityClick={(entityType, entityId) => {
            if (entityType === "lead") {
              setLocation(`/leads/${entityId}`);
            }
          }}
        />
      )}
    </div>
  );
}
