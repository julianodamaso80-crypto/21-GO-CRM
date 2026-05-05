import { FastifyRequest, FastifyReply } from 'fastify'
import { TasksService, type CreateTaskDTO, type UpdateTaskDTO, type ListTasksQuery } from './tasks.service'

const tasksService = new TasksService()

export class TasksController {
  /** GET /tasks */
  async list(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const result = await tasksService.list(
      user.companyId,
      user.id,
      user.role,
      request.query as ListTasksQuery,
    )
    return reply.send(result)
  }

  /** GET /tasks/:id */
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    const task = await tasksService.getById(id, user.companyId, user.id, user.role)
    return reply.send(task)
  }

  /** POST /tasks */
  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const task = await tasksService.create(user.companyId, user.id, request.body as CreateTaskDTO)
    return reply.status(201).send(task)
  }

  /** PATCH /tasks/:id  e  PUT /tasks/:id */
  async update(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    const task = await tasksService.update(id, user.companyId, user.id, user.role, request.body as UpdateTaskDTO)
    return reply.send(task)
  }

  /** DELETE /tasks/:id */
  async delete(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    await tasksService.delete(id, user.companyId, user.id, user.role)
    return reply.status(204).send()
  }

  /** GET /leads/:leadId/tasks (montado em leads.routes alternativamente) */
  async listByLead(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { leadId } = request.params as { leadId: string }
    const result = await tasksService.listByLead(leadId, user.companyId)
    return reply.send(result)
  }

  /** POST /leads/:leadId/tasks */
  async createForLead(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { leadId } = request.params as { leadId: string }
    const body = request.body as Omit<CreateTaskDTO, 'leadId'>
    const task = await tasksService.create(user.companyId, user.id, { ...body, leadId })
    return reply.status(201).send(task)
  }
}
