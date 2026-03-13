import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Trash2,
  Edit,
  UserCircle,
} from "lucide-react";
import type { Contact } from "@shared/schema";
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

const createContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  jobTitle: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type CreateContactForm = z.infer<typeof createContactSchema>;

function ContactCard({ contact }: { contact: Contact }) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  const editForm = useForm<CreateContactForm>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      jobTitle: contact.jobTitle || "",
      notes: contact.notes || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateContactForm) => apiRequest("PATCH", `/api/contacts/${contact.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setEditOpen(false);
      toast({ title: "Contact updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/contacts/${contact.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contact deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete contact", description: err.message, variant: "destructive" });
    },
  });

  const initials = `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();

  return (
    <>
      <Card data-testid={`card-contact-${contact.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-1">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarFallback className="text-xs bg-chart-3/10 text-chart-3">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold truncate">{contact.firstName} {contact.lastName}</h3>
                {contact.jobTitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{contact.jobTitle}</p>
                )}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {contact.email && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3" /> {contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" /> {contact.phone}
                    </span>
                  )}
                  {contact.company && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="w-3 h-3" /> {contact.company}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-contact-menu-${contact.id}`}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    editForm.reset({
                      firstName: contact.firstName,
                      lastName: contact.lastName,
                      email: contact.email || "",
                      phone: contact.phone || "",
                      company: contact.company || "",
                      jobTitle: contact.jobTitle || "",
                      notes: contact.notes || "",
                    });
                    setEditOpen(true);
                  }}
                  data-testid={`button-edit-contact-${contact.id}`}
                >
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate()}
                  data-testid={`button-delete-contact-${contact.id}`}
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
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input placeholder="Jane" data-testid="input-edit-contact-firstname" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input placeholder="Smith" data-testid="input-edit-contact-lastname" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="jane@example.com" data-testid="input-edit-contact-email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input placeholder="+1 234 567 890" data-testid="input-edit-contact-phone" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="company" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl><Input placeholder="Acme Inc." data-testid="input-edit-contact-company" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="jobTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl><Input placeholder="VP of Sales" data-testid="input-edit-contact-jobtitle" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea placeholder="Additional notes..." data-testid="input-edit-contact-notes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={updateMutation.isPending} data-testid="button-submit-edit-contact">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "uncategorized", title: "No Company", color: "hsl(var(--muted-foreground))" },
];

function ContactsKanbanView({ contacts }: { contacts: Contact[] }) {
  const companyColumns = useMemo(() => {
    const companies = new Set<string>();
    contacts.forEach((c) => {
      if (c.company) companies.add(c.company);
    });
    const cols: KanbanColumn[] = [...KANBAN_COLUMNS];
    const colors = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
    ];
    let i = 0;
    companies.forEach((company) => {
      cols.push({ id: company, title: company, color: colors[i % colors.length] });
      i++;
    });
    return cols;
  }, [contacts]);

  const kanbanItems: KanbanItem[] = useMemo(
    () =>
      contacts.map((c) => ({
        id: String(c.id),
        columnId: c.company || "uncategorized",
        title: `${c.firstName} ${c.lastName}`,
        subtitle: c.jobTitle || undefined,
        badge: c.email || undefined,
        meta: c.phone || undefined,
      })),
    [contacts],
  );

  return (
    <KanbanBoard
      columns={companyColumns}
      items={kanbanItems}
      onStageChange={() => {}}
    />
  );
}

function ContactsCalendarView({ contacts }: { contacts: Contact[] }) {
  const events: CalendarEvent[] = useMemo(
    () =>
      contacts.map((c) => ({
        id: String(c.id),
        title: `${c.firstName} ${c.lastName}`,
        date: new Date(c.createdAt),
        color: "hsl(var(--chart-3))",
        meta: c.company || c.jobTitle || undefined,
      })),
    [contacts],
  );

  return <CalendarView events={events} />;
}

export default function ContactsPage() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewType>("list");
  const { toast } = useToast();

  const { data: rawContacts, isLoading } = useQuery<Contact[]>({ queryKey: ["/api/contacts"] });
  const contacts = rawContacts ?? [];

  const form = useForm<CreateContactForm>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateContactForm) => apiRequest("POST", "/api/contacts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      form.reset();
      setOpen(false);
      toast({ title: "Contact created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredContacts = contacts.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(s) ||
      c.lastName.toLowerCase().includes(s) ||
      (c.email || "").toLowerCase().includes(s) ||
      (c.company || "").toLowerCase().includes(s)
    );
  });

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
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your business contacts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-contact">
              <Plus className="w-4 h-4 mr-2" /> Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input placeholder="Jane" data-testid="input-contact-firstname" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl><Input placeholder="Smith" data-testid="input-contact-lastname" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="jane@example.com" data-testid="input-contact-email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder="+1 234 567 890" data-testid="input-contact-phone" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="company" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl><Input placeholder="Acme Inc." data-testid="input-contact-company" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="jobTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl><Input placeholder="VP of Sales" data-testid="input-contact-jobtitle" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea placeholder="Additional notes..." data-testid="input-contact-notes" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-contact">
                  {createMutation.isPending ? "Creating..." : "Create Contact"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-contacts"
          />
        </div>
        <ViewSwitcher value={view} onChange={setView} data-testid="contacts-view-switcher" />
      </div>

      {view === "list" && (
        <div className="space-y-2">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-16">
              <UserCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold">No contacts found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Add your first contact to get started"}
              </p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))
          )}
        </div>
      )}

      {view === "kanban" && (
        <ContactsKanbanView contacts={filteredContacts} />
      )}

      {view === "calendar" && (
        <ContactsCalendarView contacts={filteredContacts} />
      )}

      {view === "activity" && (
        <ActivityTimeline entityType="contact" />
      )}
    </div>
  );
}
