import {
  UserPlus,
  Edit,
  Trash2,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Mail,
  Phone,
  FileText,
  Activity as ActivityIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Activity } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityTimelineProps {
  entityType?: string;
  onEntityClick?: (entityType: string, entityId: number) => void;
}

const actionIcons: Record<string, typeof ActivityIcon> = {
  created: UserPlus,
  updated: Edit,
  deleted: Trash2,
  stage_change: ArrowRight,
  completed: CheckCircle2,
  payment: DollarSign,
  email: Mail,
  call: Phone,
  note: FileText,
};

const actionColors: Record<string, string> = {
  created: "bg-chart-2 text-white",
  updated: "bg-chart-1 text-white",
  deleted: "bg-destructive text-destructive-foreground",
  stage_change: "bg-chart-3 text-white",
  completed: "bg-chart-2 text-white",
  payment: "bg-chart-4 text-white",
  email: "bg-chart-5 text-white",
  call: "bg-primary text-primary-foreground",
  note: "bg-muted-foreground text-white",
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function ActivityTimeline({ entityType, onEntityClick }: ActivityTimelineProps) {
  const url = entityType
    ? `/api/activities?entityType=${entityType}`
    : "/api/activities";

  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: [url],
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="activity-timeline-loading">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-16" data-testid="activity-timeline-empty">
        <ActivityIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
        <h3 className="text-lg font-semibold">No activity yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Activities will appear here as actions are taken
        </p>
      </div>
    );
  }

  return (
    <div className="relative" data-testid="activity-timeline">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = actionIcons[activity.type] || ActivityIcon;
          const colorClass = actionColors[activity.type] || "bg-muted text-muted-foreground";
          const createdAt = new Date(activity.createdAt);

          const isClickable = onEntityClick && activity.entityType && activity.entityId;

          return (
            <div
              key={activity.id}
              className={`relative flex gap-3 pl-0 ${isClickable ? "cursor-pointer hover:bg-accent/50 rounded-lg p-1 -ml-1 transition-colors" : ""}`}
              data-testid={`activity-item-${activity.id}`}
              onClick={() => {
                if (isClickable) {
                  onEntityClick(activity.entityType!, activity.entityId!);
                }
              }}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className={`text-sm font-medium ${isClickable ? "text-primary hover:underline" : ""}`}>{activity.title}</p>
                {activity.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimeAgo(createdAt)} &middot; {createdAt.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
