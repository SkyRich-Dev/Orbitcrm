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
  CheckSquare,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";
import type { Task } from "@shared/schema";
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

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  priority: z.string().default("medium"),
  status: z.string().default("pending"),
  dueDate: z.string().optional().or(z.literal("")),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

const priorityIcons: Record<string, any> = {
  high: AlertCircle,
  medium: Clock,
  low: Circle,
};

const priorityColors: Record<string, string> = {
  high: "text-destructive",
  medium: "text-chart-4",
  low: "text-muted-foreground",
};

const statusIcons: Record<string, any> = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
};

const taskStatusColumns: KanbanColumn[] = [
  { id: "pending", title: "Pending", color: "#f59e0b" },
  { id: "in_progress", title: "In Progress", color: "#3b82f6" },
  { id: "completed", title: "Completed", color: "#22c55e" },
];

function TaskCard({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  const { toast } = useToast();
  const PriorityIcon = priorityIcons[task.priority || "medium"] || Clock;
  const StatusIcon = statusIcons[task.status || "pending"] || Circle;

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tasks/${task.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/tasks/${task.id}`, {
        status: task.status === "completed" ? "pending" : "completed",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  return (
    <Card data-testid={`card-task-${task.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <button
              onClick={() => toggleMutation.mutate()}
              className="mt-0.5 shrink-0"
              data-testid={`button-toggle-task-${task.id}`}
            >
              <StatusIcon
                className={`w-5 h-5 ${
                  task.status === "completed" ? "text-chart-2" : "text-muted-foreground"
                }`}
              />
            </button>
            <div className="flex-1 min-w-0">
              <h3
                className={`text-sm font-medium truncate ${
                  task.status === "completed" ? "line-through text-muted-foreground" : ""
                }`}
              >
                {task.title}
              </h3>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`flex items-center gap-1 text-xs ${priorityColors[task.priority || "medium"]}`}>
                  <PriorityIcon className="w-3 h-3" />
                  {task.priority}
                </span>
                {task.dueDate && (
                  <span className="text-xs text-muted-foreground">
                    Due {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-task-menu-${task.id}`}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)} data-testid={`button-edit-task-${task.id}`}>
                <Edit className="w-4 h-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => deleteMutation.mutate()}
                data-testid={`button-delete-task-${task.id}`}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TasksPage() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<ViewType>("list");
  const { toast } = useToast();

  const { data: rawTasks, isLoading } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const tasks = rawTasks ?? [];

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { title: "", description: "", priority: "medium", status: "pending", dueDate: "" },
  });

  const editForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { title: "", description: "", priority: "medium", status: "pending", dueDate: "" },
  });

  function handleEdit(task: Task) {
    setEditingTask(task);
    editForm.reset({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "medium",
      status: task.status || "pending",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
    });
    setEditOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: (data: TaskFormData) => {
      const payload: any = { ...data };
      if (payload.dueDate) {
        payload.dueDate = new Date(payload.dueDate).toISOString();
      } else {
        delete payload.dueDate;
      }
      return apiRequest("POST", "/api/tasks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      form.reset();
      setOpen(false);
      toast({ title: "Task created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: (data: TaskFormData) => {
      if (!editingTask) throw new Error("No task selected");
      const payload: any = { ...data };
      if (payload.dueDate) {
        payload.dueDate = new Date(payload.dueDate).toISOString();
      } else {
        payload.dueDate = null;
      }
      return apiRequest("PATCH", `/api/tasks/${editingTask.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setEditOpen(false);
      setEditingTask(null);
      toast({ title: "Task updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/tasks/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task moved", description: "Status updated successfully." });
    },
  });

  const filteredTasks = tasks.filter((t) => {
    if (view === "list" && filter !== "all" && t.status !== filter) return false;
    if (!search) return true;
    return t.title.toLowerCase().includes(search.toLowerCase());
  });

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  const kanbanItems: KanbanItem[] = filteredTasks.map((t) => ({
    id: String(t.id),
    columnId: t.status || "pending",
    title: t.title,
    subtitle: t.description || undefined,
    badge: t.priority || "medium",
    meta: t.dueDate ? `Due: ${new Date(t.dueDate).toLocaleDateString()}` : undefined,
  }));

  const calendarEvents: CalendarEvent[] = filteredTasks
    .filter((t) => t.dueDate)
    .map((t) => ({
      id: String(t.id),
      title: t.title,
      date: new Date(t.dueDate!),
      color: t.priority === "high" ? "#ef4444" : t.priority === "low" ? "#6b7280" : "#3b82f6",
      meta: `${t.priority} priority - ${t.status}`,
    }));

  function handleStatusChange(itemId: string, newStatus: string) {
    statusMutation.mutate({ id: Number(itemId), status: newStatus });
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
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pendingCount} pending, {completedCount} completed
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-task">
              <Plus className="w-4 h-4 mr-2" /> Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Task</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Title</FormLabel>
                    <FormControl><Input placeholder="Follow up with client" data-testid="input-task-title" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Task details..." data-testid="input-task-description" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-task-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl><Input type="date" data-testid="input-task-due-date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-task">
                  {createMutation.isPending ? "Creating..." : "Create Task"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-tasks"
          />
        </div>
        {view === "list" && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-task-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        )}
        <ViewSwitcher value={view} onChange={setView} />
      </div>

      {view === "list" && (
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <CheckSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold">No tasks found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {search || filter !== "all" ? "Try different filters" : "Create your first task to get started"}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => <TaskCard key={task.id} task={task} onEdit={handleEdit} />)
          )}
        </div>
      )}

      {view === "kanban" && (
        <KanbanBoard
          columns={taskStatusColumns}
          items={kanbanItems}
          onStageChange={handleStatusChange}
        />
      )}

      {view === "calendar" && (
        <CalendarView events={calendarEvents} />
      )}

      {view === "activity" && (
        <ActivityTimeline entityType="task" />
      )}

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditingTask(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d))} className="space-y-4">
              <FormField control={editForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title</FormLabel>
                  <FormControl><Input data-testid="input-edit-task-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea data-testid="input-edit-task-description" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-task-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-task-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl><Input type="date" data-testid="input-edit-task-due-date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={editMutation.isPending} data-testid="button-submit-edit-task">
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
