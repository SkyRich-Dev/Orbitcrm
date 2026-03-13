import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  Mail,
  Phone as PhoneIcon,
  Building2,
  Edit,
  Trash2,
  Save,
  X,
  Brain,
  Sparkles,
  Target,
  CalendarDays,
  Clock,
  PhoneCall,
  Video,
  FileText,
  StickyNote,
  CheckSquare,
  User,
  DollarSign,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import type { Lead, PipelineStage, Activity, User as UserType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

type SafeUser = Omit<UserType, "password">;

const editLeadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  source: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

const activityFormSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional().or(z.literal("")),
  outcome: z.string().optional().or(z.literal("")),
  scheduledAt: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  duration: z.string().optional().or(z.literal("")),
  priority: z.string().optional().or(z.literal("")),
  assignTo: z.string().optional().or(z.literal("")),
});

const ACTIVITY_TYPES = [
  { key: "call", label: "Call", icon: PhoneCall, color: "text-chart-2" },
  { key: "meeting", label: "Meeting", icon: Video, color: "text-primary" },
  { key: "email", label: "Email", icon: Mail, color: "text-chart-4" },
  { key: "note", label: "Note", icon: StickyNote, color: "text-muted-foreground" },
  { key: "task", label: "Task", icon: CheckSquare, color: "text-chart-5" },
];

const SOURCES = ["website", "referral", "social", "email", "cold_call", "event"];
const STATUSES = ["new", "contacted", "qualified", "active", "inactive", "converted", "lost"];
const PRIORITIES = ["low", "medium", "high"];

function activityIcon(type: string) {
  const found = ACTIVITY_TYPES.find((a) => a.key === type);
  if (found) {
    const Icon = found.icon;
    return <Icon className={`w-3.5 h-3.5 ${found.color}`} />;
  }
  return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
}

function priorityBadge(priority: string) {
  const variant = priority === "high" ? "destructive" : priority === "medium" ? "secondary" : "outline";
  return <Badge variant={variant} className="text-xs capitalize" data-testid="badge-priority">{priority}</Badge>;
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = Number(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [activityDialog, setActivityDialog] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<string>("all");

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ["/api/leads", leadId],
    enabled: !!leadId,
  });

  const { data: rawStages } = useQuery<PipelineStage[]>({ queryKey: ["/api/pipeline-stages"] });
  const stages = rawStages ?? [];

  const { data: rawUsers } = useQuery<SafeUser[]>({ queryKey: ["/api/users"] });
  const teamUsers = rawUsers ?? [];

  const { data: rawActivities } = useQuery<Activity[]>({
    queryKey: ["/api/leads", leadId, "activities"],
    enabled: !!lead,
  });
  const allActivities = rawActivities ?? [];

  const filteredActivities = activityFilter === "all"
    ? allActivities
    : allActivities.filter((a) => a.type === activityFilter);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest("PATCH", `/api/leads/${leadId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update lead", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/leads/${leadId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead deleted" });
      setLocation("/leads");
    },
  });

  const activityMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest("POST", `/api/leads/${leadId}/activities`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "activities"] });
      setActivityDialog(null);
      toast({ title: "Activity logged" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log activity", variant: "destructive" });
    },
  });

  const aiScoreMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/score-leads"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      toast({ title: "AI Scoring Complete" });
    },
  });

  const editForm = useForm({
    resolver: zodResolver(editLeadSchema),
    defaultValues: {
      title: lead?.title || "",
      firstName: lead?.firstName || "",
      lastName: lead?.lastName || "",
      email: lead?.email || "",
      phone: lead?.phone || "",
      company: lead?.company || "",
      source: lead?.source || "",
      notes: lead?.notes || "",
    },
  });

  const activityForm = useForm({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      subject: "",
      description: "",
      outcome: "",
      scheduledAt: "",
      location: "",
      duration: "",
      priority: "medium",
      assignTo: "",
    },
  });

  function startEdit() {
    editForm.reset({
      title: lead?.title || "",
      firstName: lead?.firstName || "",
      lastName: lead?.lastName || "",
      email: lead?.email || "",
      phone: lead?.phone || "",
      company: lead?.company || "",
      source: lead?.source || "",
      notes: lead?.notes || "",
    });
    setEditing(true);
  }

  function saveEdit(data: z.infer<typeof editLeadSchema>) {
    updateMutation.mutate(data, { onSuccess: () => setEditing(false) });
  }

  function handleActivitySubmit(data: z.infer<typeof activityFormSchema>) {
    activityMutation.mutate({
      type: activityDialog,
      subject: data.subject,
      description: data.description,
      outcome: data.outcome,
      scheduledAt: data.scheduledAt || undefined,
      metadata: {
        location: data.location || undefined,
        duration: data.duration || undefined,
        priority: data.priority || undefined,
        assignTo: data.assignTo || undefined,
      },
    });
  }

  function openActivityDialog(type: string) {
    activityForm.reset({ subject: "", description: "", outcome: "", scheduledAt: "", location: "", duration: "", priority: "medium", assignTo: "" });
    setActivityDialog(type);
  }

  const currentStage = stages.find((s) => s.id === lead?.stageId);
  const assignedUser = teamUsers.find((u) => u.id === lead?.assignedTo);
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  const nextActivity = allActivities.find(
    (a) => a.metadata && typeof a.metadata === "object" && (a.metadata as any).scheduledAt && new Date((a.metadata as any).scheduledAt) > new Date()
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 text-center py-20">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Lead not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/leads")} data-testid="button-back-to-leads">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Leads
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/leads")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-lead-name">
              {lead.firstName} {lead.lastName}
            </h1>
            <p className="text-muted-foreground text-sm">{lead.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEdit} data-testid="button-edit-lead">
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive" data-testid="button-delete-lead">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {lead.firstName} {lead.lastName} and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} data-testid="button-confirm-delete">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Lead Details</h3>
                {currentStage && (
                  <Badge style={{ backgroundColor: currentStage.color || "#1565C0", color: "#fff" }} data-testid="badge-stage">
                    {currentStage.name}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(saveEdit)} className="space-y-4">
                    <FormField control={editForm.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl><Input data-testid="input-edit-title" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="firstName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl><Input data-testid="input-edit-firstname" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="lastName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl><Input data-testid="input-edit-lastname" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input type="email" data-testid="input-edit-email" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl><Input data-testid="input-edit-phone" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="company" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <FormControl><Input data-testid="input-edit-company" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="source" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-source"><SelectValue placeholder="Select source" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SOURCES.map((s) => (
                                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={editForm.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl><Textarea data-testid="input-edit-notes" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-edit">
                        <Save className="w-4 h-4 mr-2" /> {updateMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                        <X className="w-4 h-4 mr-2" /> Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Contact Name</Label>
                      <p className="text-sm font-medium" data-testid="text-contact-name">{lead.firstName} {lead.lastName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Title</Label>
                      <p className="text-sm font-medium">{lead.title}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {lead.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <a href={`mailto:${lead.email}`} className="text-sm text-primary hover:underline" data-testid="link-email">{lead.email}</a>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-2">
                        <PhoneIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid="text-phone">{lead.phone}</span>
                      </div>
                    )}
                  </div>
                  {lead.company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm" data-testid="text-company">{lead.company}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Source</Label>
                      <p className="text-sm font-medium capitalize">{lead.source?.replace(/_/g, " ") || "Direct"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Badge variant="secondary" className="capitalize text-xs" data-testid="badge-status">{lead.status}</Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Priority</Label>
                      {priorityBadge(lead.priority || "medium")}
                    </div>
                  </div>
                  {lead.notes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{lead.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <h3 className="text-sm font-semibold">Log Activity</h3>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {ACTIVITY_TYPES.map((at) => {
                  const Icon = at.icon;
                  return (
                    <Button
                      key={at.key}
                      variant="outline"
                      size="sm"
                      onClick={() => openActivityDialog(at.key)}
                      data-testid={`button-activity-${at.key}`}
                    >
                      <Icon className={`w-4 h-4 mr-2 ${at.color}`} />
                      {at.label}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Activity Timeline</h3>
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-activity-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {ACTIVITY_TYPES.map((at) => (
                      <SelectItem key={at.key} value={at.key}>{at.label}</SelectItem>
                    ))}
                    <SelectItem value="stage_change">Stage Change</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                    <SelectItem value="value_change">Value Change</SelectItem>
                    <SelectItem value="status_change">Status Change</SelectItem>
                    <SelectItem value="lead_created">Created</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No activities yet</p>
              ) : (
                <div className="space-y-1">
                  {filteredActivities.map((activity) => {
                    const actUser = teamUsers.find((u) => u.id === activity.userId);
                    return (
                      <div key={activity.id} className="flex items-start gap-3 py-3 border-l-2 border-border pl-4 ml-2 relative" data-testid={`activity-${activity.id}`}>
                        <div className="absolute -left-[7px] top-4 w-3 h-3 rounded-full bg-background border-2 border-border" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {activityIcon(activity.type)}
                            <span className="text-sm font-medium truncate">{activity.title}</span>
                          </div>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {actUser && <span className="text-xs text-muted-foreground">{actUser.fullName}</span>}
                            <span className="text-xs text-muted-foreground">
                              {new Date(activity.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Salesperson</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignedUser ? (
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {assignedUser.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium" data-testid="text-assigned-user">{assignedUser.fullName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{assignedUser.role?.replace(/_/g, " ")}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unassigned</p>
              )}
              <Select
                value={lead.assignedTo?.toString() || ""}
                onValueChange={(v) => updateMutation.mutate({ assignedTo: v ? Number(v) : null })}
              >
                <SelectTrigger className="h-9 text-xs" data-testid="select-assign-user">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  {teamUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Value & Stage</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Deal Value</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold" data-testid="text-value">${Number(lead.value || 0).toLocaleString()}</span>
                </div>
                <Input
                  type="number"
                  placeholder="Update value"
                  className="mt-2 h-8 text-xs"
                  data-testid="input-update-value"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateMutation.mutate({ value: (e.target as HTMLInputElement).value });
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Pipeline Stage</Label>
                <Select
                  value={lead.stageId?.toString() || ""}
                  onValueChange={(v) => updateMutation.mutate({ stageId: Number(v) })}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs" data-testid="select-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedStages.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || "#1565C0" }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={lead.status || "new"}
                  onValueChange={(v) => updateMutation.mutate({ status: v })}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select
                  value={lead.priority || "medium"}
                  onValueChange={(v) => updateMutation.mutate({ priority: v })}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs" data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Expected Close</Label>
                <Input
                  type="date"
                  className="mt-1 h-8 text-xs"
                  value={lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => updateMutation.mutate({ expectedCloseDate: e.target.value || null })}
                  data-testid="input-expected-close"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Next Activity</h3>
              </div>
            </CardHeader>
            <CardContent>
              {nextActivity ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {activityIcon(nextActivity.type)}
                    <span className="text-sm font-medium">{nextActivity.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground" data-testid="text-next-activity-date">
                      {new Date((nextActivity.metadata as any).scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground">No upcoming activities</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => openActivityDialog("meeting")} data-testid="button-schedule-activity">
                    Schedule Activity
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-chart-4" />
                  <h3 className="text-sm font-semibold">AI Insights</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => aiScoreMutation.mutate()}
                  disabled={aiScoreMutation.isPending}
                  data-testid="button-ai-score"
                >
                  <Brain className="w-3 h-3 mr-1" />
                  {aiScoreMutation.isPending ? "..." : "Score"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.aiScore && Number(lead.aiScore) > 0 ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-muted-foreground">AI Score</Label>
                      <span className="text-sm font-bold" data-testid="text-ai-score">{Math.round(Number(lead.aiScore))}/100</span>
                    </div>
                    <Progress value={Number(lead.aiScore)} className="h-2" data-testid="progress-ai-score" />
                  </div>
                  {lead.aiProbability && (
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Conversion Probability</Label>
                      <Badge variant="secondary" className="text-xs" data-testid="text-ai-probability">
                        <Target className="w-3 h-3 mr-1" />
                        {Math.round(Number(lead.aiProbability))}%
                      </Badge>
                    </div>
                  )}
                  {lead.aiRecommendation && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Recommendation</Label>
                      <p className="text-xs mt-1 text-chart-4" data-testid="text-ai-recommendation">{lead.aiRecommendation}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <Brain className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground">Click Score to generate AI insights</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!activityDialog} onOpenChange={(open) => { if (!open) setActivityDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activityDialog && activityIcon(activityDialog)}
              Log {ACTIVITY_TYPES.find((a) => a.key === activityDialog)?.label || "Activity"}
            </DialogTitle>
          </DialogHeader>
          <Form {...activityForm}>
            <form onSubmit={activityForm.handleSubmit(handleActivitySubmit)} className="space-y-4">
              <FormField control={activityForm.control} name="subject" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl><Input placeholder="Activity subject..." data-testid="input-activity-subject" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {activityDialog === "call" && (
                <>
                  <FormField control={activityForm.control} name="duration" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (minutes)</FormLabel>
                      <FormControl><Input type="number" placeholder="15" data-testid="input-activity-duration" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={activityForm.control} name="outcome" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Outcome</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-activity-outcome"><SelectValue placeholder="Select outcome" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="connected">Connected</SelectItem>
                          <SelectItem value="no_answer">No Answer</SelectItem>
                          <SelectItem value="voicemail">Voicemail</SelectItem>
                          <SelectItem value="callback">Callback Requested</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </>
              )}

              {activityDialog === "meeting" && (
                <>
                  <FormField control={activityForm.control} name="scheduledAt" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date & Time</FormLabel>
                      <FormControl><Input type="datetime-local" data-testid="input-activity-scheduled" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={activityForm.control} name="location" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl><Input placeholder="Office / Video call" data-testid="input-activity-location" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </>
              )}

              {activityDialog === "task" && (
                <>
                  <FormField control={activityForm.control} name="scheduledAt" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl><Input type="date" data-testid="input-activity-due" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={activityForm.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-activity-priority"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={activityForm.control} name="assignTo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign To</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-activity-assign"><SelectValue placeholder="Select user" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {teamUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id.toString()}>{u.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </>
              )}

              <FormField control={activityForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{activityDialog === "note" ? "Note" : "Description"}</FormLabel>
                  <FormControl><Textarea placeholder="Details..." data-testid="input-activity-description" {...field} /></FormControl>
                </FormItem>
              )} />

              {(activityDialog === "call" || activityDialog === "email") && (
                <FormField control={activityForm.control} name="scheduledAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Follow-up</FormLabel>
                    <FormControl><Input type="date" data-testid="input-activity-followup" {...field} /></FormControl>
                  </FormItem>
                )} />
              )}

              <Button type="submit" className="w-full" disabled={activityMutation.isPending} data-testid="button-submit-activity">
                {activityMutation.isPending ? "Saving..." : "Log Activity"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
