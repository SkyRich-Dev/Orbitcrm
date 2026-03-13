import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  color?: string;
  meta?: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ events, onEventClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    events.forEach((event) => {
      const d = new Date(event.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(event);
      }
    });
    return map;
  }, [events, year, month]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="min-h-[80px] border border-border/50 rounded bg-muted/20" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = eventsByDay[day] || [];
    const isToday = isCurrentMonth && day === todayDate;
    cells.push(
      <div
        key={day}
        className={`min-h-[80px] border rounded p-1 transition-colors ${
          isToday ? "border-primary bg-primary/5" : "border-border/50 hover:bg-accent/30"
        }`}
        data-testid={`calendar-day-${day}`}
      >
        <span className={`text-xs font-medium ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
          {day}
        </span>
        <div className="mt-0.5 space-y-0.5">
          {dayEvents.slice(0, 3).map((event) => (
            <TooltipProvider key={event.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onEventClick?.(event)}
                    className="w-full text-left"
                    data-testid={`calendar-event-${event.id}`}
                  >
                    <div
                      className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white font-medium"
                      style={{ backgroundColor: event.color || "hsl(var(--primary))" }}
                    >
                      {event.title}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{event.title}</p>
                  {event.meta && <p className="text-xs text-muted-foreground">{event.meta}</p>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          {dayEvents.length > 3 && (
            <span className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card data-testid="calendar-view">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth} data-testid="calendar-prev">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth} data-testid="calendar-next">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToday} data-testid="calendar-today">
              Today
            </Button>
          </div>
          <h3 className="text-lg font-semibold" data-testid="calendar-month-title">
            {MONTH_NAMES[month]} {year}
          </h3>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells}
        </div>
      </CardContent>
    </Card>
  );
}
