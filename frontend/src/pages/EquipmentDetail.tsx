import { useState, useEffect, useCallback } from "react"
import {
  ArrowLeft, Package, Hash, Tag, Calendar, Edit2, Trash2,
  Save, X, User as UserIcon, Wrench, History, Info,
  Plus, ClipboardList
} from "lucide-react"
import { Badge, Input, Textarea } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/primitives"
import { equipment as equipmentApi, maintenance as maintenanceApi, users as usersApi, type Equipment, type Handover, type User, type MaintenanceLog } from "@/lib/api"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

const CONDITIONS = ["excellent", "good", "fair", "poor"] as const
const STATUSES = ["assigned", "available", "maintenance", "retired"] as const
const CATEGORIES = ["Laptop", "Desktop", "Monitor", "Printer", "Phone", "Peripheral", "Server", "Networking", "Other"]
const MAINT_TYPES = ["repair", "inspection", "calibration", "cleaning", "upgrade", "other"]

function statusBadge(status: Equipment["status"]) {
  const map = { assigned: "success", available: "warning", maintenance: "destructive", retired: "muted" } as const
  return <Badge variant={map[status]} className="capitalize text-sm px-3 py-1">{status}</Badge>
}

function conditionColor(condition: Equipment["condition"]) {
  return { excellent: "text-success", good: "text-primary", fair: "text-warning", poor: "text-destructive" }[condition]
}

function activityBadge(type: Handover["activity_type"]) {
  const map = {
    reassign: { label: "Reassign", cls: "bg-primary/10 text-primary" },
    return: { label: "Return", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    new_issue: { label: "New Issue", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  }
  const { label, cls } = map[type] ?? map.reassign
  return <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cls)}>{label}</span>
}

function maintTypeBadge(type: MaintenanceLog["type"]) {
  const map: Record<string, { label: string; cls: string }> = {
    repair: { label: "Repair", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    inspection: { label: "Inspection", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    calibration: { label: "Calibration", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    cleaning: { label: "Cleaning", cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
    upgrade: { label: "Upgrade", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    other: { label: "Other", cls: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
  }
  const { label, cls } = map[type] ?? map.other
  return <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cls)}>{label}</span>
}

interface EditForm {
  name: string; category: string; serial_number: string; tag_number: string
  status: Equipment["status"]; condition: Equipment["condition"]
  purchase_date: string; assigned_to: string; notes: string
}

type Tab = "info" | "history" | "maintenance"

export default function EquipmentDetailPage({ equipmentId }: { equipmentId: string }) {
  const { setSelectedEquipmentId, setCurrentPage, isAdmin } = useApp()
  const { toast } = useToast()
  const [item, setItem] = useState<(Equipment & { handovers: Handover[] }) | null>(null)
  const [maintLogs, setMaintLogs] = useState<MaintenanceLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showAddMaint, setShowAddMaint] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<Tab>("info")
  const [maintForm, setMaintForm] = useState({ type: "repair", description: "", cost: "", date: "" })
  const [maintSaving, setMaintSaving] = useState(false)
  const [form, setForm] = useState<EditForm>({
    name: "", category: "", serial_number: "", tag_number: "",
    status: "available", condition: "good", purchase_date: "",
    assigned_to: "", notes: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eRes, uRes] = await Promise.all([
        equipmentApi.get(equipmentId),
        usersApi.list({ limit: 200 }),
      ])
      if (eRes.data) {
        setItem(eRes.data)
        setForm({
          name: eRes.data.name,
          category: eRes.data.category,
          serial_number: eRes.data.serial_number,
          tag_number: eRes.data.tag_number,
          status: eRes.data.status,
          condition: eRes.data.condition,
          purchase_date: eRes.data.purchase_date?.slice(0, 10) ?? "",
          assigned_to: eRes.data.assigned_to ?? "",
          notes: eRes.data.notes ?? "",
        })
      }
      if (uRes.data) setUsers(uRes.data)
      try {
        const mRes = await maintenanceApi.list(equipmentId)
        if (mRes.data) setMaintLogs(mRes.data)
      } catch { /* maintenance logs unavailable */ }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [equipmentId])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!item) return
    setSaving(true)
    try {
      await equipmentApi.update(item.id, {
        name: form.name, category: form.category,
        serial_number: form.serial_number, tag_number: form.tag_number,
        status: form.status, condition: form.condition,
        purchase_date: form.purchase_date,
        assigned_to: form.assigned_to || null,
        notes: form.notes,
      })
      setEditing(false)
      load()
      toast("Equipment updated", "success")
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to update", "error")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    try {
      await equipmentApi.delete(item.id)
      setSelectedEquipmentId(null)
      setCurrentPage("equipment")
      toast("Equipment deleted", "success")
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error")
    }
  }

  async function handleAddMaint() {
    if (!maintForm.description.trim()) return
    setMaintSaving(true)
    try {
      await maintenanceApi.create({
        equipment_id: equipmentId,
        type: maintForm.type,
        description: maintForm.description,
        cost: maintForm.cost ? parseFloat(maintForm.cost) : undefined,
        date: maintForm.date || undefined,
      })
      setShowAddMaint(false)
      setMaintForm({ type: "repair", description: "", cost: "", date: "" })
      load()
      toast("Maintenance log added", "success")
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to add log", "error")
    } finally {
      setMaintSaving(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!item) return (
    <div className="p-8 text-center text-muted-foreground">Equipment not found</div>
  )

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: "info", label: "Details", icon: Info },
    { id: "history", label: "History", icon: History, count: item.handovers?.length },
    { id: "maintenance", label: "Maintenance", icon: Wrench, count: maintLogs.length },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <button onClick={() => setSelectedEquipmentId(null)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />Back to Equipment
      </button>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-7 h-7 text-primary" />
          </div>
          <div>
            {editing ? (
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-2xl font-semibold border-b-2 border-primary rounded-none px-0" />
            ) : (
              <h1 className="text-2xl font-semibold">{item.name}</h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{item.category}</span>
              <span className="text-muted-foreground/40">&middot;</span>
              {statusBadge(item.status)}
              <span className={cn("text-sm font-medium capitalize", conditionColor(item.condition))}>
                {item.condition}
              </span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  <X className="w-4 h-4 mr-1" />Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />{saving ? "Saving\u2026" : "Save"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-1" />Edit
                </Button>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowDelete(true)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count !== undefined && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Serial Number" icon={<Hash className="w-4 h-4" />}>
                  {editing
                    ? <Input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} className="h-8 font-mono" />
                    : <span className="font-mono text-sm">{item.serial_number}</span>
                  }
                </Detail>
                <Detail label="Tag Number" icon={<Tag className="w-4 h-4" />}>
                  {editing
                    ? <Input value={form.tag_number} onChange={e => setForm(f => ({ ...f, tag_number: e.target.value }))} className="h-8 font-mono" />
                    : <span className="font-mono text-sm">{item.tag_number}</span>
                  }
                </Detail>
                <Detail label="Category">
                  {editing
                    ? <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    : <span className="text-sm">{item.category}</span>
                  }
                </Detail>
                <Detail label="Condition">
                  {editing
                    ? <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v as Equipment["condition"] }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                      </Select>
                    : <span className={cn("text-sm font-medium capitalize", conditionColor(item.condition))}>{item.condition}</span>
                  }
                </Detail>
                <Detail label="Status">
                  {editing
                    ? <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Equipment["status"] }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    : statusBadge(item.status)
                  }
                </Detail>
                <Detail label="Purchase Date" icon={<Calendar className="w-4 h-4" />}>
                  {editing
                    ? <Input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="h-8" />
                    : <span className="text-sm">{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : "\u2014"}</span>
                  }
                </Detail>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
                {editing
                  ? <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Add notes\u2026" />
                  : <p className="text-sm text-muted-foreground">{item.notes || "No notes"}</p>
                }
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Assigned To</h2>
              {editing ? (
                <Select value={form.assigned_to || "__none__"} onValueChange={v => setForm(f => ({ ...f, assigned_to: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : item.assigned_user_name ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm">
                    {item.assigned_user_name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{item.assigned_user_name}</div>
                    {item.assigned_user_dept && <div className="text-xs text-muted-foreground">{item.assigned_user_dept}</div>}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserIcon className="w-4 h-4" />
                  <span className="text-sm">Unassigned</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Quick Info</h2>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Transfers</span>
                <span className="font-medium">{item.handovers?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Maintenance</span>
                <span className="font-medium">{maintLogs.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Added</span>
                <span className="font-medium">{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">Handover History</h2>
          {(!item.handovers || item.handovers.length === 0) ? (
            <p className="text-sm text-muted-foreground">No handover history</p>
          ) : (
            <div className="relative pl-8 space-y-0">
              {item.handovers.slice().reverse().map((h, i) => (
                <div key={h.id} className="relative pb-6 last:pb-0">
                  {i < item.handovers.length - 1 && (
                    <div className="absolute left-0 top-6 bottom-0 w-px bg-border" />
                  )}
                  <div className="absolute left-[-10px] top-1 w-[18px] h-[18px] rounded-full bg-background border-2 border-primary flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                  <div className="flex items-start gap-3 ml-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {activityBadge(h.activity_type)}
                        <span className="text-xs text-muted-foreground">{new Date(h.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm mt-1">
                        {h.from_user_name && <span className="text-muted-foreground">{h.from_user_name} \u2192 </span>}
                        {h.to_user_name && <span className="font-medium">{h.to_user_name}</span>}
                        {!h.from_user_name && !h.to_user_name && <span className="text-muted-foreground">Logistics</span>}
                      </p>
                      {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full shrink-0",
                      h.status === "completed" ? "bg-success/10 text-success" :
                      h.status === "pending" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
                    )}>
                      {h.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "maintenance" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Maintenance Logs</h2>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setShowAddMaint(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />Add Log
              </Button>
            )}
          </div>
          {maintLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance logs</p>
          ) : (
            <div className="space-y-3">
              {maintLogs.map(m => (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Wrench className="w-4 h-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {maintTypeBadge(m.type)}
                      <span className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                      {m.logged_by_name && <span className="text-xs text-muted-foreground">by {m.logged_by_name}</span>}
                    </div>
                    <p className="text-sm mt-1">{m.description}</p>
                    {m.cost != null && m.cost > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">Cost: ${Number(m.cost).toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Equipment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{item.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMaint} onOpenChange={setShowAddMaint}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Maintenance Log</DialogTitle>
            <DialogDescription>Record a maintenance or service event for this equipment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={maintForm.type} onValueChange={v => setMaintForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAINT_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea value={maintForm.description} onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder="Describe the maintenance performed\u2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cost (optional)</label>
                <Input type="number" min="0" step="0.01" value={maintForm.cost}
                  onChange={e => setMaintForm(f => ({ ...f, cost: e.target.value }))}
                  placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input type="date" value={maintForm.date}
                  onChange={e => setMaintForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMaint(false)}>Cancel</Button>
            <Button onClick={handleAddMaint} disabled={maintSaving || !maintForm.description.trim()}>
              <ClipboardList className="w-4 h-4 mr-1.5" />
              {maintSaving ? "Saving\u2026" : "Add Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Detail({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
        {icon}{label}
      </div>
      {children}
    </div>
  )
}
