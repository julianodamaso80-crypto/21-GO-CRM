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
 * IMPORTANTE: usa cores FIXAS arbitrárias (text-[#...]) de propósito.
 * As classes utilitárias `text-white`/`text-gray-*` são invertidas pelo
 * CSS global no tema claro (default do app) — usá-las aqui deixaria o
 * texto ilegível. Cores arbitrárias não sofrem esse override.
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

  const inputStyle = { backgroundColor: '#111A38' }

  return (
    <div
      className="min-h-screen w-full flex font-sans"
      style={{
        background:
          'linear-gradient(120deg, #0D1430 0%, #0A1028 58%, #0C1226 100%)',
      }}
    >
      {/* ══════════════════════════════════════════════════
          PAINEL ESQUERDO — Marca (visível em lg+)
          ══════════════════════════════════════════════════ */}
      <aside className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden border-r border-white/[0.06] p-12 xl:p-16">
        {/* overlay: gradiente navy mais rico + glows */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(160deg, rgba(26,38,86,0.65) 0%, rgba(11,17,40,0.15) 55%, rgba(9,13,30,0.4) 100%)',
          }}
        />
        <div
          className="absolute -top-28 -left-20 h-[520px] w-[520px] rounded-full blur-[130px]"
          style={{ background: 'rgba(41,60,130,0.5)' }}
        />
        <div
          className="absolute bottom-[-160px] right-[-60px] h-[420px] w-[420px] rounded-full blur-[140px]"
          style={{ background: 'rgba(242,145,29,0.15)' }}
        />
        {/* grid sutil */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(rgba(120,140,210,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(120,140,210,0.06) 1px, transparent 1px)',
            backgroundSize: '54px 54px',
            maskImage:
              'radial-gradient(ellipse 75% 75% at 35% 40%, black 35%, transparent 100%)',
          }}
        />
        {/* barra de acento no topo */}
        <div
          className="absolute inset-x-0 top-0 h-1.5"
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
            className="h-[72px] w-auto object-contain"
            style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))' }}
          />
        </div>

        {/* Meio: headline + slogan */}
        <div className="relative z-10 max-w-md">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#F2911D]/30 bg-[#F2911D]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#F7B15C]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C7D301]" />
            Plataforma CRM
          </p>
          <h1 className="font-display text-[2.6rem] xl:text-[3rem] font-extrabold leading-[1.08] tracking-tight text-[#F4F7FF]">
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
          <p className="mt-6 text-[15px] leading-relaxed text-[#B7C2E4]">
            O sistema nervoso central da 21Go — associados, sinistros, operação e
            inteligência num só lugar.{' '}
            <span className="font-semibold text-[#E4EAFA]">
              Não conte com a sorte, conte com a 21Go!
            </span>
          </p>
        </div>

        {/* Base: provas de confiança */}
        <div className="relative z-10 grid max-w-lg grid-cols-3 gap-4">
          {[
            { icon: ShieldCheck, label: '20+ anos', sub: 'protegendo o RJ' },
            { icon: Clock, label: '24h', sub: 'assistência' },
            { icon: Users, label: 'Mutualismo', sub: 'todos protegem' },
          ].map(({ icon: Icon, label, sub }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-4 backdrop-blur-sm"
            >
              <Icon className="mb-2.5 h-5 w-5 text-[#F7B15C]" strokeWidth={2} />
              <p className="text-[15px] font-bold leading-none text-[#F4F7FF]">
                {label}
              </p>
              <p className="mt-1.5 text-[12px] leading-tight text-[#9AA9D4]">
                {sub}
              </p>
            </div>
          ))}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════
          PAINEL DIREITO — Formulário
          ══════════════════════════════════════════════════ */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-10 sm:px-10">
        {/* glow ambiente sutil */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 8%, rgba(41,60,130,0.28), transparent 65%)',
          }}
        />

        <div className="relative z-10 w-full max-w-[380px] animate-fade-in-up">
          {/* Logo compacto (só quando o painel de marca some) */}
          <div className="mb-9 flex justify-center lg:hidden">
            <img
              src="/logo21go.png"
              alt="21Go! Proteção Patrimonial"
              className="h-16 w-auto object-contain"
              style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.45))' }}
            />
          </div>

          {/* Cabeçalho do form */}
          <div className="mb-8">
            <h2 className="font-display text-[26px] font-bold tracking-tight text-[#F4F7FF]">
              Bem-vindo de volta
            </h2>
            <p className="mt-2 text-[14px] text-[#9AA9D4]">
              Acesse o painel da 21Go para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="animate-fade-in rounded-xl border border-[#FB7185]/30 bg-[#FB7185]/12 px-4 py-3 text-[14px] font-medium text-[#FDA4AF]">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#8B9AC6]"
              >
                Email
              </label>
              <div className="group relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#63739F] transition-colors group-focus-within:text-[#F5A039]" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="seu@email.com"
                  style={inputStyle}
                  className="w-full rounded-xl border border-[#2A3B6C] py-3 pl-11 pr-4 text-[15px] text-[#F4F7FF] placeholder-[#5B6B96] outline-none transition-all duration-200 focus:border-[#F2911D]/70 focus:ring-2 focus:ring-[#F2911D]/18"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#8B9AC6]"
              >
                Senha
              </label>
              <div className="group relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#63739F] transition-colors group-focus-within:text-[#F5A039]" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={inputStyle}
                  className="w-full rounded-xl border border-[#2A3B6C] py-3 pl-11 pr-11 text-[15px] text-[#F4F7FF] placeholder-[#5B6B96] outline-none transition-all duration-200 focus:border-[#F2911D]/70 focus:ring-2 focus:ring-[#F2911D]/18"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#63739F] transition-colors hover:text-[#B7C2E4]"
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
              className="group relative mt-1 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3.5 text-[15px] font-bold text-[#FFFFFF] transition-all duration-200 hover:brightness-[1.08] active:scale-[0.99] disabled:opacity-60"
              style={{
                background: 'linear-gradient(100deg, #F2911D, #F5A039)',
                boxShadow: '0 10px 28px rgba(242,145,29,0.32)',
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
          <div className="mt-10 flex items-center justify-center gap-2 text-[12px] text-[#63739F]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#C7D301]" />
            <span>Conexão segura · 21Go Proteção Patrimonial</span>
          </div>
        </div>
      </main>
    </div>
  )
}
