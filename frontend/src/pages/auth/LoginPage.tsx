import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ShieldCheck,
  Clock,
  Users,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth-store'
import { authService } from '../../services/auth.service'

/**
 * Tela de login — experiência de marca dedicada (dark navy premium).
 * Usa a paleta fixa (blue/orange/lime) de propósito: independe do tema
 * claro/escuro do app, então a entrada tem sempre a mesma identidade 21Go.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return

    setError('')
    setLoading(true)

    try {
      const response = await authService.login({ email: email.trim(), password })
      setAuth(response.user, response.token, response.refreshToken)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Email ou senha inválidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-[#070B1A] text-[#EBEEF7] font-sans">
      {/* ══════════════════════════════════════════════════
          PAINEL ESQUERDO — Marca (visível em lg+)
          ══════════════════════════════════════════════════ */}
      <aside className="relative hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between overflow-hidden p-12 xl:p-16">
        {/* Fundo: gradiente navy + glows + grid */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(155deg, #0B1024 0%, #131E44 52%, #090E20 100%)',
          }}
        />
        <div
          className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full blur-[120px]"
          style={{ background: 'rgba(41,60,130,0.55)' }}
        />
        <div
          className="absolute bottom-[-140px] right-[-80px] w-[420px] h-[420px] rounded-full blur-[130px]"
          style={{ background: 'rgba(242,145,29,0.16)' }}
        />
        {/* grid sutil */}
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(91,112,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(91,112,184,0.06) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            maskImage:
              'radial-gradient(ellipse 80% 80% at 30% 30%, black 40%, transparent 100%)',
          }}
        />
        {/* barra de acento no topo */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{
            background:
              'linear-gradient(90deg, #F2911D 0%, #F5A039 55%, #C7D301 100%)',
          }}
        />

        {/* Topo: logo */}
        <div className="relative z-10 animate-fade-in-down">
          <img
            src="/logo21go.png"
            alt="21Go! Proteção Patrimonial"
            className="h-20 w-auto object-contain"
            style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.35))' }}
          />
        </div>

        {/* Meio: headline + slogan */}
        <div className="relative z-10 max-w-md">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#F2911D]/30 bg-[#F2911D]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#F5A039]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C7D301]" />
            Plataforma CRM
          </p>
          <h1 className="font-display text-4xl xl:text-[2.7rem] font-extrabold leading-[1.1] tracking-tight text-white">
            Proteção que se
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(100deg, #F8B154, #F2911D 55%, #C7D301)',
              }}
            >
              gerencia sozinha.
            </span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-[#AEBBDE]">
            O sistema nervoso central da 21Go — associados, sinistros, operação e
            inteligência num só lugar.{' '}
            <span className="font-semibold text-[#D8E0F2]">
              Não conte com a sorte, conte com a 21Go!
            </span>
          </p>
        </div>

        {/* Base: provas de confiança */}
        <div className="relative z-10 grid grid-cols-3 gap-4 max-w-md">
          {[
            { icon: ShieldCheck, label: '20+ anos', sub: 'protegendo o RJ' },
            { icon: Clock, label: '24h', sub: 'assistência' },
            { icon: Users, label: 'Mutualismo', sub: 'todos protegem todos' },
          ].map(({ icon: Icon, label, sub }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 backdrop-blur-sm"
            >
              <Icon className="mb-2 h-5 w-5 text-[#F5A039]" strokeWidth={2} />
              <p className="text-sm font-bold text-white">{label}</p>
              <p className="text-[11px] leading-tight text-[#8FA0CF]">{sub}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════
          PAINEL DIREITO — Formulário
          ══════════════════════════════════════════════════ */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
        {/* glow ambiente (aparece no mobile, onde não há painel esquerdo) */}
        <div
          className="absolute inset-0 lg:hidden"
          style={{
            background:
              'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(41,60,130,0.35), transparent 70%)',
          }}
        />

        <div className="relative z-10 w-full max-w-[400px] animate-fade-in-up">
          {/* Logo compacto (só mobile/tablet, onde o painel de marca some) */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <img
              src="/logo21go.png"
              alt="21Go! Proteção Patrimonial"
              className="h-16 w-auto object-contain"
              style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))' }}
            />
          </div>

          {/* Cabeçalho do form */}
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">
              Bem-vindo de volta
            </h2>
            <p className="mt-1.5 text-sm text-[#8FA0CF]">
              Acesse o painel da 21Go para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="animate-fade-in rounded-xl border border-[#FB7185]/25 bg-[#FB7185]/10 px-4 py-3 text-sm font-medium text-[#FDA4AF]">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#8FA0CF]"
              >
                Email
              </label>
              <div className="group relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#5C6E9E] transition-colors group-focus-within:text-[#F5A039]" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-[#22326C] bg-[#0C1228]/70 py-3 pl-11 pr-4 text-[15px] text-white placeholder-[#4E5E8C] outline-none transition-all duration-200 focus:border-[#F2911D]/70 focus:bg-[#0C1228] focus:ring-2 focus:ring-[#F2911D]/15"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#8FA0CF]"
              >
                Senha
              </label>
              <div className="group relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#5C6E9E] transition-colors group-focus-within:text-[#F5A039]" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#22326C] bg-[#0C1228]/70 py-3 pl-11 pr-11 text-[15px] text-white placeholder-[#4E5E8C] outline-none transition-all duration-200 focus:border-[#F2911D]/70 focus:bg-[#0C1228] focus:ring-2 focus:ring-[#F2911D]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C6E9E] transition-colors hover:text-[#AEBBDE]"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3.5 text-[15px] font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
              style={{
                background: 'linear-gradient(100deg, #F2911D, #F5A039)',
                boxShadow: '0 8px 24px rgba(242,145,29,0.28)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Rodapé */}
          <div className="mt-10 flex items-center justify-center gap-2 text-[12px] text-[#5C6E9E]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#C7D301]" />
            <span>Conexão segura · 21Go Proteção Patrimonial</span>
          </div>
        </div>
      </main>
    </div>
  )
}
