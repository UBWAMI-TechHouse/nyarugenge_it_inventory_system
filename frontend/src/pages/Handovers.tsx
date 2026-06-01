import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Search, Plus, ChevronRight, X, RotateCcw, UserPlus, RefreshCw,
  SortAsc, SortDesc, Filter, ArrowLeftRight
} from "lucide-react"
import { Label, Input, Textarea } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/primitives"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/components/ui/toast"
import {
  handovers as handoversApi, users as usersApi, equipment as equipmentApi,
  type Handover, type User, type Equipment, type HandoverActivityType
} from "@/lib/api"
import { cn } from "@/lib/utils"

const ACTIVITY_TYPES = [
  { id: "reassign" as HandoverActivityType, label: "Reassign", icon: RefreshCw, color: "text-primary", bg: "bg-primary/10 border-primary/25", description: "Transfer equipment from one user to another" },
  { id: "return" as HandoverActivityType, label: "Return", icon: RotateCcw, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25", description: "Equipment returned to logistics" },
  { id: "new_issue" as HandoverActivityType, label: "New Issue", icon: UserPlus, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/25", description: "Issue new equipment to a user" },
]

function activityConfig(type: HandoverActivityType) {
  return ACTIVITY_TYPES.find(t => t.id === type) ?? ACTIVITY_TYPES[0]
}

function statusColor(status: Handover["status"]) {
  return {
    completed: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    cancelled: "bg-muted text-muted-foreground"
  }[status]
}

function UserDropdown({ users, value, onChange, placeholder, label, exclude = [] }: {
  users: User[], value: string, onChange: (id: string) => void,
  placeholder: string, label: string, exclude?: string[]
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const available = users.filter(u => !exclude.includes(u.id))
  const filtered = available.filter(u =>
    u.name.toLowerCase().includes(query.toLowerCase()) ||
    u.email.toLowerCase().includes(query.toLowerCase())
  )
  const selected = users.find(u => u.id === value)
  return (
    <div className="space-y-1.5 relative">
      <Label>{label}</Label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={cn("w-full flex items-center justify-between px-3 py-2 h-9 rounded-md border text-sm bg-card hover:bg-accent/30 transition-all",
          open ? "border-primary ring-2 ring-ring" : "border-input"
        )}>
        {selected ? (
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">{selected.name.charAt(0)}</span>
            <span className="font-medium text-foreground">{selected.name}</span>
          </span>
        ) : <span className="text-muted-foreground/70">{placeholder}</span>}
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-md">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search…" className="flex-1 bg-transparent text-sm outline-none" />
              {query && <button onClick={() => setQuery("")}><X className="w-3 h-3 text-muted-foreground" /></button>}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button onClick={() => { onChange(""); setOpen(false) }}
              className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/60">
              — None
            </button>
            {filtered.map(u => (
              <button key={u.id} type="button" onClick={() => { onChange(u.id); setOpen(false); setQuery("") }}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/60 transition-colors",
                  value === u.id && "bg-primary/8 border-l-2 border-primary"
                )}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  value === u.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>{u.name.charAt(0)}</span>
                <div>
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.department}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HandoversPage() {
  const { setSelectedHandoverId, user, isAdmin } = useApp()
  const { toast } = useToast()
  const [items, setItems] = useState<Handover[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortField, setSortField] = useState("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [showFilters, setShowFilters] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [actType, setActType] = useState<HandoverActivityType>("reassign")
  const [formFrom, setFormFrom] = useState("")
  const [formTo, setFormTo] = useState("")
  const [formEquip, setFormEquip] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: "500" }
      if (!isAdmin && user?.id) params.userId = user.id
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo

      const [hRes, uRes, eRes] = await Promise.all([
        handoversApi.list(params),
        usersApi.list({ limit: 200 }),
        equipmentApi.list({ limit: 200 }),
      ])
      if (hRes.data) setItems(hRes.data)
      if (uRes.data) setUsers(uRes.data)
      if (eRes.data) setEquipmentList(eRes.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [isAdmin, user?.id, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = items.filter(h => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        h.equipment_name?.toLowerCase().includes(q) ||
        h.from_user_name?.toLowerCase().includes(q) ||
        h.to_user_name?.toLowerCase().includes(q) ||
        h.equipment_tag_number?.toLowerCase().includes(q)
      const matchType = filterType === "all" || h.activity_type === filterType
      const matchStatus = filterStatus === "all" || h.status === filterStatus
      return matchSearch && matchType && matchStatus
    })

    list = [...list].sort((a, b) => {
      if (sortField === "date") {
        const av = new Date(a.date).getTime()
        const bv = new Date(b.date).getTime()
        return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      }
      const av = String(a[sortField as keyof Handover] ?? "")
      const bv = String(b[sortField as keyof Handover] ?? "")
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    })

    return list
  }, [items, search, filterType, filterStatus, sortField, sortDir])

  // Summary stats
  const stats = useMemo(() => ({
    total: items.length,
    reassign: items.filter(h => h.activity_type === "reassign").length,
    return: items.filter(h => h.activity_type === "return").length,
    new_issue: items.filter(h => h.activity_type === "new_issue").length,
  }), [items])

  function toggleSort(field: string) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  async function handleAdd() {
    if (!formEquip) return
    setSaving(true)
    try {
      await handoversApi.create({
        equipment_id: formEquip,
        activity_type: actType,
        from_user_id: formFrom || null,
        to_user_id: formTo || null,
        notes: formNotes || undefined,
        date: formDate,
      })
      setShowAdd(false)
      setFormFrom(""); setFormTo(""); setFormEquip(""); setFormNotes("")
      setFormDate(new Date().toISOString().slice(0, 10))
      setActType("reassign")
      load()
      toast("Handover created successfully", "success")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create handover")
      toast(e instanceof Error ? e.message : "Failed to create handover", "error")
    } finally {
      setSaving(false)
    }
  }

  const activeFilters = [filterType !== "all", filterStatus !== "all", !!dateFrom, !!dateTo].filter(Boolean).length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Handovers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin ? "Track all equipment transfer history" : "Your equipment transfers"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1.5" />New Handover</Button>
        )}
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Transfers", value: stats.total, icon: ArrowLeftRight, color: "text-primary", bg: "bg-primary/10" },
          { label: "Reassignments", value: stats.reassign, icon: RefreshCw, color: "text-primary", bg: "bg-primary/10" },
          { label: "Returns", value: stats.return, icon: RotateCcw, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
          { label: "New Issues", value: stats.new_issue, icon: UserPlus, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
              <Icon className={cn("w-4 h-4", color)} />
            </div>
            <div>
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user or equipment…"
            className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {/* Quick type filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[{ id: "all", label: "All" }, ...ACTIVITY_TYPES.map(t => ({ id: t.id, label: t.label }))].map(t => (
            <button key={t.id} onClick={() => setFilterType(t.id)}
              className={cn("px-3 h-8 rounded-full text-sm font-medium transition-colors border",
                filterType === t.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}>
              {t.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(s => !s)}
          className={cn("gap-1.5", activeFilters > 0 && "border-primary text-primary")}>
          <Filter className="w-4 h-4" />
          Filters {activeFilters > 0 && <span className="bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilters}</span>}
        </Button>
        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <Select value={sortField} onValueChange={setSortField}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="activity_type">Type</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
            className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-accent">
            {sortDir === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From Date</Label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="flex w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To Date</Label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="flex w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => {
              setFilterType("all"); setFilterStatus("all"); setDateFrom(""); setDateTo("")
            }}>
              <X className="w-3 h-3 mr-1" />Clear Filters
            </Button>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {items.length} records
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No handovers found</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("date")}>
                  <span className="flex items-center gap-1">Date {sortField === "date" && (sortDir === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}</span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Equipment</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Transfer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="w-8 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(h => {
                const cfg = activityConfig(h.activity_type)
                const Icon = cfg.icon
                return (
                  <tr key={h.id}
                    className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => setSelectedHandoverId(h.id)}>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(h.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("flex items-center gap-1.5 text-xs font-medium", cfg.color)}>
                        <Icon className="w-3.5 h-3.5 shrink-0" />{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="font-medium text-sm truncate max-w-[160px]">{h.equipment_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{h.equipment_tag_number}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs text-muted-foreground">
                        {h.from_user_name && <span>{h.from_user_name} → </span>}
                        {h.to_user_name && <span className="text-foreground font-medium">{h.to_user_name}</span>}
                        {!h.from_user_name && !h.to_user_name && "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", statusColor(h.status))}>{h.status}</span>
                    </td>
                    <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Handover Dialog */}
      {isAdmin && (
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Handover</DialogTitle>
              <DialogDescription>Record an equipment transfer.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Activity type */}
              <div className="grid grid-cols-3 gap-2">
                {ACTIVITY_TYPES.map(t => {
                  const Icon = t.icon
                  return (
                    <button key={t.id} type="button" onClick={() => { setActType(t.id); setFormEquip(""); setFormFrom(""); setFormTo("") }}
                      className={cn("flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-center transition-all",
                        actType === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      )}>
                      <Icon className={cn("w-5 h-5", actType === t.id ? t.color : "text-muted-foreground")} />
                      <span className={cn("text-xs font-medium", actType === t.id ? "text-foreground" : "text-muted-foreground")}>{t.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* FROM USER — shown for Reassign & Return; selecting this filters equipment */}
              {actType !== "new_issue" && (
                <UserDropdown users={users} value={formFrom}
                  onChange={id => { setFormFrom(id); setFormEquip("") }}
                  placeholder="Select user" label="From User *" exclude={formTo ? [formTo] : []} />
              )}

              {/* TO USER — shown for Reassign & New Issue */}
              {actType !== "return" && (
                <UserDropdown users={users} value={formTo}
                  onChange={id => { setFormTo(id); if (actType === "new_issue") setFormEquip("") }}
                  placeholder="Select user" label="To User *" exclude={formFrom ? [formFrom] : []} />
              )}

              {/* EQUIPMENT — filtered by the relevant user, shows serial + tag */}
              {(() => {
                const isNewIssue = actType === "new_issue"
                // For Reassign/Return: filter by fromUser's assigned equipment
                // For New Issue: show all available equipment
                const relevantUserId = isNewIssue ? null : formFrom
                const filteredEquip = relevantUserId
                  ? equipmentList.filter(e => e.assigned_to === relevantUserId)
                  : isNewIssue
                    ? equipmentList.filter(e => e.status === "available")
                    : equipmentList
                const noUserSelected = !isNewIssue && !formFrom
                return (
                  <div className="space-y-1.5">
                    <Label>
                      Equipment *
                      {filteredEquip.length === 0 && (
                        <span className="ml-2 text-xs font-normal text-amber-600">
                          {isNewIssue ? "no available equipment" : "no equipment assigned to this user"}
                        </span>
                      )}
                    </Label>
                    <Select value={formEquip} onValueChange={setFormEquip} disabled={noUserSelected}>
                      <SelectTrigger className={cn(noUserSelected && "opacity-60")}>
                        <SelectValue placeholder={noUserSelected ? "Select From User first" : "Select equipment"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredEquip.length === 0 ? (
                          <div className="px-3 py-4 text-sm text-center text-muted-foreground">
                            {isNewIssue ? "No available equipment" : "No equipment for this user"}
                          </div>
                        ) : (
                          filteredEquip.map(e => (
                            <SelectItem key={e.id} value={e.id}>
                              <span className="flex flex-col">
                                <span className="font-medium">{e.name}</span>
                                <span className="text-xs text-muted-foreground">SN: {e.serial_number} · Tag: {e.tag_number}</span>
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {formEquip && (() => {
                      const sel = equipmentList.find(e => e.id === formEquip)
                      return sel ? (
                        <div className="flex gap-4 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                          <span>Serial: <span className="font-mono text-foreground">{sel.serial_number}</span></span>
                          <span>Tag: <span className="font-mono text-foreground">{sel.tag_number}</span></span>
                        </div>
                      ) : null
                    })()}
                  </div>
                )
              })()}

              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)}
                  rows={2} placeholder="Additional notes…" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving || !formEquip}>{saving ? "Saving…" : "Create Handover"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}