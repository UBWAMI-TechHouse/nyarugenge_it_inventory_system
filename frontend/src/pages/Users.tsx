import { useState, useEffect, useCallback } from "react"
import { Plus, Search, ChevronRight, LayoutGrid, List, Building2 } from "lucide-react"
import { Card, CardContent, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { users as usersApi, departments as deptsApi, type User, type Department } from "@/lib/api"
import { useApp } from "@/context/AppContext"
import { cn } from "@/lib/utils"

// Match the roles actually used in the seed / backend
const ROLES = ["Staff", "Manager", "Analyst", "Technician", "Administrator"]

export default function UsersPage() {
  const { setSelectedUserId } = useApp()
  const [items, setItems] = useState<User[]>([])
  const [depts, setDepts] = useState<Department[]>([])
  const [search, setSearch] = useState("")
  const [filterDept, setFilterDept] = useState("all")
  const [view, setView] = useState<"grid" | "list">("list")
  const [showAdd, setShowAdd] = useState(false)
  // Use "__none__" as sentinel so Radix never sees an empty-string value
  const [form, setForm] = useState({ name: "", email: "", department_id: "__none__", role: "Staff", password: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, dRes] = await Promise.all([usersApi.list({ limit: 500 }), deptsApi.list()])
      if (uRes.data) setItems(uRes.data)
      if (dRes.data) setDepts(dRes.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchDept = filterDept === "all" || u.department_id === filterDept
    return matchSearch && matchDept
  })

  async function handleAdd() {
    if (!form.name || !form.email || form.department_id === "__none__") {
      setError("Name, email and department are required")
      return
    }
    setSaving(true); setError("")
    try {
      await usersApi.create({
        name: form.name, email: form.email,
        department_id: form.department_id,
        role: form.role,
        password: form.password || undefined,
      })
      setShowAdd(false)
      setForm({ name: "", email: "", department_id: "__none__", role: "Staff", password: "" })
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add user")
    } finally {
      setSaving(false)
    }
  }

  function avatar(name: string) {
    return (
      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} staff members</p>
        </div>
        <Button onClick={() => { setError(""); setShowAdd(true) }}>
          <Plus className="w-4 h-4 mr-1.5" />Add User
        </Button>
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
            className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
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
        <div className="text-center py-16 text-muted-foreground">No users found</div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(u => (
            <Card key={u.id} className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/30"
              onClick={() => setSelectedUserId(u.id)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  {avatar(u.name)}
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{u.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3" />{u.department ?? "—"}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground capitalize">
                      {u.role}
                    </span>
                    {u.equipment_count !== undefined && (
                      <span className="text-xs text-muted-foreground">{u.equipment_count} items</span>
                    )}
                  </div>
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Department</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Equipment</th>
                <th className="w-8 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                  onClick={() => setSelectedUserId(u.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {avatar(u.name)}
                      <div>
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{u.department ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground capitalize">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {u.equipment_count ?? 0} items
                  </td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={open => { setShowAdd(open); if (!open) setError("") }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new staff account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { label: "Full Name *", key: "name", placeholder: "John Doe" },
              { label: "Email *", key: "email", placeholder: "john@example.com", type: "email" },
              { label: "Password", key: "password", placeholder: "Leave blank to auto-generate", type: "password" },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <input type={type ?? "text"} placeholder={placeholder}
                  value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="flex w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Department *</Label>
              <Select
                value={form.department_id}
                onValueChange={v => setForm(f => ({ ...f, department_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department…" />
                </SelectTrigger>
                <SelectContent>
                  {/* "__none__" sentinel — never shown after selection */}
                  <SelectItem value="__none__" disabled>Select department…</SelectItem>
                  {depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Add User"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
