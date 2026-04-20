import type { ReactElement } from "react"
import { AppProvider, useApp } from "@/context/AppContext"
import Sidebar from "@/components/Sidebar"
import LoginPage from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import EquipmentPage from "@/pages/Equipment"
import EquipmentDetailPage from "@/pages/EquipmentDetail"
import HandoversPage from "@/pages/Handovers"
import UsersPage from "@/pages/Users"
import UserDetailPage from "@/pages/UserDetail"
import HandoverDetailPage from "@/pages/HandoverDetail"
import ReportsPage from "@/pages/Reports"
import DepartmentsPage from "@/pages/Departments"
import DepartmentDetailPage from "@/pages/DepartmentDetail"
import MyEquipmentPage from "@/pages/MyEquipment"
import MyHandoversPage from "@/pages/MyHandovers"

function AppContent() {
  const {
    token, isAuthLoading, isAdmin, currentPage,
    selectedUserId, selectedHandoverId, selectedEquipmentId, selectedDepartmentId
  } = useApp()

  if (isAuthLoading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!token) return <LoginPage />

  // Detail pages
  if (currentPage === "equipment" && selectedEquipmentId) return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto"><EquipmentDetailPage equipmentId={selectedEquipmentId} /></main>
    </div>
  )

  if (currentPage === "users" && selectedUserId) return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto"><UserDetailPage userId={selectedUserId} /></main>
    </div>
  )

  if (currentPage === "handovers" && selectedHandoverId) return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto"><HandoverDetailPage handoverId={selectedHandoverId} /></main>
    </div>
  )

  if (currentPage === "departments" && selectedDepartmentId) return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto"><DepartmentDetailPage departmentId={selectedDepartmentId} /></main>
    </div>
  )

  // RBAC: non-admin pages
  const staffPages: Record<string, ReactElement> = {
    dashboard: <Dashboard />,
    my_equipment: <MyEquipmentPage />,
    my_handovers: <MyHandoversPage />,
  }

  const adminPages: Record<string, ReactElement> = {
    dashboard: <Dashboard />,
    equipment: <EquipmentPage />,
    handovers: <HandoversPage />,
    users: <UsersPage />,
    reports: <ReportsPage />,
    departments: <DepartmentsPage />,
  }

  const pages = isAdmin ? adminPages : staffPages

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {pages[currentPage] ?? <Dashboard />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
