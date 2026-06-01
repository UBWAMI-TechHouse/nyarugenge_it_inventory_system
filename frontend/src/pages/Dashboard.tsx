import { useEffect, useState } from "react"
import {
  Package, Users, ArrowLeftRight, Wrench, TrendingUp, Clock,
  CheckCircle2, Activity, AlertTriangle, BarChart3, Target
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts"
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/primitives"
import { reports, equipment as equipmentApi, handovers as handoversApi, type DashboardStats, type Equipment, type Handover } from "@/lib/api"
import { useApp } from "@/context/AppContext"
import { cn } from "@/lib/utils"

const COLORS = ["#4f6ef7", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]
const STATUS_COLORS: Record<string, string> = { assigned: "#22c55e", available: "#4f6ef7", maintenance: "#f59e0b", retired: "#ef4444" }

function StatCard({ label, value, icon: Icon, color, bg, sub }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4 transition-shadow hover:shadow-sm">
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", bg)}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function AlertCard({ icon: Icon, title, description, color, bg }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; color: string; bg: string }) {
  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-xl border", bg)}>
      <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", color)} />
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function StaffDashboard() {
  const { user } = useApp()
  const [myEquipment, setMyEquipment] = useState<Equipment[]>([])
  const [myHandovers, setMyHandovers] = useState<Handover[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      equipmentApi.list({ assignedTo: user.id, limit: 200 }),
      handoversApi.list({ userId: user.id, limit: 200 }),
    ])
      .then(([eRes, hRes]) => {
        if (eRes.data) setMyEquipment(eRes.data)
        if (hRes.data) setMyHandovers(hRes.data)
      })
      .finally(() => setLoading(false))
  }, [user?.id])

  if (loading) return <LoadingState />

  const inMaintenance = myEquipment.filter(e => e.status === "maintenance").length
  const goodCondition = myEquipment.filter(e => e.condition === "excellent" || e.condition === "good").length
  const pendingHandovers = myHandovers.filter(h => h.status === "pending").length

  const categoryData = Object.entries(
    myEquipment.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + 1; return acc
    }, {})
  ).map(([name, count]) => ({ name, count }))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Package className="w-3.5 h-3.5" />
            {myEquipment.length} items
          </div>
        </div>
      </div>

      {pendingHandovers > 0 && (
        <AlertCard icon={Clock} color="text-warning" bg="bg-warning/8 border-warning/20"
          title={`${pendingHandovers} pending handover${pendingHandovers > 1 ? "s" : ""}`}
          description="Some handovers require your attention." />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Equipment" value={myEquipment.length} icon={Package} color="text-primary" bg="bg-primary/10"
          sub={goodCondition > 0 ? `${goodCondition} in good condition` : undefined} />
        <StatCard label="My Handovers" value={myHandovers.length} icon={ArrowLeftRight} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" />
        <StatCard label="Under Maintenance" value={inMaintenance} icon={Wrench} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-900/20"
          sub={inMaintenance === 0 ? "No issues" : undefined} />
        <StatCard label="Department" value={user?.department ?? "—"} icon={Users} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-900/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>My Equipment</CardTitle></CardHeader>
          <CardContent className="p-0">
            {myEquipment.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No equipment assigned to you</div>
            ) : (
              <div className="divide-y divide-border">
                {myEquipment.slice(0, 8).map(e => (
                  <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("w-2 h-2 rounded-full shrink-0",
                        e.status === "assigned" ? "bg-success" :
                        e.status === "maintenance" ? "bg-warning" : "bg-muted-foreground"
                      )} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.category} &middot; {e.tag_number}</div>
                      </div>
                    </div>
                    <Badge variant={
                      e.condition === "excellent" ? "success" :
                      e.condition === "good" ? "default" :
                      e.condition === "fair" ? "warning" : "destructive"
                    } className="capitalize shrink-0">{e.condition}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>My Equipment by Category</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data</div>}
          </CardContent>
        </Card>
      </div>

      {myHandovers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Handovers</CardTitle>
              <span className="text-xs text-muted-foreground">{myHandovers.length} total</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {myHandovers.slice(0, 5).map(h => (
                <div key={h.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{h.from_user_name ?? "Logistics"}</span>
                      <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{h.to_user_name ?? "Logistics"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{h.equipment_name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={h.status === "completed" ? "success" : h.status === "pending" ? "warning" : "muted"}>
                      {h.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-0.5">{h.date?.slice(0, 10)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    reports.dashboard()
      .then(r => { if (r.data) setStats(r.data) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error) return <div className="p-6 text-destructive text-sm">{error}</div>
  if (!stats) return null

  const statusData = [
    { name: "Assigned", value: stats.assigned },
    { name: "Available", value: stats.available },
    { name: "Maintenance", value: stats.maintenance },
    { name: "Retired", value: stats.retired },
  ].filter(d => d.value > 0)

  const categoryData = stats.categoryBreakdown.map(c => ({ name: c.category, count: c.count }))
  const inMaintenance = stats.maintenance
  const unassigned = stats.available
  const deploymentRate = stats.totalEquipment > 0 ? Math.round((stats.assigned / stats.totalEquipment) * 100) : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">System overview and key metrics</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Users className="w-3.5 h-3.5" />
            {stats.totalUsers} users
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Activity className="w-3.5 h-3.5" />
            {stats.totalHandovers} handovers
          </div>
        </div>
      </div>

      {inMaintenance > 0 && (
        <AlertCard icon={AlertTriangle} color="text-amber-600" bg="bg-amber-50 border-amber-200 dark:bg-amber-900/15 dark:border-amber-800/30"
          title={`${inMaintenance} item${inMaintenance > 1 ? "s" : ""} under maintenance`}
          description={unassigned > 0 ? `${unassigned} item${unassigned > 1 ? "s" : ""} available for assignment.` : "All equipment is assigned."} />
      )}
      {unassigned > 0 && inMaintenance === 0 && (
        <AlertCard icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50 border-emerald-200 dark:bg-emerald-900/15 dark:border-emerald-800/30"
          title={`${unassigned} item${unassigned > 1 ? "s" : ""} available`}
          description="These items are ready to be assigned to users." />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Equipment" value={stats.totalEquipment} icon={Package} color="text-primary" bg="bg-primary/10"
          sub={`${deploymentRate}% deployed`} />
        <StatCard label="Assigned" value={stats.assigned} icon={Users} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" />
        <StatCard label="Available" value={stats.available} icon={TrendingUp} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard label="Maintenance" value={stats.maintenance} icon={Wrench} color={inMaintenance > 0 ? "text-amber-600" : "text-muted-foreground"} bg={inMaintenance > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/30"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Equipment by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {statusData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {statusData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[d.name] ?? COLORS[0] }} />
                    <span className="text-muted-foreground capitalize">{d.name}</span>
                  </div>
                  <span className="font-medium tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Handovers</CardTitle>
              <span className="text-xs text-muted-foreground">{stats.totalHandovers} total</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentHandovers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No handovers recorded</div>
            ) : (
              <div className="divide-y divide-border">
                {stats.recentHandovers.map(h => (
                  <div key={h.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <ArrowLeftRight className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{h.from_user_name ?? "Store"}</span>
                        <ArrowLeftRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{h.to_user_name ?? "Store"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{h.equipment_name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={h.status === "completed" ? "success" : h.status === "pending" ? "warning" : "muted"}>
                        {h.status}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-0.5">{h.date?.slice(0, 10)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Activity Overview</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <div>
                  <div className="text-sm font-medium">{stats.totalHandovers} Total Transfers</div>
                  <div className="text-xs text-muted-foreground">Across all equipment</div>
                </div>
              </div>
              <Target className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">{stats.categoryBreakdown.length} Categories</div>
                  <div className="text-xs text-muted-foreground">Equipment types tracked</div>
                </div>
              </div>
              <Target className="w-4 h-4 text-muted-foreground" />
            </div>

            {stats.totalEquipment > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Deployment Rate</span>
                  <span className="font-semibold">{deploymentRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${deploymentRate}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { isAdmin } = useApp()
  return isAdmin ? <AdminDashboard /> : <StaffDashboard />
}
