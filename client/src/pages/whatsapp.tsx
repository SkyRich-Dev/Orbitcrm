import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Phone,
  Send,
  Settings,
  Terminal,
  Plus,
  Trash2,
  UserCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  MessageCircle,
} from "lucide-react";
import type { WhatsappSettings, WhatsappMessage, WhatsappContact, WhatsappCommandLog } from "@shared/schema";

function InboxTab() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: waContacts, isLoading: contactsLoading } = useQuery<WhatsappContact[]>({
    queryKey: ["/api/whatsapp/contacts"],
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<WhatsappMessage[]>({
    queryKey: ["/api/whatsapp/messages", selectedPhone],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/messages?phone=${encodeURIComponent(selectedPhone!)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedPhone,
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; messageText: string; contactId?: number }) => {
      const res = await apiRequest("POST", "/api/whatsapp/messages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/messages", selectedPhone] });
      setMessageText("");
      toast({ title: "Message sent" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const contacts = (waContacts ?? []).filter((c) =>
    !searchTerm ||
    c.phoneNumber.includes(searchTerm) ||
    c.whatsappName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedMessages = [...(messages ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const selectedContact = contacts.find((c) => c.phoneNumber === selectedPhone);

  return (
    <div className="flex h-[calc(100vh-13rem)] border rounded-lg overflow-hidden" data-testid="whatsapp-inbox">
      <div className="w-80 border-r flex flex-col bg-card">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-conversations"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {contactsLoading ? (
            <div className="p-3 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-xs mt-1">Add a WhatsApp contact to start</p>
            </div>
          ) : (
            contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedPhone(c.phoneNumber)}
                className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${
                  selectedPhone === c.phoneNumber ? "bg-accent" : ""
                }`}
                data-testid={`contact-conversation-${c.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <UserCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {c.whatsappName || c.phoneNumber}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{c.phoneNumber}</p>
                  </div>
                  <Badge
                    variant={c.conversationStatus === "open" ? "default" : "secondary"}
                    className="text-xs flex-shrink-0"
                  >
                    {c.conversationStatus}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-background">
        {!selectedPhone ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a contact to view messages</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 border-b flex items-center gap-3 bg-card">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium" data-testid="text-chat-contact-name">
                  {selectedContact?.whatsappName || selectedPhone}
                </p>
                <p className="text-xs text-muted-foreground">{selectedPhone}</p>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messagesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-3/4" />
                  ))}
                </div>
              ) : sortedMessages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No messages yet. Send a message to start the conversation.
                </div>
              ) : (
                sortedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.direction === "outgoing"
                          ? "bg-green-600 text-white"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm">{msg.messageText}</p>
                      <p className={`text-xs mt-1 ${
                        msg.direction === "outgoing" ? "text-green-200" : "text-muted-foreground"
                      }`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t bg-card">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && messageText.trim()) {
                      e.preventDefault();
                      const wa = contacts.find((c) => c.phoneNumber === selectedPhone);
                      sendMutation.mutate({
                        phoneNumber: selectedPhone,
                        messageText: messageText.trim(),
                        contactId: wa?.contactId ?? undefined,
                      });
                    }
                  }}
                  data-testid="input-message-text"
                />
                <Button
                  size="icon"
                  disabled={!messageText.trim() || sendMutation.isPending}
                  onClick={() => {
                    const wa = contacts.find((c) => c.phoneNumber === selectedPhone);
                    sendMutation.mutate({
                      phoneNumber: selectedPhone,
                      messageText: messageText.trim(),
                      contactId: wa?.contactId ?? undefined,
                    });
                  }}
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ContactsTab() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const { toast } = useToast();

  const { data: waContacts, isLoading } = useQuery<WhatsappContact[]>({
    queryKey: ["/api/whatsapp/contacts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; whatsappName: string }) => {
      const res = await apiRequest("POST", "/api/whatsapp/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
      setShowAddDialog(false);
      setNewPhone("");
      setNewName("");
      toast({ title: "Contact added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add contact", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/whatsapp/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
      toast({ title: "Contact deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete contact", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/whatsapp/contacts/${id}`, { conversationStatus: status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const contacts = waContacts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{contacts.length} WhatsApp contacts</p>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-wa-contact">
              <Plus className="w-4 h-4 mr-1" /> Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add WhatsApp Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="wa-phone">Phone Number</Label>
                <Input
                  id="wa-phone"
                  placeholder="+65 8123 4567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  data-testid="input-wa-phone"
                />
              </div>
              <div>
                <Label htmlFor="wa-name">Name (optional)</Label>
                <Input
                  id="wa-name"
                  placeholder="Contact name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid="input-wa-name"
                />
              </div>
              <Button
                onClick={() => createMutation.mutate({ phoneNumber: newPhone, whatsappName: newName })}
                disabled={!newPhone || createMutation.isPending}
                className="w-full"
                data-testid="button-save-wa-contact"
              >
                {createMutation.isPending ? "Adding..." : "Add Contact"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Phone className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium">No WhatsApp contacts</p>
            <p className="text-sm text-muted-foreground mt-1">Add a contact to start messaging</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {contacts.map((c) => (
            <Card key={c.id} data-testid={`wa-contact-card-${c.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{c.whatsappName || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{c.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={c.conversationStatus}
                      onValueChange={(val) => updateStatusMutation.mutate({ id: c.id, status: val })}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs" data-testid={`select-status-${c.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm("Delete this WhatsApp contact?")) {
                          deleteMutation.mutate(c.id);
                        }
                      }}
                      data-testid={`button-delete-wa-contact-${c.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {c.lastMessageAt && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last message: {new Date(c.lastMessageAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CommandsTab() {
  const [commandInput, setCommandInput] = useState("");
  const { toast } = useToast();

  const { data: logs, isLoading } = useQuery<WhatsappCommandLog[]>({
    queryKey: ["/api/whatsapp/command-logs"],
  });

  const commandMutation = useMutation({
    mutationFn: async (rawMessage: string) => {
      const command = rawMessage.startsWith("/") ? rawMessage.slice(1).split(" ")[0] : rawMessage.split(" ")[0];
      const res = await apiRequest("POST", "/api/whatsapp/commands", { command, rawMessage });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/command-logs"] });
      setCommandInput("");
      toast({ title: data.success ? "Command executed" : "Command failed", description: data.result });
    },
    onError: (err: Error) => {
      toast({ title: "Command error", description: err.message, variant: "destructive" });
    },
  });

  const commandLogs = logs ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="w-4 h-4" /> Command Console
          </CardTitle>
          <CardDescription>
            Execute CRM commands. Type /help for available commands.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="/status, /leads, /deals, /tasks, /help"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && commandInput.trim()) {
                  commandMutation.mutate(commandInput.trim());
                }
              }}
              data-testid="input-command"
            />
            <Button
              onClick={() => commandInput.trim() && commandMutation.mutate(commandInput.trim())}
              disabled={!commandInput.trim() || commandMutation.isPending}
              data-testid="button-execute-command"
            >
              <Send className="w-4 h-4 mr-1" /> Execute
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Command History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : commandLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No commands executed yet. Try /help to get started.
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-auto">
              {commandLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3" data-testid={`command-log-${log.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-sm font-mono text-primary">/{log.command}</code>
                    <div className="flex items-center gap-2">
                      {log.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{log.result}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<WhatsappSettings>({
    queryKey: ["/api/whatsapp/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<WhatsappSettings>) => {
      const res = await apiRequest("PUT", "/api/whatsapp/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/settings"] });
      toast({ title: "Settings updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update settings", description: err.message, variant: "destructive" });
    },
  });

  const [apiKey, setApiKey] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const currentSettings = settings as any ?? { enabled: false, provider: "whatsapp_business" };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp Integration</CardTitle>
          <CardDescription>Enable and configure WhatsApp Business API connection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable WhatsApp</Label>
                  <p className="text-xs text-muted-foreground">Turn on WhatsApp messaging for your organization</p>
                </div>
                <Switch
                  checked={currentSettings.enabled}
                  onCheckedChange={(checked) => updateMutation.mutate({ enabled: checked })}
                  data-testid="switch-whatsapp-enabled"
                />
              </div>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <Label htmlFor="wa-business-number">Business Phone Number</Label>
                  <Input
                    id="wa-business-number"
                    placeholder="+65 XXXX XXXX"
                    defaultValue={currentSettings.businessNumber || ""}
                    onChange={(e) => setBusinessNumber(e.target.value)}
                    data-testid="input-business-number"
                  />
                </div>
                <div>
                  <Label htmlFor="wa-api-key">API Key</Label>
                  <Input
                    id="wa-api-key"
                    type="password"
                    placeholder="Your WhatsApp Business API key"
                    defaultValue={currentSettings.apiKey || ""}
                    onChange={(e) => setApiKey(e.target.value)}
                    data-testid="input-api-key"
                  />
                </div>
                <div>
                  <Label htmlFor="wa-webhook">Webhook URL</Label>
                  <Input
                    id="wa-webhook"
                    placeholder="https://your-domain.com/webhook"
                    defaultValue={currentSettings.webhookUrl || ""}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    data-testid="input-webhook-url"
                  />
                </div>
                <Button
                  onClick={() =>
                    updateMutation.mutate({
                      apiKey: apiKey || currentSettings.apiKey,
                      businessNumber: businessNumber || currentSettings.businessNumber,
                      webhookUrl: webhookUrl || currentSettings.webhookUrl,
                    })
                  }
                  disabled={updateMutation.isPending}
                  data-testid="button-save-wa-settings"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Available Commands:</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-xs">/status</code>
                <span className="text-muted-foreground text-xs">CRM overview</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-xs">/leads</code>
                <span className="text-muted-foreground text-xs">Recent leads</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-xs">/deals</code>
                <span className="text-muted-foreground text-xs">Active deals</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-xs">/tasks</code>
                <span className="text-muted-foreground text-xs">Pending tasks</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WhatsAppPage() {
  const { data: settings, isLoading: settingsLoading } = useQuery<WhatsappSettings>({
    queryKey: ["/api/whatsapp/settings"],
  });

  const isEnabled = (settings as any)?.enabled === true;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-whatsapp-title">
          <MessageSquare className="w-6 h-6 text-green-600" /> WhatsApp
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage conversations, contacts, and commands via WhatsApp
        </p>
      </div>

      <Tabs defaultValue={isEnabled ? "inbox" : "settings"}>
        <TabsList className="mb-4" data-testid="whatsapp-tabs">
          <TabsTrigger value="inbox" disabled={!isEnabled} data-testid="tab-inbox">
            <MessageSquare className="w-4 h-4 mr-1" /> Inbox
          </TabsTrigger>
          <TabsTrigger value="contacts" disabled={!isEnabled} data-testid="tab-contacts">
            <Phone className="w-4 h-4 mr-1" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="commands" disabled={!isEnabled} data-testid="tab-commands">
            <Terminal className="w-4 h-4 mr-1" /> Commands
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-1" /> Settings
          </TabsTrigger>
        </TabsList>

        {!isEnabled && !settingsLoading && (
          <Card className="mb-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="py-4 flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">WhatsApp integration is disabled</p>
                <p className="text-xs text-muted-foreground">Enable it in the Settings tab to start using WhatsApp features.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <TabsContent value="inbox">
          <InboxTab />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsTab />
        </TabsContent>
        <TabsContent value="commands">
          <CommandsTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
