import { useState, useEffect } from "react"
import { Activity, Package, Users, ArrowLeftRight, Wrench, Building2, Loader2 } from "lucide-react"
import { activities, type ActivityEvent } from "@/lib/api"

function entityIcon(type: string) {
  const map: Record<string, React.ComponentType<{ className?: string }>> = {
    equipment: Package, user: Users, handover: ArrowLeftRight,
    department: Building2, maintenance: Wrench,
  }
  return map[type] ?? Activity
}

function formatTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return "Just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function ActivityLogPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    activities.list({ page, limit: 30 })
      .then(r => {
        if (r.data) setEvents(r.data)
        if (r.totalPages) setTotalPages(r.totalPages)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">System-wide audit trail of all actions</p>
      </div>

      {loading && events.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No activity recorded yet. Activity logging starts running the backend migration.
        </div>
      ) : (
        <>
          <div className="relative pl-10 space-y-0">
            {events.map((ev, i) => {
              const Icon = entityIcon(ev.entity_type)
              const isLast = i === events.length - 1
              return (
                <div key={ev.id} className="relative pb-6 last:pb-0">
                  {!isLast && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
                  <div className="absolute left-0 top-0.5 w-[22px] h-[22px] rounded-full bg-muted flex items-center justify-center">
                    <Icon className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="ml-8">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{ev.user_name ?? "System"}</span>
                      <span className="text-xs text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">{ev.action}</span>
                      <span className="text-xs text-muted-foreground capitalize">{ev.entity_type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                    <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">{formatTime(ev.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors">
                Previous
              </button>
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
