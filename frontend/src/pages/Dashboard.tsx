import { useEffect, useState } from "react"
import { Package, Users, ArrowLeftRight, Wrench, TrendingUp, AlertCircle } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/primitives"
import { reports, equipment as equipmentApi, handovers as handoversApi, type DashboardStats, type Equipment, type Handover } from "@/lib/api"
import { useApp } from "@/context/AppContext"

const COLORS = ["#4f6ef7", "#22c55e", "#f59e0b", "#ef4444"]

// ─── Staff dashboard: only their own equipment + handovers ────────────────────
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

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const categoryData = myEquipment.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1
    return acc
  }, {})
  const chartData = Object.entries(categoryData).map(([name, count]) => ({ name, count }))

  return (
    <div className="p-6 space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
        </p>
      </div>

      {/* Stat cards — only personal stats */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">My Equipment</p>
                <p className="text-3xl font-bold mt-1">{myEquipment.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">My Handovers</p>
                <p className="text-3xl font-bold mt-1">{myHandovers.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Department</p>
                <p className="text-lg font-bold mt-1 truncate">{user?.department ?? "—"}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My equipment list */}
      <Card>
        <CardHeader><CardTitle>My Assigned Equipment</CardTitle></CardHeader>
        <CardContent className="p-0">
          {myEquipment.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No equipment assigned to you</div>
          ) : (
            <div className="divide-y divide-border">
              {myEquipment.map(e => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.category} · {e.tag_number}</div>
                  </div>
                  <Badge variant={
                    e.condition === "excellent" ? "success" :
                    e.condition === "good" ? "default" :
                    e.condition === "fair" ? "warning" : "destructive"
                  }>
                    {e.condition}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My recent handovers */}
      {myHandovers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Recent Handovers</CardTitle>
              <span className="text-xs text-muted-foreground">{myHandovers.length} total</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {myHandovers.slice(0, 5).map(h => (
                <div key={h.id} className="flex items-center gap-4 px-5 py-3">
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

      {/* Category chart if they have equipment */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>My Equipment by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Admin dashboard: full system overview ────────────────────────────────────
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

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (error) return <div className="p-6 text-destructive text-sm">{error}</div>
  if (!stats) return null

  const statusData = [
    { name: "Assigned", value: stats.assigned },
    { name: "Available", value: stats.available },
    { name: "Maintenance", value: stats.maintenance },
    { name: "Retired", value: stats.retired },
  ].filter(d => d.value > 0)

  const categoryData = stats.categoryBreakdown.map(c => ({ name: c.category, count: c.count }))

  const statCards = [
    { label: "Total Equipment", value: stats.totalEquipment, icon: Package, color: "text-primary", bg: "bg-primary/10" },
    { label: "Assigned", value: stats.assigned, icon: Users, color: "text-success", bg: "bg-success/10" },
    { label: "Available", value: stats.available, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10" },
    { label: "Under Maintenance", value: stats.maintenance, icon: Wrench, color: "text-destructive", bg: "bg-destructive/10" },
  ]

  return (
    <div className="p-6 space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of your IT inventory system</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <p className="text-3xl font-bold mt-1">{value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Equipment by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
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
          <CardHeader><CardTitle>Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="45%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Handovers</CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowLeftRight className="w-3.5 h-3.5" />{stats.totalHandovers} total
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {stats.recentHandovers.map(h => (
              <div key={h.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{h.from_user_name ?? "Logistics"}</span>
                    <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{h.to_user_name ?? "Logistics"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{h.equipment_name ?? "Unknown Equipment"}</div>
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

      {stats.available > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning/8">
          <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium">{stats.available} equipment item{stats.available > 1 ? "s" : ""} unassigned</div>
            <div className="text-xs text-muted-foreground mt-0.5">These items are available for assignment to users.</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Route: show correct dashboard based on role ──────────────────────────────
export default function Dashboard() {
  const { isAdmin } = useApp()
  return isAdmin ? <AdminDashboard /> : <StaffDashboard />
}
