import { useState } from "react"
import { User, Mail, Building2, Shield, Save, Camera } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { useApp } from "@/context/AppContext"
import { users as usersApi } from "@/lib/api"
import { useToast } from "@/components/ui/toast"

export default function ProfilePage() {
  const { user, logout } = useApp()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
  })

  if (!user) return null

  async function handleSave() {
    if (!form.name || !form.email || !user) return
    setSaving(true)
    try {
      await usersApi.update(user.id, { name: form.name, email: form.email })
      toast("Profile updated successfully", "success")
      setEditing(false)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to update profile", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Personal Information</CardTitle>
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary shrink-0">
              {user.name.charAt(0)}
              {editing && (
                <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center cursor-pointer">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold">{user.name}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Shield className="w-3.5 h-3.5" />
                {user.role}
                {user.is_admin && (
                  <span className="ml-1.5 text-[10px] font-semibold bg-primary/20 text-primary px-1.5 py-0.5 rounded">ADMIN</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              {editing ? (
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              ) : (
                <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{user.name}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              {editing ? (
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              ) : (
                <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{user.email}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{user.department ?? "—"}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2 capitalize">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span>{user.role}</span>
              </div>
            </div>
          </div>

          {editing && (
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-1.5" />{saving ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => { setEditing(false); setForm({ name: user.name, email: user.email }) }}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Session</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Signed in since this session. Click below to sign out.
          </div>
          <Button variant="destructive" size="sm" onClick={logout}>Sign Out</Button>
        </CardContent>
      </Card>
    </div>
  )
}
