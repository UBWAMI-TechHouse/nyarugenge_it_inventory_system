import { useState, useEffect, useCallback } from "react"
import { Plus, Search, Package, Tag, Hash, LayoutGrid, List, ChevronRight, Download } from "lucide-react"
import { Card, CardContent, Badge, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { equipment as equipmentApi, users as usersApi, type Equipment, type User } from "@/lib/api"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

const CATEGORIES = ["Laptop", "Desktop", "Monitor", "Printer", "Phone", "Peripheral", "Server", "Networking", "Other"]
const CONDITIONS = ["excellent", "good", "fair", "poor"] as const
const STATUSES = ["assigned", "available", "maintenance", "retired"] as const

function statusBadge(status: Equipment["status"]) {
  const map = { assigned: "success", available: "warning", maintenance: "destructive", retired: "muted" } as const
  return <Badge variant={map[status]} className="capitalize">{status}</Badge>
}

function conditionDot(condition: Equipment["condition"]) {
  const colors = { excellent: "bg-success", good: "bg-primary", fair: "bg-warning", poor: "bg-destructive" }
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("w-2 h-2 rounded-full", colors[condition])} />
      <span className="text-xs capitalize text-muted-foreground">{condition}</span>
    </span>
  )
}

interface FormState {
  name: string; category: string; serial_number: string; tag_number: string
  assigned_to: string; status: Equipment["status"]; purchase_date: string; condition: Equipment["condition"]
}

const emptyForm: FormState = {
  name: "", category: "Laptop", serial_number: "", tag_number: "",
  assigned_to: "", status: "available", purchase_date: "", condition: "good"
}

export default function EquipmentPage() {
  const { setSelectedEquipmentId, setCurrentPage } = useApp()
  const { toast } = useToast()
  const [items, setItems] = useState<Equipment[]>([])
  const [userList, setUserList] = useState<User[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eRes, uRes, cRes] = await Promise.all([
        equipmentApi.list({ limit: 200 }),
        usersApi.list({ limit: 200 }),
        equipmentApi.categories(),
      ])
      if (eRes.data) setItems(eRes.data)
      if (uRes.data) setUserList(uRes.data)
      if (cRes.data) setCategories(cRes.data.map(c => c.category))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = e.name.toLowerCase().includes(q) || e.serial_number.toLowerCase().includes(q) || e.tag_number.toLowerCase().includes(q)
    const matchStatus = filterStatus === "all" || e.status === filterStatus
    const matchCat = filterCategory === "all" || e.category === filterCategory
    return matchSearch && matchStatus && matchCat
  })

  function openDetail(id: string) {
    setSelectedEquipmentId(id)
    setCurrentPage("equipment")
  }

  async function handleAdd() {
    if (!form.name || !form.serial_number || !form.tag_number || !form.purchase_date) return
    setSaving(true)
    try {
      await equipmentApi.create({
        name: form.name, category: form.category,
        serial_number: form.serial_number, tag_number: form.tag_number,
        status: form.status, condition: form.condition,
        purchase_date: form.purchase_date,
        assigned_to: form.assigned_to || null,
      })
      setShowAdd(false); setForm(emptyForm); load()
      toast("Equipment added successfully", "success")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add")
      toast(e instanceof Error ? e.message : "Failed to add equipment", "error")
    } finally {
      setSaving(false)
    }
  }

  function exportCSV() {
    setExporting(true)
    try {
      const headers = ["Name", "Category", "Serial Number", "Tag Number", "Status", "Condition", "Purchase Date", "Assigned To"]
      const rows = filtered.map(e => [
        e.name, e.category, e.serial_number, e.tag_number,
        e.status, e.condition, e.purchase_date?.slice(0, 10) ?? "",
        e.assigned_user_name ?? ""
      ].map(v => `"${v.replace(/"/g, '""')}"`).join(","))
      const csv = [headers.join(","), ...rows].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `equipment_export_${new Date().toISOString().slice(0, 10)}.csv`
      a.click(); URL.revokeObjectURL(url)
      toast(`Exported ${rows.length} equipment records`, "success")
    } catch {
      toast("Failed to export CSV", "error")
    } finally {
      setExporting(false)
    }
  }

  const allCategories = [...new Set([...CATEGORIES, ...categories])]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Equipment</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} total items tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={exporting || filtered.length === 0}>
            <Download className="w-4 h-4 mr-1.5" />{exporting ? "Exporting…" : "Export CSV"}
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1.5" />Add Equipment
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, serial, tag…"
            className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {/* View toggle */}
        <div className="flex items-center border border-border rounded-md overflow-hidden">
          <button onClick={() => setView("grid")}
            className={cn("p-2 transition-colors", view === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent")}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setView("list")}
            className={cn("p-2 transition-colors", view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent")}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No equipment found</div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(e => (
            <Card key={e.id} className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/30"
              onClick={() => openDetail(e.id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.category}</div>
                    </div>
                  </div>
                  {statusBadge(e.status)}
                </div>
                <div className="space-y-1 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Hash className="w-3 h-3" />{e.serial_number}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Tag className="w-3 h-3" />{e.tag_number}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  {conditionDot(e.condition)}
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {e.assigned_user_name ? `→ ${e.assigned_user_name}` : "Unassigned"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipment</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Serial / Tag</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Condition</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Assigned To</th>
                <th className="w-8 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                  onClick={() => openDetail(e.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="text-xs font-mono text-muted-foreground">{e.serial_number}</div>
                    <div className="text-xs font-mono text-muted-foreground">{e.tag_number}</div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(e.status)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{conditionDot(e.condition)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">{e.assigned_user_name ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Equipment</DialogTitle>
            <DialogDescription>Register new equipment in the inventory.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. MacBook Pro 14" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Equipment["status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Serial Number *</Label>
              <Input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                placeholder="SN-XXX-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Tag Number *</Label>
              <Input value={form.tag_number} onChange={e => setForm(f => ({ ...f, tag_number: e.target.value }))}
                placeholder="TAG-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v as Equipment["condition"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date *</Label>
              <Input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Assign To (optional)</Label>
              <Select value={form.assigned_to || "__none__"} onValueChange={v => setForm(f => ({ ...f, assigned_to: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {userList.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Add Equipment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}