import { useState, useEffect, useRef, useCallback } from "react"
import { Search, Package, Users, Building2, X, Loader2 } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { equipment as equipmentApi, users as usersApi, departments as deptsApi, type Department } from "@/lib/api"
import { cn } from "@/lib/utils"

interface SearchResult {
  type: "equipment" | "user" | "department"
  id: string
  label: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
}

export default function GlobalSearch() {
  const { isAdmin, setCurrentPage, setSelectedEquipmentId, setSelectedUserId, setSelectedDepartmentId } = useApp()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const [eRes, uRes, dRes] = await Promise.all([
        equipmentApi.list({ search: q, limit: 5 }),
        usersApi.list({ search: q, limit: 5 }),
        isAdmin ? deptsApi.list() : Promise.resolve({ data: [] as Department[] }),
      ])
      const items: SearchResult[] = []
      if (eRes.data) for (const e of eRes.data) {
        items.push({ type: "equipment", id: e.id, label: e.name, sub: `${e.category} \u00b7 ${e.tag_number}`, icon: Package })
      }
      if (uRes.data) for (const u of uRes.data) {
        items.push({ type: "user", id: u.id, label: u.name, sub: u.email, icon: Users })
      }
      if (isAdmin && dRes.data) for (const d of dRes.data) {
        if (d.name.toLowerCase().includes(q.toLowerCase())) {
          items.push({ type: "department", id: d.id, label: d.name, sub: d.code, icon: Building2 })
        }
      }
      setResults(items)
      setSelectedIndex(0)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [isAdmin])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 150)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(o => !o) }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  function navigate(result: SearchResult) {
    setOpen(false)
    setQuery("")
    setResults([])
    if (result.type === "equipment") {
      setSelectedEquipmentId(result.id)
      setCurrentPage("equipment")
    } else if (result.type === "user") {
      setSelectedUserId(result.id)
      setCurrentPage("users")
    } else if (result.type === "department") {
      setSelectedDepartmentId(result.id)
      setCurrentPage("departments")
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
    if (e.key === "Enter" && results[selectedIndex]) { navigate(results[selectedIndex]) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-colors w-full md:w-48">
        <Search className="w-3.5 h-3.5" />
        <span>Search...</span>
        <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted font-mono hidden md:inline">Ctrl+K</kbd>
      </button>

      {open && (
        <div ref={overlayRef} className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          onClick={e => { if (e.target === overlayRef.current) setOpen(false) }}>
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Search equipment, users, departments..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              {loading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
              <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {results.length === 0 && query.trim() && !loading && (
                <div className="py-8 text-center text-sm text-muted-foreground">No results found</div>
              )}
              {results.map((r, i) => (
                <button key={`${r.type}-${r.id}`} onClick={() => navigate(r)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    i === selectedIndex ? "bg-primary/10" : "hover:bg-muted/50"
                  )}>
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <r.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.label}</div>
                    {r.sub && <div className="text-xs text-muted-foreground truncate">{r.sub}</div>}
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded shrink-0">{r.type}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
              <span><kbd className="font-mono bg-muted px-1 rounded">&uarr;</kbd> <kbd className="font-mono bg-muted px-1 rounded">&darr;</kbd> Navigate</span>
              <span><kbd className="font-mono bg-muted px-1 rounded">Enter</kbd> Open</span>
              <span><kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> Close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
