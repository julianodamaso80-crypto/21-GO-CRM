import { useEffect, useState } from 'react'
import { X, Loader2, Eye, EyeOff, ShieldAlert, Shield } from 'lucide-react'
import type { TeamMember, TeamRole, CreateTeamMemberRequest, UpdateTeamMemberRequest } from '../../services/users.service'

// Papeis ativos no sistema (definido pelo cliente): apenas Admin e Vendedor.
const ROLE_OPTIONS: Array<{ value: TeamRole; label: string; description: string; icon: any; color: string }> = [
  { value: 'admin', label: 'Administrador', description: 'Ve tudo da empresa + gestao de usuarios', icon: ShieldAlert, color: 'text-red-400' },
  { value: 'vendedor', label: 'Vendedor', description: 'Ve apenas os seus leads, associados e funil', icon: Shield, color: 'text-blue-400' },
]

interface Props {
  isOpen: boolean
  member: TeamMember | null
  onClose: () => void
  onSubmit: (data: CreateTeamMemberRequest | UpdateTeamMemberRequest) => Promise<void> | void
  isSubmitting?: boolean
}

export function TeamMemberDrawer({ isOpen, member, onClose, onSubmit, isSubmitting = false }: Props) {
  const isEdit = !!member

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<TeamRole>('vendedor')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (member) {
      setFirstName(member.firstName)
      setLastName(member.lastName)
      setEmail(member.email)
      setPhone(member.phone || '')
      setRole(member.role)
      setPassword('')
    } else {
      setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setRole('vendedor'); setPassword('')
    }
  }, [member, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) {
      const update: UpdateTeamMemberRequest = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
        role,
      }
      if (password.trim()) update.password = password.trim()
      await onSubmit(update)
    } else {
      await onSubmit({
        email: email.trim().toLowerCase(),
        password: password.trim() || undefined, // vazio = backend gera senha temporaria
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        role,
      })
    }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700/40">
          <h2 className="text-xl font-semibold font-display text-white">
            {isEdit ? 'Editar membro' : 'Adicionar novo membro'}
          </h2>
          <button onClick={onClose} disabled={isSubmitting} className="text-gray-500 hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nome *</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="input" />
            </div>
            <div>
              <label className="label">Sobrenome *</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="input" />
            </div>
          </div>

          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isEdit}
              className="input disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {isEdit && <p className="text-xs text-gray-500 mt-1">O email nao pode ser alterado depois de criado.</p>}
          </div>

          <div>
            <label className="label">Telefone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(21) 99999-9999"
              className="input"
            />
          </div>

          <div>
            <label className="label">{isEdit ? 'Nova senha (deixar vazio pra manter)' : 'Senha (opcional)'}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                placeholder={isEdit ? 'Manter atual' : 'Deixe vazio pra gerar automatica'}
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {!isEdit && <p className="text-xs text-gray-500 mt-1">Deixe vazio: o sistema gera uma senha temporaria e mostra a URL + login + senha pra voce enviar. No 1o login a pessoa cria a senha dela.</p>}
          </div>

          <div>
            <label className="label">Nivel de acesso *</label>
            <div className="grid grid-cols-1 gap-2 mt-1">
              {ROLE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const selected = role === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      selected
                        ? 'border-gold-500/40 bg-gold-500/5 ring-1 ring-gold-500/20'
                        : 'border-dark-700/40 hover:border-dark-600 hover:bg-dark-800/30'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${opt.color} flex-shrink-0 mt-0.5`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${selected ? 'text-white' : 'text-gray-300'}`}>{opt.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                    </div>
                    {selected && <div className="w-2 h-2 rounded-full bg-gold-400 mt-2 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Salvar alteracoes' : 'Adicionar membro'}
            </button>
            <button type="button" onClick={onClose} disabled={isSubmitting} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
