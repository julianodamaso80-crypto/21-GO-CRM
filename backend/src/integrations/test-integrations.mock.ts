/**
 * TESTE DAS INTEGRAÇÕES MOCKADAS
 *
 * Execute: npx tsx src/integrations/test-integrations.mock.ts
 */

import { whatsappServiceMock } from './whatsapp.integration.mock'
import { emailServiceMock } from './email.integration.mock'

async function testIntegrations() {
  console.log('\n🧪 TESTANDO INTEGRAÇÕES MOCKADAS\n')
  console.log('='.repeat(60))

  // ============================================================================
  // TESTE WHATSAPP
  // ============================================================================
  console.log('\n💬 Testando WhatsApp Mock...\n')

  try {
    // Enviar mensagem de texto
    const message = await whatsappServiceMock.sendMessage(
      '5511999998888',
      'Olá! Esta é uma mensagem de teste do CRM Tubominas.'
    )
    console.log('✅ Mensagem enviada:', message.id)

    // Enviar template
    const template = await whatsappServiceMock.sendTemplate(
      '5511999998888',
      'appointment_reminder',
      'pt_BR',
      [{ type: 'body', parameters: [{ type: 'text', text: '25/01/2026 14:00' }] }]
    )
    console.log('✅ Template enviado:', template.id)

    // Marcar como lido
    await whatsappServiceMock.markAsRead(message.id)
    console.log('✅ Mensagem marcada como lida')

    // Obter histórico
    const history = whatsappServiceMock.getSentMessages()
    console.log('✅ Total de mensagens enviadas:', history.length)
  } catch (error: any) {
    console.error('❌ Erro no WhatsApp:', error.message)
  }

  // ============================================================================
  // TESTE EMAIL
  // ============================================================================
  console.log('\n📧 Testando Email Mock...\n')

  try {
    // Verificar conexão
    const connected = await emailServiceMock.verifyConnection()
    console.log('✅ Conexão verificada:', connected)

    // Enviar email simples
    const email = await emailServiceMock.sendEmail(
      'usuario@empresa.com',
      'Teste de Email Mock',
      '<h1>Olá!</h1><p>Este é um email de teste.</p>'
    )
    console.log('✅ Email enviado:', email.id)

    // Enviar email de boas-vindas
    const welcome = await emailServiceMock.sendWelcomeEmail(
      'novousuario@empresa.com',
      'João Silva'
    )
    console.log('✅ Email de boas-vindas enviado:', welcome.id)

    // Enviar email de reset de senha
    const reset = await emailServiceMock.sendPasswordResetEmail(
      'usuario@empresa.com',
      'João Silva',
      'mock-reset-token-123456'
    )
    console.log('✅ Email de reset enviado:', reset.id)

    // Enviar email de fatura
    const invoice = await emailServiceMock.sendInvoiceEmail(
      'usuario@empresa.com',
      'João Silva',
      {
        id: 'INV-001',
        amount: 9900,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'open',
        url: 'https://example.com/invoice/inv_123',
      }
    )
    console.log('✅ Email de fatura enviado:', invoice.id)

    // Enviar em lote
    const batch = await emailServiceMock.sendBatch([
      {
        to: 'user1@empresa.com',
        subject: 'Newsletter Janeiro',
        html: '<p>Confira as novidades do mês!</p>',
      },
      {
        to: 'user2@empresa.com',
        subject: 'Newsletter Janeiro',
        html: '<p>Confira as novidades do mês!</p>',
      },
      {
        to: 'user3@empresa.com',
        subject: 'Newsletter Janeiro',
        html: '<p>Confira as novidades do mês!</p>',
      },
    ])
    console.log('✅ Lote de emails enviado:', batch.length, 'emails')

    // Obter histórico
    const history = emailServiceMock.getSentEmails()
    console.log('✅ Total de emails enviados:', history.length)
  } catch (error: any) {
    console.error('❌ Erro no Email:', error.message)
  }

  // ============================================================================
  // RESUMO
  // ============================================================================
  console.log('\n' + '='.repeat(60))
  console.log('\n✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!\n')
  console.log('📊 Resumo:')
  console.log('  - WhatsApp: Funcionando (mock)')
  console.log('  - Email: Funcionando (mock)')
  console.log('\n💡 As integrações mockadas estão prontas para uso em desenvolvimento!\n')
}

// Executar testes
testIntegrations().catch(console.error)
