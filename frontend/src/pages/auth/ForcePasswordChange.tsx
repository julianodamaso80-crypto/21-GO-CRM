import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../store/auth-store'
import { authService } from '../../services/auth.service'

/**
 * Tela de troca obrigatoria: aparece quando o usuario loga pela 1a vez com a
 * senha temporaria criada pelo admin (user.mustChangePassword === true).
 * So libera o app depois de definir uma senha propria.
 */
export function ForcePasswordChange() {
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)

  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) return setError('A senha precisa ter ao menos 6 caracteres')
    if (newPassword !== confirm) return setError('As senhas nao conferem')

    setLoading(true)
    try {
      await authService.changePassword({ newPassword })
      updateUser({ mustChangePassword: false })
      toast.success('Senha definida! Bem-vindo(a) ao 21Go CRM')
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Nao foi possivel alterar a senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-sm w-full relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-blue flex items-center justify-center shadow-glow-blue">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">Crie sua senha</h1>
          <p className="text-sm text-gray-400 mt-2">
            {me?.firstName ? `Ola, ${me.firstName}! ` : ''}Por seguranca, defina uma senha pessoal pra continuar.
          </p>
        </div>

        <div className="card-glass p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 text-sm text-red-400 bg-red-500/10 rounded-xl border border-red-500/20 animate-fade-in">
                {error}
              </div>
            )}

            <div>
              <label className="label">Nova senha</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="Minimo 6 caracteres"
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirmar senha</label>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Repita a senha"
                className="input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? 'Salvando...' : 'Definir senha e entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
