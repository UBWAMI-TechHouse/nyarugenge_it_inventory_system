import { useEffect, useState } from "react"
import { ArrowLeft, Package, ArrowRight, Clock, Hash, Tag, Info, RefreshCw, RotateCcw, UserPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { useApp } from "@/context/AppContext"
import { handovers as handoversApi, type HandoverActivityType, type Handover } from "@/lib/api"
import { cn } from "@/lib/utils"

type HandoverDetail = Awaited<ReturnType<typeof handoversApi.get>>["data"]

const ACTIVITY_CONFIGS: Record<HandoverActivityType, { label: string; icon: React.ComponentType<{className?: string}>; color: string; bg: string }> = {
  reassign: { label: "Reassignment", icon: RefreshCw, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  return: { label: "Return", icon: RotateCcw, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25" },
  new_issue: { label: "New Issue", icon: UserPlus, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/25" },
}

export default function HandoverDetailPage({ handoverId }: { handoverId: string }) {
  const { setSelectedHandoverId } = useApp()
  const [detail, setDetail] = useState<HandoverDetail | null>(null)
  const [equipHistory, setEquipHistory] = useState<Handover[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    handoversApi.get(handoverId)
      .then(async res => {
        if (!res.data) return
        setDetail(res.data)
        // load equipment history
        const hist = await handoversApi.list({ equipmentId: res.data.equipment_id, limit: 50 })
        if (hist.data) setEquipHistory(hist.data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [handoverId])

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (error) return <div className="p-6 text-destructive text-sm">{error}</div>
  if (!detail) return <div className="p-6 text-center text-muted-foreground">Handover not found</div>

  const cfg = ACTIVITY_CONFIGS[detail.activity_type as HandoverActivityType]
  const Icon = cfg.icon

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in pt-16 md:pt-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedHandoverId(null)} className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" /> Back to Handovers
        </Button>
      </div>

      <div className="flex items-start gap-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border", cfg.bg)}>
          <Icon className={cn("w-5 h-5", cfg.color)} />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{cfg.label}</h1>
            <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border", cfg.bg, cfg.color)}>{cfg.label}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />{detail.date} · {detail.id}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader><CardTitle>Transfer Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[1fr,auto,1fr] gap-0 rounded-xl border border-border overflow-hidden">
                <div className="p-4 bg-muted/30">
                  <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">From</div>
                  {detail.from_user_name ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-destructive/15 text-destructive text-sm font-bold flex items-center justify-center">
                          {detail.from_user_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{detail.from_user_name}</div>
                          {detail.from_user_dept && <div className="text-xs text-muted-foreground">{detail.from_user_dept}</div>}
                          {detail.from_user_email && <div className="text-xs text-muted-foreground">{detail.from_user_email}</div>}
                        </div>
                      </div>
                    </div>
                  ) : <div className="text-sm text-muted-foreground italic">Logistics / Store</div>}
                </div>
                <div className="flex items-center justify-center px-4 bg-gradient-to-r from-muted/30 via-background to-primary/8">
                  <ArrowRight className="w-6 h-6 text-primary" />
                </div>
                <div className="p-4 bg-primary/8">
                  <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">To</div>
                  {detail.to_user_name ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                        {detail.to_user_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{detail.to_user_name}</div>
                        {detail.to_user_dept && <div className="text-xs text-muted-foreground">{detail.to_user_dept}</div>}
                        {detail.to_user_email && <div className="text-xs text-muted-foreground">{detail.to_user_email}</div>}
                      </div>
                    </div>
                  ) : <div className="text-sm text-muted-foreground italic">Logistics / Store</div>}
                </div>
              </div>

              {detail.equipment_name && (
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />Equipment Details
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">{detail.equipment_name}</div>
                      {detail.equipment_category && <div className="text-xs text-muted-foreground">{detail.equipment_category}</div>}
                    </div>
                    {detail.equipment_condition && (
                      <Badge variant="secondary" className="ml-auto capitalize">{detail.equipment_condition}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {detail.equipment_serial && (
                      <div className="p-2.5 rounded-lg bg-card border border-border">
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Hash className="w-2.5 h-2.5" />Serial Number</div>
                        <div className="font-mono text-xs font-medium">{detail.equipment_serial}</div>
                      </div>
                    )}
                    {detail.equipment_tag_number && (
                      <div className="p-2.5 rounded-lg bg-card border border-border">
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Tag className="w-2.5 h-2.5" />Tag Number</div>
                        <div className="font-mono text-xs font-medium">{detail.equipment_tag_number}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detail.notes && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border flex items-start gap-2">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-0.5">Notes</div>
                    <div className="text-sm">{detail.notes}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Equipment History</CardTitle>
              <p className="text-xs text-muted-foreground">Full reassignment flow for this device</p>
            </CardHeader>
            <CardContent className="p-0">
              {equipHistory.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground italic">No history found</div>
              ) : (
                <div className="relative">
                  <div className="absolute left-8 top-4 bottom-4 w-px bg-border" />
                  <div className="space-y-0">
                    {equipHistory.map((h, i) => {
                      const hCfg = ACTIVITY_CONFIGS[h.activity_type as HandoverActivityType]
                      const HIcon = hCfg.icon
                      const isThis = h.id === handoverId
                      return (
                        <button key={h.id} onClick={() => setSelectedHandoverId(h.id)}
                          className={cn("w-full flex items-start gap-3 px-4 py-3 transition-colors text-left",
                            isThis ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-muted/30",
                            i < equipHistory.length - 1 && "border-b border-border/50"
                          )}>
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border z-10 relative", hCfg.bg)}>
                            <HIcon className={cn("w-3.5 h-3.5", hCfg.color)} />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className={cn("text-xs font-semibold", hCfg.color)}>{hCfg.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {h.from_user_name ?? "Store"} → {h.to_user_name ?? "Store"}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />{h.date}
                            </div>
                            {h.notes && <div className="text-[10px] text-muted-foreground italic mt-0.5 truncate">"{h.notes}"</div>}
                          </div>
                          {isThis && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
