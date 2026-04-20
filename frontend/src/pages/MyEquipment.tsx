import { useState, useEffect, useCallback } from "react"
import { Package, Hash, Tag, Calendar, Search } from "lucide-react"
import { Card, CardContent, Badge } from "@/components/ui/primitives"
import { equipment as equipmentApi, type Equipment } from "@/lib/api"
import { useApp } from "@/context/AppContext"
import { cn } from "@/lib/utils"

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

export default function MyEquipmentPage() {
  const { user } = useApp()
  const [items, setItems] = useState<Equipment[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await equipmentApi.list({ assignedTo: user.id, limit: 200 })
      if (res.data) setItems(res.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load equipment")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(e => {
    const q = search.toLowerCase()
    return e.name.toLowerCase().includes(q) || e.serial_number.toLowerCase().includes(q) || e.tag_number.toLowerCase().includes(q)
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Equipment</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{items.length} items assigned to you</p>
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search equipment…"
          className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">{search ? "No equipment found" : "No equipment assigned to you"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(e => (
            <Card key={e.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
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
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Hash className="w-3 h-3" />{e.serial_number}</div>
                  <div className="flex items-center gap-1.5"><Tag className="w-3 h-3" />{e.tag_number}</div>
                  {e.purchase_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />Purchased {new Date(e.purchase_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  {conditionDot(e.condition)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
