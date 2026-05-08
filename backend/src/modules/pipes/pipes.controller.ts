import { FastifyRequest, FastifyReply } from 'fastify'
import { PipesService } from './pipes.service'
import { AppError } from '../../utils/app-error'

const pipesService = new PipesService()

export class PipesController {
  // === Pipes ===

  async listPipes(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const pipes = await pipesService.listPipes(user.companyId)
    return reply.send(pipes)
  }

  async getPipe(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { pipeId } = request.params as { pipeId: string }
    const pipe = await pipesService.getPipeById(pipeId, user.companyId)
    return reply.send(pipe)
  }

  async createPipe(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const data = request.body as { name: string; description?: string; icon?: string; color?: string; tags?: string[] }
    if (!data.name?.trim()) throw new AppError('name obrigatorio', 400, 'BAD_REQUEST')
    const pipe = await pipesService.createPipe(user.companyId, data)
    return reply.status(201).send(pipe)
  }

  async createPipeFromSuggest(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const data = request.body as any
    if (!data.pipeName?.trim()) throw new AppError('pipeName obrigatorio', 400, 'BAD_REQUEST')
    if (!Array.isArray(data.phases) || data.phases.length < 2) throw new AppError('Minimo 2 fases', 400, 'BAD_REQUEST')

    const pipe = await pipesService.createPipeFromSuggest(user.companyId, data)
    return reply.status(201).send(pipe)
  }

  async deletePipe(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { pipeId } = request.params as { pipeId: string }
    const result = await pipesService.deletePipe(pipeId, user.companyId)
    return reply.send(result)
  }

  // === Phases ===

  async createPhase(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { pipeId } = request.params as { pipeId: string }
    const data = request.body as any
    if (!data.name?.trim()) throw new AppError('name obrigatorio', 400, 'BAD_REQUEST')
    const phase = await pipesService.createPhase(pipeId, user.companyId, data)
    return reply.status(201).send(phase)
  }

  // === Field Definitions ===

  async createFieldDefinition(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { pipeId } = request.params as { pipeId: string }
    const data = request.body as any
    if (!data.name?.trim()) throw new AppError('name obrigatorio', 400, 'BAD_REQUEST')
    if (!data.label?.trim()) throw new AppError('label obrigatorio', 400, 'BAD_REQUEST')
    if (!data.type) throw new AppError('type obrigatorio', 400, 'BAD_REQUEST')
    const field = await pipesService.createFieldDefinition(pipeId, user.companyId, data)
    return reply.status(201).send(field)
  }

  // === Cards ===

  async listCards(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { pipeId } = request.params as { pipeId: string }
    const query = request.query as any
    const result = await pipesService.listCards(pipeId, user.companyId, {
      phaseId: query.phaseId,
      q: query.q,
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      status: query.status,
    })
    return reply.send(result)
  }

  async getKanbanData(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { pipeId } = request.params as { pipeId: string }
    const data = await pipesService.getKanbanData(pipeId, user.companyId)
    return reply.send(data)
  }

  async getCard(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { cardId } = request.params as { cardId: string }
    const card = await pipesService.getCardById(cardId, user.companyId)
    return reply.send(card)
  }

  async createCard(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { pipeId } = request.params as { pipeId: string }
    const data = request.body as any
    if (!data.title?.trim()) throw new AppError('title obrigatorio', 400, 'BAD_REQUEST')
    const card = await pipesService.createCard(pipeId, user.companyId, user.id, data)
    return reply.status(201).send(card)
  }

  async updateCard(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { cardId } = request.params as { cardId: string }
    const data = request.body as any
    const card = await pipesService.updateCard(cardId, user.companyId, data)
    return reply.send(card)
  }

  async deleteCard(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { cardId } = request.params as { cardId: string }
    const result = await pipesService.deleteCard(cardId, user.companyId)
    return reply.send(result)
  }

  async moveCard(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { cardId } = request.params as { cardId: string }
    const { phaseId } = request.body as { phaseId: string }
    if (!phaseId) throw new AppError('phaseId obrigatorio', 400, 'BAD_REQUEST')
    const card = await pipesService.moveCard(cardId, user.companyId, phaseId, user.id)
    return reply.send(card)
  }

  async transferCard(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { cardId } = request.params as { cardId: string }
    const { targetPipeId, targetPhaseId } = request.body as { targetPipeId: string; targetPhaseId?: string }
    if (!targetPipeId) throw new AppError('targetPipeId obrigatorio', 400, 'BAD_REQUEST')
    const card = await pipesService.transferCard(cardId, user.companyId, targetPipeId, targetPhaseId, user.id)
    return reply.send(card)
  }

  async updateCardFields(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { cardId } = request.params as { cardId: string }
    const { fields } = request.body as { fields: Array<{ fieldDefinitionId: string; value: any }> }
    if (!fields?.length) throw new AppError('fields obrigatorio', 400, 'BAD_REQUEST')
    const result = await pipesService.updateCardFields(cardId, user.companyId, user.id, fields)
    return reply.send(result)
  }

  async addAttachment(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { cardId } = request.params as { cardId: string }
    const data = request.body as any
    if (!data.fileName || !data.storageUrl) throw new AppError('fileName e storageUrl obrigatorios', 400, 'BAD_REQUEST')
    const attachment = await pipesService.addAttachment(cardId, user.companyId, user.id, data)
    return reply.status(201).send(attachment)
  }
}
