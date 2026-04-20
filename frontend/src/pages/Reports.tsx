import { useState, useEffect, useCallback, useRef } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/primitives"
import { reports as reportsApi, users as usersApi, departments as deptsApi } from "@/lib/api"
import { Download, TrendingUp, Package, Users, ArrowLeftRight, Filter, X, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const COLORS = ["#4f6ef7", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"]

type EqReport = {
  byDepartment: { dept: string; count: number }[]
  byCategory: { name: string; value: number }[]
  byCondition: { name: string; value: number }[]
  topUsers: { name: string; count: number; department: string }[]
}

type HvReport = {
  monthly: { month: string; count: number }[]
  byActivity: { activity_type: string; count: number }[]
  topUsers: { name: string; count: number }[]
}

const CONDITION_COLORS: Record<string, string> = {
  excellent: "#22c55e",
  good: "#4f6ef7",
  fair: "#f59e0b",
  poor: "#ef4444",
}

const ACTIVITY_COLORS: Record<string, string> = {
  reassign: "#4f6ef7",
  return: "#f59e0b",
  new_issue: "#22c55e",
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-foreground mb-4">{children}</h2>
}

export default function ReportsPage() {
  const [eqReport, setEqReport] = useState<EqReport | null>(null)
  const [hvReport, setHvReport] = useState<HvReport | null>(null)
  const [userList, setUserList] = useState<{ id: string; name: string }[]>([])
  const [deptList, setDeptList] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [exporting, setExporting] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const [filters, setFilters] = useState({
    period: "all",
    dateFrom: "",
    dateTo: "",
    department: "",
    userId: "",
    condition: "",
    category: "",
    activityType: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const f = filters
      const [eqRes, hvRes, uRes, dRes] = await Promise.all([
        reportsApi.equipment({
          period: (f.period !== "all" && !f.dateFrom && !f.dateTo) ? f.period : undefined,
          condition: f.condition || undefined,
          category: f.category || undefined,
          dateFrom: f.dateFrom || undefined,
          dateTo: f.dateTo || undefined,
          userId: f.userId || undefined,
        }),
        reportsApi.handovers({
          period: (f.period !== "all" && !f.dateFrom && !f.dateTo) ? f.period : undefined,
          dateFrom: f.dateFrom || undefined,
          dateTo: f.dateTo || undefined,
          userId: f.userId || undefined,
          activityType: f.activityType || undefined,
        }),
        usersApi.list({ limit: 200 }),
        deptsApi.list(),
      ])
      if (eqRes.data) setEqReport(eqRes.data)
      if (hvRes.data) setHvReport(hvRes.data)
      if (uRes.data) setUserList(uRes.data.map(u => ({ id: u.id, name: u.name })))
      if (dRes.data) setDeptList(dRes.data.map(d => ({ id: d.id, name: d.name })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { load() }, [load])

  function setFilter(key: string, val: string) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  function clearFilters() {
    setFilters({ period: "all", dateFrom: "", dateTo: "", department: "", userId: "", condition: "", category: "", activityType: "" })
  }

  const activeFilters = Object.entries(filters).filter(([k, v]) => k !== "period" ? v !== "" : v !== "all").length

  // ── PDF Export via browser print ─────────────────────────────────────────────
  function handleExportPDF() {
    setExporting(true)
    setTimeout(() => {
      window.print()
      setExporting(false)
    }, 100)
  }

  const totalEquipment = (eqReport?.byCategory ?? []).reduce((s, c) => s + c.value, 0)
  const totalHandovers = (hvReport?.monthly ?? []).reduce((s, m) => s + m.count, 0)

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #report-print-area { display: block !important; }
          #report-print-area { position: fixed; top: 0; left: 0; right: 0; }
          .no-print { display: none !important; }
          .recharts-wrapper { page-break-inside: avoid; }
        }
      `}</style>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl font-semibold">Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Analytics and insights across your inventory</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(s => !s)}
              className={cn("gap-1.5", activeFilters > 0 && "border-primary text-primary")}>
              <Filter className="w-4 h-4" />
              Filters
              {activeFilters > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilters}</span>
              )}
            </Button>
            <Button size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-1.5">
              <Download className="w-4 h-4" />
              {exporting ? "Preparing…" : "Export PDF"}
            </Button>
          </div>
        </div>

        {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg no-print">{error}</div>}

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 no-print">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Advanced Filters</h3>
              <div className="flex items-center gap-2">
                {activeFilters > 0 && (
                  <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <X className="w-3 h-3" />Clear all
                  </button>
                )}
                <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Time Period</Label>
                <Select value={filters.period} onValueChange={v => setFilter("period", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="1y">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From Date</Label>
                <input type="date" value={filters.dateFrom} onChange={e => setFilter("dateFrom", e.target.value)}
                  className="flex w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To Date</Label>
                <input type="date" value={filters.dateTo} onChange={e => setFilter("dateTo", e.target.value)}
                  className="flex w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <Select value={filters.department || "__none__"} onValueChange={v => setFilter("department", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Departments</SelectItem>
                    {deptList.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">User</Label>
                <Select value={filters.userId || "__none__"} onValueChange={v => setFilter("userId", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Users</SelectItem>
                    {userList.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Condition</Label>
                <Select value={filters.condition || "__none__"} onValueChange={v => setFilter("condition", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Conditions</SelectItem>
                    {["excellent", "good", "fair", "poor"].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={filters.category || "__none__"} onValueChange={v => setFilter("category", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Categories</SelectItem>
                    {["Laptop", "Desktop", "Monitor", "Printer", "Phone", "Server", "Networking", "Peripheral"].map(c =>
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Handover Type</Label>
                <Select value={filters.activityType || "__none__"} onValueChange={v => setFilter("activityType", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Types</SelectItem>
                    <SelectItem value="reassign">Reassign</SelectItem>
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="new_issue">New Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div id="report-print-area" ref={printRef} className="space-y-8">
            {/* Print header (only shows on print) */}
            <div className="hidden print:block mb-6">
              <h1 className="text-2xl font-bold">IT Inventory — Report</h1>
              <p className="text-sm text-gray-500 mt-1">Generated on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              {activeFilters > 0 && (
                <p className="text-xs text-gray-400 mt-1">Filters applied: {Object.entries(filters).filter(([k, v]) => k !== "period" ? v : v !== "all").map(([k, v]) => `${k}=${v}`).join(", ")}</p>
              )}
            </div>

            {/* KPI summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Equipment", value: totalEquipment, icon: Package, color: "text-primary", bg: "bg-primary/10" },
                { label: "Categories", value: eqReport?.byCategory.length ?? 0, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
                { label: "Total Handovers", value: totalHandovers, icon: ArrowLeftRight, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
                { label: "Active Users", value: eqReport?.topUsers.length ?? 0, icon: Users, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", bg)}>
                    <Icon className={cn("w-5 h-5", color)} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Equipment by Category + Condition */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border bg-card p-5">
                <SectionTitle>Equipment by Category</SectionTitle>
                {eqReport?.byCategory && eqReport.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={eqReport.byCategory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {eqReport.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <SectionTitle>Equipment Condition</SectionTitle>
                {eqReport?.byCondition && eqReport.byCondition.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={eqReport.byCondition} cx="50%" cy="50%" outerRadius={90}
                        dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}>
                        {eqReport.byCondition.map((entry, i) => (
                          <Cell key={i} fill={CONDITION_COLORS[entry.name] ?? COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </div>

            {/* Equipment by Department */}
            <div className="rounded-xl border border-border bg-card p-5">
              <SectionTitle>Equipment by Department</SectionTitle>
              {eqReport?.byDepartment && eqReport.byDepartment.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={eqReport.byDepartment} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="dept" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>

            {/* Handover trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border bg-card p-5">
                <SectionTitle>Monthly Handover Trends</SectionTitle>
                {hvReport?.monthly && hvReport.monthly.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={hvReport.monthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradHandovers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="count" stroke="#4f6ef7" strokeWidth={2} fill="url(#gradHandovers)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <SectionTitle>Handovers by Activity Type</SectionTitle>
                {hvReport?.byActivity && hvReport.byActivity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={hvReport.byActivity} cx="50%" cy="50%" outerRadius={80}
                        dataKey="count" nameKey="activity_type"
                        label={({ activity_type, percent }) => `${activity_type} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}>
                        {hvReport.byActivity.map((entry, i) => (
                          <Cell key={i} fill={ACTIVITY_COLORS[entry.activity_type] ?? COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </div>

            {/* Top Users tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border bg-card p-5">
                <SectionTitle>Top Equipment Holders</SectionTitle>
                {eqReport?.topUsers && eqReport.topUsers.length > 0 ? (
                  <div className="space-y-2">
                    {eqReport.topUsers.slice(0, 8).map((u, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.department}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="h-1.5 rounded-full bg-primary/20 w-20 overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, (u.count / (eqReport.topUsers[0]?.count || 1)) * 100)}%` }} />
                          </div>
                          <span className="text-sm font-semibold w-4 text-right">{u.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyData />}
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <SectionTitle>Most Active Users (Handovers)</SectionTitle>
                {hvReport?.topUsers && hvReport.topUsers.length > 0 ? (
                  <div className="space-y-2">
                    {hvReport.topUsers.slice(0, 8).map((u, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{u.name}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="h-1.5 rounded-full bg-amber-200 dark:bg-amber-900/40 w-20 overflow-hidden">
                            <div className="h-full rounded-full bg-amber-500 transition-all"
                              style={{ width: `${Math.min(100, (u.count / (hvReport.topUsers[0]?.count || 1)) * 100)}%` }} />
                          </div>
                          <span className="text-sm font-semibold w-4 text-right">{u.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyData />}
              </div>
            </div>

            {/* Summary table for print */}
            <div className="rounded-xl border border-border bg-card p-5">
              <SectionTitle>Equipment Category Summary</SectionTitle>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Count</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(eqReport?.byCategory ?? []).map((c, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        {c.name}
                      </td>
                      <td className="py-2 text-right font-mono">{c.value}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {totalEquipment > 0 ? ((c.value / totalEquipment) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                  {(eqReport?.byCategory ?? []).length > 0 && (
                    <tr className="font-semibold">
                      <td className="pt-2">Total</td>
                      <td className="pt-2 text-right font-mono">{totalEquipment}</td>
                      <td className="pt-2 text-right">100%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function EmptyChart() {
  return <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data available</div>
}

function EmptyData() {
  return <div className="py-8 text-center text-muted-foreground text-sm">No data available</div>
}