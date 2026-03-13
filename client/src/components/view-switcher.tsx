import { LayoutGrid, List, Calendar, Activity } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ViewType = "list" | "kanban" | "calendar" | "activity";

interface ViewSwitcherProps {
  value: ViewType;
  onChange: (view: ViewType) => void;
  views?: ViewType[];
}

const viewConfig: Record<ViewType, { label: string; icon: typeof List }> = {
  list: { label: "List", icon: List },
  kanban: { label: "Kanban", icon: LayoutGrid },
  calendar: { label: "Calendar", icon: Calendar },
  activity: { label: "Activity", icon: Activity },
};

export function ViewSwitcher({ value, onChange, views = ["list", "kanban", "calendar", "activity"] }: ViewSwitcherProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ViewType)}>
      <TabsList data-testid="view-switcher">
        {views.map((view) => {
          const config = viewConfig[view];
          const Icon = config.icon;
          return (
            <TabsTrigger key={view} value={view} data-testid={`tab-${view}-view`}>
              <Icon className="w-4 h-4 mr-1.5" />
              {config.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
