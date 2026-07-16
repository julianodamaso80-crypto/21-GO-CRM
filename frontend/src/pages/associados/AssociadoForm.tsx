import { useState, useEffect } from 'react'
import type { Associado, CreateAssociadoRequest } from '../../../../shared/types'
import { X } from 'lucide-react'

interface AssociadoFormProps {
  associado?: Associado | null
  onSubmit: (data: CreateAssociadoRequest) => void
  onClose: () => void
  isSubmitting?: boolean
}

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

export function AssociadoForm({
  associado,
  onSubmit,
  onClose,
  isSubmitting = false,
}: AssociadoFormProps) {
  const [formData, setFormData] = useState<CreateAssociadoRequest>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    whatsapp: '',
    cpf: '',
    rg: '',
    dateOfBirth: '',
    address: '',
    bairro: '',
    city: '',
    state: '',
    zipCode: '',
    status: 'em_adesao',
    dataAdesao: '',
    origem: undefined,
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    hinovaId: '',
    tags: [],
  })

  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (associado) {
      setFormData({
        firstName: associado.firstName || '',
        lastName: associado.lastName || '',
        email: associado.email || '',
        phone: associado.phone || '',
        whatsapp: associado.whatsapp || '',
        cpf: associado.cpf || '',
        rg: associado.rg || '',
        dateOfBirth: associado.dateOfBirth || '',
        address: associado.address || '',
        bairro: associado.bairro || '',
        city: associado.city || '',
        state: associado.state || '',
        zipCode: associado.zipCode || '',
        status: associado.status || 'em_adesao',
        dataAdesao: associado.dataAdesao || '',
        dataCancelamento: associado.dataCancelamento || '',
        motivoCancelamento: associado.motivoCancelamento || '',
        origem: associado.origem,
        utmSource: associado.utmSource || '',
        utmMedium: associado.utmMedium || '',
        utmCampaign: associado.utmCampaign || '',
        hinovaId: associado.hinovaId || '',
        tags: associado.tags || [],
      })
    }
  }, [associado])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Remove campos de texto vazios ('') antes de enviar: o backend valida
    // formatos (ex.: email) e string vazia quebra a validacao. Campos nao
    // preenchidos devem ir como ausentes, nao como ''.
    const cleaned = Object.fromEntries(
      Object.entries(formData).filter(([, value]) => value !== '' && value !== undefined),
    ) as CreateAssociadoRequest
    onSubmit(cleaned)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value || undefined }))
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData((prev) => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] }))
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags?.filter((t) => t !== tagToRemove) || [] }))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag() }
  }

  const inputClass = 'input'
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dados Pessoais */}
      <div>
        <h3 className="text-lg font-medium font-display text-white mb-4">Dados Pessoais</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome *</label>
            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange}
              className={inputClass} placeholder="Joao" required />
          </div>
          <div>
            <label className={labelClass}>Sobrenome *</label>
            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange}
              className={inputClass} placeholder="Silva" required />
          </div>
          <div>
            <label className={labelClass}>CPF</label>
            <input type="text" name="cpf" value={formData.cpf} onChange={handleChange}
              className={inputClass} placeholder="123.456.789-00" />
          </div>
          <div>
            <label className={labelClass}>RG</label>
            <input type="text" name="rg" value={formData.rg} onChange={handleChange}
              className={inputClass} placeholder="12.345.678-9" />
          </div>
          <div>
            <label className={labelClass}>Data de Nascimento</label>
            <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange}
              className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select name="status" value={formData.status || ''} onChange={handleChange} className={inputClass}>
              <option value="em_adesao">Em Adesao</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="inadimplente">Inadimplente</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contato */}
      <div>
        <h3 className="text-lg font-medium font-display text-white mb-4">Contato</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Telefone</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
              className={inputClass} placeholder="(21) 98765-4321" />
          </div>
          <div>
            <label className={labelClass}>WhatsApp</label>
            <input type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleChange}
              className={inputClass} placeholder="(21) 98765-4321" />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange}
              className={inputClass} placeholder="associado@email.com" />
          </div>
        </div>
      </div>

      {/* Endereco */}
      <div>
        <h3 className="text-lg font-medium font-display text-white mb-4">Endereco</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Endereco</label>
            <input type="text" name="address" value={formData.address} onChange={handleChange}
              className={inputClass} placeholder="Rua Exemplo, 123" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Bairro</label>
              <input type="text" name="bairro" value={formData.bairro} onChange={handleChange}
                className={inputClass} placeholder="Copacabana" />
            </div>
            <div>
              <label className={labelClass}>CEP</label>
              <input type="text" name="zipCode" value={formData.zipCode} onChange={handleChange}
                className={inputClass} placeholder="22040-020" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cidade</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange}
                className={inputClass} placeholder="Rio de Janeiro" />
            </div>
            <div>
              <label className={labelClass}>UF</label>
              <select name="state" value={formData.state || ''} onChange={handleChange} className={inputClass}>
                <option value="">Selecione</option>
                {UF_OPTIONS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Associacao */}
      <div>
        <h3 className="text-lg font-medium font-display text-white mb-4">Dados de Associacao</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Data de Adesao</label>
            <input type="date" name="dataAdesao" value={formData.dataAdesao} onChange={handleChange}
              className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ID Hinova (SGA)</label>
            <input type="text" name="hinovaId" value={formData.hinovaId} onChange={handleChange}
              className={inputClass} placeholder="HIN-12345" />
          </div>
        </div>
      </div>

      {/* Origem */}
      <div>
        <h3 className="text-lg font-medium font-display text-white mb-4">Origem / Rastreamento</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Origem</label>
            <select name="origem" value={formData.origem || ''} onChange={handleChange} className={inputClass}>
              <option value="">Selecione</option>
              <option value="google_ads">Google Ads</option>
              <option value="meta_ads">Meta Ads</option>
              <option value="instagram">Instagram</option>
              <option value="site_organico">Site Organico</option>
              <option value="indicacao">Indicacao</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="direto">Direto</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>UTM Source</label>
            <input type="text" name="utmSource" value={formData.utmSource} onChange={handleChange}
              className={inputClass} placeholder="google" />
          </div>
          <div>
            <label className={labelClass}>UTM Medium</label>
            <input type="text" name="utmMedium" value={formData.utmMedium} onChange={handleChange}
              className={inputClass} placeholder="cpc" />
          </div>
          <div>
            <label className={labelClass}>UTM Campaign</label>
            <input type="text" name="utmCampaign" value={formData.utmCampaign} onChange={handleChange}
              className={inputClass} placeholder="protecao-veicular-rj" />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div>
        <h3 className="text-lg font-medium font-display text-white mb-4">Tags</h3>
        <div className="flex gap-2">
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleKeyDown}
            className={`flex-1 ${inputClass}`} placeholder="Digite e pressione Enter" />
          <button type="button" onClick={addTag} className="btn-secondary text-sm">Adicionar</button>
        </div>
        {formData.tags && formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {formData.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gold-500/15 text-gold-400">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="ml-2 text-gold-400 hover:text-gold-300">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Botoes */}
      <div className="flex justify-end gap-3 pt-6 border-t border-dark-700/40">
        <button type="button" onClick={onClose} disabled={isSubmitting}
          className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting}
          className="btn-primary">
          {isSubmitting ? 'Salvando...' : associado ? 'Atualizar' : 'Cadastrar'}
        </button>
      </div>
    </form>
  )
}
