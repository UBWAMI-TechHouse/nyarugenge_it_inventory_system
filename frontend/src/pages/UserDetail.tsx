import { useEffect, useState } from "react"
import { ArrowLeft, Mail, Building2, Package, ArrowLeftRight, Calendar, ArrowRight, Clock, RefreshCw, RotateCcw, UserPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { useApp } from "@/context/AppContext"
import { users as usersApi, type Equipment, type Handover, type HandoverActivityType, type User } from "@/lib/api"
import { cn } from "@/lib/utils"

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-teal-500",
]

const ACTIVITY_CFG: Record<HandoverActivityType, { label: string; icon: React.ComponentType<{className?: string}>; color: string; bg: string }> = {
  reassign: { label: "Reassign", icon: RefreshCw, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  return: { label: "Return", icon: RotateCcw, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25" },
  new_issue: { label: "New Issue", icon: UserPlus, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/25" },
}

export default function UserDetailPage({ userId }: { userId: string }) {
  const { setSelectedUserId, setSelectedHandoverId } = useApp()
  const [user, setUser] = useState<User | null>(null)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [handovers, setHandovers] = useState<Handover[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    usersApi.get(userId)
      .then(res => {
        if (res.data) {
          const { equipment: eq, handovers: hv, ...u } = res.data as User & { equipment: Equipment[]; handovers: Handover[] }
          setUser(u)
          setEquipment(eq ?? [])
          setHandovers(hv ?? [])
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (error) return <div className="p-6 text-destructive text-sm">{error}</div>
  if (!user) return <div className="p-6 text-center text-muted-foreground">User not found</div>

  const avatarColor = AVATAR_COLORS[userId.charCodeAt(0) % AVATAR_COLORS.length]
  const stats = {
    equipment: equipment.length,
    handovers: handovers.length,
    sent: handovers.filter(h => h.from_user_id === userId).length,
    received: handovers.filter(h => h.to_user_id === userId).length,
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in pt-16 md:pt-6">
      <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </Button>

      <Card>
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className={cn("w-16 h-16 rounded-2xl text-white font-bold text-2xl flex items-center justify-center shrink-0 shadow-lg", avatarColor)}>
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
                <Badge variant="secondary">{user.role}</Badge>
              </div>
              <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{user.email}</span>
                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{user.department}</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Since {user.created_at.slice(0, 10)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
            {[
              { label: "Equipment", value: stats.equipment, icon: Package, color: "text-primary", bg: "bg-primary/10" },
              { label: "Total Handovers", value: stats.handovers, icon: ArrowLeftRight, color: "text-muted-foreground", bg: "bg-muted" },
              { label: "Sent", value: stats.sent, icon: ArrowRight, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10" },
              { label: "Received", value: stats.received, icon: ArrowRight, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.bg)}>
                  <s.icon className={cn("w-4 h-4", s.color)} />
                </div>
                <div>
                  <div className="text-lg font-bold leading-none">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Assigned Equipment
              <span className="ml-auto text-sm font-normal text-muted-foreground">{equipment.length} items</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {equipment.length === 0 ? (
              <div className="px-5 pb-5 text-sm text-muted-foreground italic">No equipment currently assigned</div>
            ) : (
              <div className="divide-y divide-border">
                {equipment.map(eq => (
                  <div key={eq.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{eq.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{eq.serial_number} · {eq.tag_number}</div>
                    </div>
                    <Badge variant={eq.condition === "excellent" ? "success" : eq.condition === "good" ? "secondary" : "warning"} className="capitalize shrink-0">
                      {eq.condition}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              Handover History
              <span className="ml-auto text-sm font-normal text-muted-foreground">{handovers.length} records</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {handovers.length === 0 ? (
              <div className="px-5 pb-5 text-sm text-muted-foreground italic">No handover records</div>
            ) : (
              <div className="divide-y divide-border">
                {handovers.map(h => {
                  const isSender = h.from_user_id === userId
                  const cfg = ACTIVITY_CFG[h.activity_type as HandoverActivityType]
                  const Icon = cfg.icon
                  const otherName = isSender ? h.to_user_name : h.from_user_name
                  return (
                    <button key={h.id} onClick={() => setSelectedHandoverId(h.id)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", cfg.bg)}>
                        <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium flex items-center gap-1.5">
                          <span className={isSender ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                            {isSender ? "Sent" : "Received"}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-foreground truncate">{h.equipment_name ?? "Unknown"}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {isSender ? "→ " : "← "}{otherName ?? "Logistics"}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="w-2.5 h-2.5" />{h.date}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
