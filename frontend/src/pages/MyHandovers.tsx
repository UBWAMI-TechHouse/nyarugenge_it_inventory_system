import { useState, useEffect, useCallback } from "react"
import { Search, ArrowLeftRight, RefreshCw, RotateCcw, UserPlus, ChevronRight } from "lucide-react"
import { handovers as handoversApi, type Handover } from "@/lib/api"
import { useApp } from "@/context/AppContext"
import { cn } from "@/lib/utils"

const ACTIVITY_COLORS = {
  reassign: { color: "text-primary", bg: "bg-primary/10" },
  return: { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
  new_issue: { color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
}

const ACTIVITY_ICONS = {
  reassign: RefreshCw,
  return: RotateCcw,
  new_issue: UserPlus,
}

function statusColor(status: Handover["status"]) {
  return {
    completed: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    cancelled: "bg-muted text-muted-foreground"
  }[status]
}

export default function MyHandoversPage() {
  const { user, setSelectedHandoverId } = useApp()
  const [items, setItems] = useState<Handover[]>([])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await handoversApi.list({ userId: user.id, limit: 200 })
      if (res.data) setItems(res.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(h => {
    const q = search.toLowerCase()
    const matchSearch = !q || h.equipment_name?.toLowerCase().includes(q) || h.from_user_name?.toLowerCase().includes(q) || h.to_user_name?.toLowerCase().includes(q)
    const matchType = filterType === "all" || h.activity_type === filterType
    return matchSearch && matchType
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Handovers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{items.length} equipment transfers involving you</p>
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search handovers…"
            className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex items-center gap-1.5">
          {[{ id: "all", label: "All" }, { id: "reassign", label: "Reassign" }, { id: "return", label: "Return" }, { id: "new_issue", label: "New Issue" }].map(t => (
            <button key={t.id} onClick={() => setFilterType(t.id)}
              className={cn("px-3 h-8 rounded-full text-sm font-medium transition-colors border",
                filterType === t.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ArrowLeftRight className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">{search ? "No handovers found" : "No handover history"}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipment</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Transfer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(h => {
                const actCfg = ACTIVITY_COLORS[h.activity_type] ?? ACTIVITY_COLORS.reassign
                const Icon = ACTIVITY_ICONS[h.activity_type] ?? RefreshCw
                return (
                  <tr key={h.id}
                    className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => setSelectedHandoverId(h.id)}>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(h.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("flex items-center gap-1.5 text-xs font-medium", actCfg.color)}>
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="capitalize">{h.activity_type.replace("_", " ")}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[140px]">{h.equipment_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{h.equipment_tag_number}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {h.from_user_name && <span>{h.from_user_name} → </span>}
                      {h.to_user_name && <span className="text-foreground font-medium">{h.to_user_name}</span>}
                      {!h.from_user_name && !h.to_user_name && "—"}
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
    </div>
  )
}
