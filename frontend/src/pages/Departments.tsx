import { useState, useEffect, useCallback } from "react"
import { Plus, Search, Building2, Users, Package, Calendar, LayoutGrid, List, ChevronRight } from "lucide-react"
import { Card, CardContent, Label } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { departments as deptsApi, type Department } from "@/lib/api"
import { useApp } from "@/context/AppContext"
import { cn } from "@/lib/utils"

const DEPT_COLORS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
  "from-fuchsia-500 to-pink-600",
]

function deptColor(index: number) {
  return DEPT_COLORS[index % DEPT_COLORS.length]
}

export default function DepartmentsPage() {
  const { setSelectedDepartmentId, setCurrentPage } = useApp()
  const [depts, setDepts] = useState<Department[]>([])
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", code: "", description: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await deptsApi.list()
      if (res.data) setDepts(res.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = depts.filter(d => {
    const q = search.toLowerCase()
    return d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
  })

  const totalUsers = depts.reduce((s, d) => s + (d.user_count ?? 0), 0)

  function openDetail(id: string) {
    setSelectedDepartmentId(id)
    setCurrentPage("departments")
  }

  async function handleAdd() {
    if (!form.name || !form.code) return
    setSaving(true)
    try {
      await deptsApi.create({ name: form.name, code: form.code.toUpperCase(), description: form.description || undefined })
      setShowAdd(false)
      setForm({ name: "", code: "", description: "" })
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add department")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Departments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{depts.length} departments · {totalUsers} total staff</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1.5" />Add Department</Button>
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold">{depts.length}</div>
            <div className="text-sm text-muted-foreground">Departments</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <div className="text-sm text-muted-foreground">Total Staff</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search departments…"
            className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
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
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No departments found</div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d, i) => (
            <Card key={d.id} className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 overflow-hidden"
              onClick={() => openDetail(d.id)}>
              <div className={cn("h-1.5 w-full bg-gradient-to-r", deptColor(i))} />
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shrink-0", deptColor(i))}>
                    {d.code.slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.description || "No description"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                      <Users className="w-3 h-3" />Staff
                    </div>
                    <div className="font-semibold">{d.user_count ?? "—"}</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                      <Package className="w-3 h-3" />Equipment
                    </div>
                    <div className="font-semibold">{d.equipment_count ?? "—"}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />Since {new Date(d.created_at).toLocaleDateString()}
                  </div>
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{d.code}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Code</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Equipment</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Created</th>
                <th className="w-8 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                  onClick={() => openDetail(d.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-bold shrink-0", deptColor(i))}>
                        {d.code.slice(0, 3)}
                      </div>
                      <div>
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{d.description || "No description"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{d.code}</span>
                  </td>
                  <td className="px-4 py-3">{d.user_count ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{d.equipment_count ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {new Date(d.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription>Create a new department in the system.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Department Name *</Label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Information Technology"
                className="flex w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <Label>Code *</Label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. ICT"
                maxLength={6}
                className="flex w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of the department"
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Add Department"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
