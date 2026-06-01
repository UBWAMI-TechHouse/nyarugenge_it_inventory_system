import { useState, useEffect, useCallback } from "react"
import {
  ArrowLeft, Building2, Users, Package, Edit2,
  Save, X, Trash2, Hash, Tag, ChevronRight, Mail
} from "lucide-react"
import { Badge, Input, Textarea } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { departments as deptsApi, type Department, type User, type Equipment } from "@/lib/api"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

type Tab = "users" | "equipment"

function statusBadge(status: Equipment["status"]) {
  const map = { assigned: "success", available: "warning", maintenance: "destructive", retired: "muted" } as const
  return <Badge variant={map[status]} className="capitalize text-xs">{status}</Badge>
}

export default function DepartmentDetailPage({ departmentId }: { departmentId: string }) {
  const { setSelectedDepartmentId, setSelectedUserId, setSelectedEquipmentId, setCurrentPage, isAdmin } = useApp()
  const { toast } = useToast()
  const [dept, setDept] = useState<(Department & { users: User[]; equipment: Equipment[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [tab, setTab] = useState<Tab>("users")
  const [error, setError] = useState("")
  const [form, setForm] = useState({ name: "", code: "", description: "" })
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await deptsApi.get(departmentId)
      if (res.data) {
        setDept(res.data)
        setForm({ name: res.data.name, code: res.data.code, description: res.data.description ?? "" })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!dept) return
    setSaving(true)
    try {
      await deptsApi.update(dept.id, { name: form.name, code: form.code.toUpperCase(), description: form.description || undefined })
      setEditing(false)
      load()
      toast("Department updated", "success")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save")
      toast(e instanceof Error ? e.message : "Failed to update department", "error")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!dept) return
    try {
      await deptsApi.delete(dept.id)
      setSelectedDepartmentId(null)
      toast("Department deleted", "success")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete")
      toast(e instanceof Error ? e.message : "Failed to delete department", "error")
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!dept) return <div className="p-8 text-center text-muted-foreground">Department not found</div>

  const filteredUsers = dept.users?.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const filteredEquipment = dept.equipment?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.serial_number.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => setSelectedDepartmentId(null)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />Back to Departments
      </button>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <div>
            {editing ? (
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-2xl font-semibold border-b-2 border-primary rounded-none px-0" />
            ) : (
              <h1 className="text-2xl font-semibold">{dept.name}</h1>
            )}
            {editing ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Code:</span>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  maxLength={6} className="font-mono w-24 inline-flex" />
              </div>
            ) : (
              <p className="text-muted-foreground font-mono text-sm">{dept.code}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save"}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit2 className="w-4 h-4 mr-1" />Edit</Button>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowDelete(true)}><Trash2 className="w-4 h-4" /></Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {editing ? (
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={2} placeholder="Department description…" />
      ) : dept.description ? (
        <p className="text-muted-foreground">{dept.description}</p>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{dept.users?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Staff Members</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{dept.equipment?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Equipment Items</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">
            {dept.equipment?.filter(e => e.status === "assigned").length ?? 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Assigned Items</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="flex border-b border-border">
          {(["users", "equipment"] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setSearch("") }}
              className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors capitalize",
                tab === t ? "bg-primary/5 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}>
              {t === "users" ? <Users className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              {t === "users" ? `Staff (${dept.users?.length ?? 0})` : `Equipment (${dept.equipment?.length ?? 0})`}
            </button>
          ))}
        </div>

        {/* Search within tab */}
        <div className="p-3 border-b border-border">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        {tab === "users" && (
          <div className="divide-y divide-border">
            {filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No staff members found</div>
            ) : filteredUsers.map(u => (
              <div key={u.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 cursor-pointer transition-colors"
                onClick={() => { setSelectedUserId(u.id); setCurrentPage("users") }}>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                  {u.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{u.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" />{u.email}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                    u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>{u.role}</span>
                  {u.equipment_count !== undefined && (
                    <span className="text-xs text-muted-foreground hidden sm:block">{u.equipment_count} items</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "equipment" && (
          <div className="divide-y divide-border">
            {filteredEquipment.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No equipment assigned to this department</div>
            ) : filteredEquipment.map(e => (
              <div key={e.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 cursor-pointer transition-colors"
                onClick={() => { setSelectedEquipmentId(e.id); setCurrentPage("equipment") }}>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{e.name}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{e.serial_number}</span>
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{e.tag_number}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(e.status)}
                  <span className="text-xs text-muted-foreground hidden sm:block">{e.assigned_user_name ?? "Unassigned"}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Department</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{dept.name}</strong>? This may affect users assigned to this department.
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
