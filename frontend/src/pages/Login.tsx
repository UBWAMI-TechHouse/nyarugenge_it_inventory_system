import { useState } from "react"
import { Package, Mail, ArrowLeft, CheckCircle } from "lucide-react"
import { Input, Label } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { useApp } from "@/context/AppContext"
import { auth as authApi } from "@/lib/api"

type View = "login" | "forgot" | "sent"

export default function LoginPage() {
  const { login } = useApp()
  const [view, setView] = useState<View>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [resetEmail, setResetEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login(email, password)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await authApi.forgotPassword(resetEmail)
      setView("sent")
    } catch {
      // Still show sent to prevent email enumeration
      setView("sent")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Package className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold text-foreground">IT Inventory</div>
            <div className="text-xs text-muted-foreground">Management System</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm p-6">
          {view === "login" && (
            <>
              <h1 className="text-xl font-semibold mb-1">Sign in</h1>
              <p className="text-sm text-muted-foreground mb-5">Enter your credentials to continue</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Password</Label>
                    <button type="button" onClick={() => { setView("forgot"); setError("") }}
                      className="text-xs text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <Input type="password" placeholder="••••••" value={password}
                    onChange={e => setPassword(e.target.value)} required />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </>
          )}

          {view === "forgot" && (
            <>
              <button onClick={() => { setView("login"); setError("") }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </button>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl font-semibold mb-1">Reset password</h1>
              <p className="text-sm text-muted-foreground mb-5">
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Email address</Label>
                  <Input type="email" placeholder="you@example.com" value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)} required />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}

          {view === "sent" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-success" />
              </div>
              <h1 className="text-xl font-semibold mb-2">Check your email</h1>
              <p className="text-sm text-muted-foreground mb-6">
                If <strong>{resetEmail}</strong> is registered, you'll receive a password reset link shortly.
              </p>
              <Button variant="outline" className="w-full" onClick={() => { setView("login"); setResetEmail("") }}>
                Back to login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
