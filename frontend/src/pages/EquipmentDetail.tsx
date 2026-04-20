import { useState, useEffect, useCallback } from "react"
import {
  ArrowLeft, Package, Hash, Tag, Calendar, Edit2, Trash2,
  Save, X, User as UserIcon, Clock, CheckCircle, AlertTriangle, ChevronRight
} from "lucide-react"
import { Badge } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/primitives"
import { equipment as equipmentApi, users as usersApi, type Equipment, type Handover, type User } from "@/lib/api"
import { useApp } from "@/context/AppContext"
import { cn } from "@/lib/utils"

const CONDITIONS = ["excellent", "good", "fair", "poor"] as const
const STATUSES = ["assigned", "available", "maintenance", "retired"] as const
const CATEGORIES = ["Laptop", "Desktop", "Monitor", "Printer", "Phone", "Peripheral", "Server", "Networking", "Other"]

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

interface EditForm {
  name: string; category: string; serial_number: string; tag_number: string
  status: Equipment["status"]; condition: Equipment["condition"]
  purchase_date: string; assigned_to: string; notes: string
}

export default function EquipmentDetailPage({ equipmentId }: { equipmentId: string }) {
  const { setSelectedEquipmentId, setCurrentPage, isAdmin } = useApp()
  const [item, setItem] = useState<(Equipment & { handovers: Handover[] }) | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [error, setError] = useState("")
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save")
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete")
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => setSelectedEquipmentId(null)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />Back to Equipment
      </button>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-7 h-7 text-primary" />
          </div>
          <div>
            {editing ? (
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-2xl font-semibold bg-transparent border-b-2 border-primary focus:outline-none" />
            ) : (
              <h1 className="text-2xl font-semibold">{item.name}</h1>
            )}
            <p className="text-muted-foreground">{item.category}</p>
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
                  <Save className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save"}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Detail label="Serial Number" icon={<Hash className="w-4 h-4" />}>
                {editing
                  ? <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono" />
                  : <span className="font-mono text-sm">{item.serial_number}</span>
                }
              </Detail>
              <Detail label="Tag Number" icon={<Tag className="w-4 h-4" />}>
                {editing
                  ? <input value={form.tag_number} onChange={e => setForm(f => ({ ...f, tag_number: e.target.value }))}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono" />
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
                  ? <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  : <span className="text-sm">{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : "—"}</span>
                }
              </Detail>
            </div>
            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
              {editing
                ? <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} placeholder="Add notes…"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                : <p className="text-sm text-muted-foreground">{item.notes || "No notes"}</p>
              }
            </div>
          </div>

          {/* Handover history */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">Handover History</h2>
            {(!item.handovers || item.handovers.length === 0) ? (
              <p className="text-sm text-muted-foreground">No handover history</p>
            ) : (
              <div className="space-y-3">
                {item.handovers.slice().reverse().map(h => (
                  <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {activityBadge(h.activity_type)}
                        <span className="text-xs text-muted-foreground">{new Date(h.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm mt-1">
                        {h.from_user_name && <span className="text-muted-foreground">{h.from_user_name} → </span>}
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
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Assigned user */}
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

          {/* Quick stats */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Quick Info</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Transfers</span>
              <span className="font-medium">{item.handovers?.length ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Added</span>
              <span className="font-medium">{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
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