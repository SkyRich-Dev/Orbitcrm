import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
}

export interface KanbanItem {
  id: string;
  columnId: string;
  title: string;
  subtitle?: string;
  value?: number;
  badge?: string;
  meta?: string;
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  items: KanbanItem[];
  onStageChange: (itemId: string, newColumnId: string) => void;
  onItemClick?: (item: KanbanItem) => void;
  renderCard?: (item: KanbanItem) => JSX.Element;
}

function DroppableColumn({
  column,
  items,
  onItemClick,
  renderCard,
}: {
  column: KanbanColumn;
  items: KanbanItem[];
  onItemClick?: (item: KanbanItem) => void;
  renderCard?: (item: KanbanItem) => JSX.Element;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const totalValue = items.reduce((sum, i) => sum + (i.value || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] w-[280px] shrink-0 transition-colors rounded-lg ${isOver ? "bg-accent/50" : ""}`}
      data-testid={`kanban-column-${column.id}`}
    >
      <div className="flex items-center justify-between mb-3 gap-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
          <h3 className="text-sm font-semibold">{column.title}</h3>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
        {totalValue > 0 && (
          <span className="text-xs text-muted-foreground">${totalValue.toLocaleString()}</span>
        )}
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[60px]">
          {items.map((item) => (
            <SortableCard key={item.id} item={item} onItemClick={onItemClick} renderCard={renderCard} />
          ))}
          {items.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-md">
              Drop items here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({
  item,
  onItemClick,
  renderCard,
}: {
  item: KanbanItem;
  onItemClick?: (item: KanbanItem) => void;
  renderCard?: (item: KanbanItem) => JSX.Element;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function handleClick(e: React.MouseEvent) {
    if (onItemClick && !isDragging) {
      e.stopPropagation();
      onItemClick(item);
    }
  }

  if (renderCard) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={handleClick}>
        {renderCard(item)}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={handleClick}>
      <Card className={`hover:shadow-md transition-shadow ${onItemClick ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`} data-testid={`kanban-card-${item.id}`}>
        <CardContent className="p-3">
          <p className="text-sm font-medium truncate">{item.title}</p>
          {item.subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>
          )}
          <div className="flex items-center justify-between mt-2 gap-1">
            {item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
            {item.value != null && item.value > 0 && (
              <span className="text-xs font-medium">${item.value.toLocaleString()}</span>
            )}
          </div>
          {item.meta && (
            <p className="text-xs text-muted-foreground mt-1">{item.meta}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DragOverlayCard({ item }: { item: KanbanItem }) {
  return (
    <Card className="cursor-grabbing shadow-lg w-[260px]">
      <CardContent className="p-3">
        <p className="text-sm font-medium truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function KanbanBoard({ columns, items, onStageChange, onItemClick, renderCard }: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const item = items.find((i) => i.id === String(event.active.id));
    setActiveItem(item || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const draggedItem = items.find((i) => i.id === activeId);
    if (!draggedItem) return;

    const targetColumn = columns.find((c) => c.id === overId);
    if (targetColumn && targetColumn.id !== draggedItem.columnId) {
      onStageChange(activeId, targetColumn.id);
      return;
    }

    const targetItem = items.find((i) => i.id === overId);
    if (targetItem && targetItem.columnId !== draggedItem.columnId) {
      onStageChange(activeId, targetItem.columnId);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-board">
        {columns.map((column) => {
          const columnItems = items.filter((i) => i.columnId === column.id);
          return (
            <DroppableColumn
              key={column.id}
              column={column}
              items={columnItems}
              onItemClick={onItemClick}
              renderCard={renderCard}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeItem ? <DragOverlayCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
