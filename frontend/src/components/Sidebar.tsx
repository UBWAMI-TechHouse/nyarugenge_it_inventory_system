import { useState } from "react"
import {
  LayoutDashboard, Package, ArrowLeftRight, Users, BarChart3,
  LogOut, Sun, Moon, Building2, Menu, X, Laptop, History
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { Button } from "@/components/ui/button"

const adminNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "equipment", label: "Equipment", icon: Package },
  { id: "handovers", label: "Handovers", icon: ArrowLeftRight },
  { id: "users", label: "Users", icon: Users },
  { id: "departments", label: "Departments", icon: Building2 },
  { id: "reports", label: "Reports", icon: BarChart3 },
]

const staffNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "my_equipment", label: "My Equipment", icon: Laptop },
  { id: "my_handovers", label: "My Handovers", icon: History },
]

export default function Sidebar() {
  const { currentPage, setCurrentPage, isDark, toggleDark, setSelectedUserId, setSelectedHandoverId, setSelectedEquipmentId, setSelectedDepartmentId, logout, user, isAdmin } = useApp()
  const [mobileOpen, setMobileOpen] = useState(false)

  function navigate(id: string) {
    setCurrentPage(id)
    setSelectedUserId(null)
    setSelectedHandoverId(null)
    setSelectedEquipmentId(null)
    setSelectedDepartmentId(null)
    setMobileOpen(false)
  }

  const navItems = isAdmin ? adminNavItems : staffNavItems

  const sidebarContent = (
    <aside className="flex flex-col w-full h-full bg-sidebar border-r border-sidebar-border">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <Package className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground leading-tight">IT Inventory</div>
              <div className="text-[10px] text-muted-foreground leading-tight">Management System</div>
            </div>
          </div>
          <button className="md:hidden p-1.5 rounded-md hover:bg-muted" onClick={() => setMobileOpen(false)}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/8 border border-primary/15">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-primary truncate block">{user.name}</span>
              {!isAdmin && <span className="text-[10px] text-muted-foreground capitalize">{user.role}</span>}
            </div>
            {isAdmin && (
              <span className="text-[9px] font-semibold bg-primary/20 text-primary px-1.5 py-0.5 rounded">ADMIN</span>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id
          return (
            <button key={id} onClick={() => navigate(id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}>
              <Icon className="w-4 h-4 shrink-0" />{label}
            </button>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        <Button variant="ghost" size="sm" onClick={toggleDark}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </Button>
        <Button variant="ghost" size="sm" onClick={logout}
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10">
          <LogOut className="w-4 h-4" />Logout
        </Button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Mobile trigger */}
      <button className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border shadow-sm"
        onClick={() => setMobileOpen(true)}>
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <div className={cn(
        "md:hidden fixed left-0 top-0 bottom-0 z-40 w-64 transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:shrink-0 h-screen">
        {sidebarContent}
      </div>
    </>
  )
}
