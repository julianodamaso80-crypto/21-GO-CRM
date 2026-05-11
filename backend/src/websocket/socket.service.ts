import { FastifyInstance } from 'fastify'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { verify } from 'jsonwebtoken'
import { logger } from '../utils/logger'
import { AppError } from '../utils/app-error'
import { env } from '../config/env'
import {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
  SocketRooms,
  JoinRoomPayload,
  LeaveRoomPayload,
  TypingPayload,
  MessageReadPayload,
  RoomResponse,
} from './socket.types'

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
type TypedSocketServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>

class SocketService {
  private io: TypedSocketServer | null = null

  /**
   * Inicializa o Socket.io com o servidor Fastify
   */
  async initialize(fastify: FastifyInstance): Promise<void> {
    try {
      // Criar instância do Socket.io anexada ao servidor Fastify
      this.io = new SocketIOServer(fastify.server, {
        cors: {
          origin: env.CORS_ORIGIN,
          credentials: true,
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
      })

      // Middleware de autenticação JWT
      this.io.use(this.authenticateSocket.bind(this))

      // Event handlers
      this.io.on('connection', this.handleConnection.bind(this))

      logger.info('Socket.io initialized successfully')
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Socket.io')
      throw AppError.internal('Failed to initialize WebSocket server')
    }
  }

  /**
   * Middleware de autenticação via JWT no handshake
   */
  private async authenticateSocket(
    socket: TypedSocket,
    next: (err?: Error) => void
  ): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1]

      if (!token) {
        logger.warn({ socketId: socket.id }, 'Socket connection without token')
        return next(new Error('Authentication token required'))
      }

      // Verificar JWT
      const decoded = verify(token, env.JWT_SECRET) as {
        id: string
        email: string
        companyId: string
        roleId: string
      }

      // Anexar dados do usuário ao socket
      socket.data.userId = decoded.id
      socket.data.companyId = decoded.companyId
      socket.data.email = decoded.email
      socket.data.roleId = decoded.roleId

      logger.info(
        {
          socketId: socket.id,
          userId: decoded.id,
          companyId: decoded.companyId,
        },
        'Socket authenticated successfully'
      )

      next()
    } catch (error) {
      logger.error({ error, socketId: socket.id }, 'Socket authentication failed')
      next(new Error('Invalid authentication token'))
    }
  }

  /**
   * Handle de conexão de novo socket
   */
  private handleConnection(socket: TypedSocket): void {
    const { userId, companyId, email } = socket.data

    logger.info(
      {
        socketId: socket.id,
        userId,
        companyId,
        email,
      },
      'New socket connection'
    )

    // Automaticamente entrar nas rooms do usuário e da empresa
    socket.join(SocketRooms.user(userId))
    socket.join(SocketRooms.company(companyId))
    socket.join(SocketRooms.dashboard(companyId))
    socket.join(SocketRooms.inbox(companyId))
    socket.join(SocketRooms.appointments(companyId))

    // Notificar outros usuários da empresa que este usuário está online
    socket.to(SocketRooms.company(companyId)).emit('user:online', {
      userId,
      firstName: '',
      lastName: '',
      timestamp: new Date().toISOString(),
    })

    // Event listeners
    socket.on('join_room', (data, callback) => this.handleJoinRoom(socket, data, callback))
    socket.on('leave_room', (data, callback) => this.handleLeaveRoom(socket, data, callback))
    socket.on('typing', (data) => this.handleTyping(socket, data))
    socket.on('stop_typing', (data) => this.handleStopTyping(socket, data))
    socket.on('message_read', (data) => this.handleMessageRead(socket, data))
    socket.on('disconnect', () => this.handleDisconnect(socket))

    // [TRACE-WA] Log estruturado de conexao com transport efetivo e rooms autojoin
    console.log(
      '[SOCKET_CONNECTED] ' +
        JSON.stringify({
          tag: 'SOCKET_CONNECTED',
          socketId: socket.id,
          userId,
          companyId,
          transport: (socket.conn && (socket.conn as any).transport?.name) || 'unknown',
          roomsJoined: Array.from(socket.rooms).filter((r) => r !== socket.id),
          connectedAt: new Date().toISOString(),
        }),
    )

    logger.info(
      {
        socketId: socket.id,
        userId,
        rooms: Array.from(socket.rooms),
      },
      'Socket joined initial rooms'
    )
  }

  /**
   * Handle de join_room event
   */
  private handleJoinRoom(
    socket: TypedSocket,
    data: JoinRoomPayload | string,
    callback?: (response: RoomResponse) => void
  ): void {
    try {
      // Frontend pode mandar { room, metadata } ou só a string do nome.
      // Aceitar ambos pra não quebrar real-time (ver SocketContext.tsx).
      const room = typeof data === 'string' ? data : data?.room
      const metadata = typeof data === 'string' ? undefined : data?.metadata
      if (!room || typeof room !== 'string') {
        callback?.({ success: false, room: '', error: 'room name required' })
        return
      }
      const { companyId, userId } = socket.data

      // Cross-tenant guard (Projeto Japão Fase 5):
      // rooms tenant-scoped (`company:*`, `inbox:*`, `dashboard:*`, `appointments:*`)
      // só podem ser joinadas pra o próprio companyId.
      const tenantPrefixes = ['company:', 'inbox:', 'dashboard:', 'appointments:']
      const matchedPrefix = tenantPrefixes.find((p) => room.startsWith(p))
      if (matchedPrefix) {
        const targetCompany = room.slice(matchedPrefix.length)
        if (targetCompany !== companyId) {
          logger.warn(
            { socketId: socket.id, userId, requested: room, actualCompany: companyId },
            '[JAPAO][socket] tentativa de join cross-tenant bloqueada'
          )
          // [TRACE-WA] Log estruturado de join (rejeitado cross-tenant)
          console.log(
            '[SOCKET_JOIN_ROOM] ' +
              JSON.stringify({
                tag: 'SOCKET_JOIN_ROOM',
                socketId: socket.id,
                userId,
                companyId,
                requestedRoom: room,
                accepted: false,
                reason: 'cross_tenant_denied',
                targetCompany,
              }),
          )
          callback?.({
            success: false,
            room,
            error: 'cross-tenant join denied',
          })
          return
        }
      }
      // Rooms `user:*` só podem ser joinadas pra próprio userId
      if (room.startsWith('user:')) {
        const targetUser = room.slice('user:'.length)
        if (targetUser !== userId) {
          logger.warn(
            { socketId: socket.id, userId, requested: room },
            '[JAPAO][socket] tentativa de join em room de outro user bloqueada'
          )
          // [TRACE-WA] Log estruturado de join (rejeitado user mismatch)
          console.log(
            '[SOCKET_JOIN_ROOM] ' +
              JSON.stringify({
                tag: 'SOCKET_JOIN_ROOM',
                socketId: socket.id,
                userId,
                companyId,
                requestedRoom: room,
                accepted: false,
                reason: 'user_room_mismatch',
                targetUser,
              }),
          )
          callback?.({
            success: false,
            room,
            error: 'user room mismatch',
          })
          return
        }
      }

      socket.join(room)

      logger.info(
        {
          socketId: socket.id,
          userId,
          room,
          metadata,
        },
        'Socket joined room'
      )

      // [TRACE-WA] Log estruturado de join (sucesso)
      console.log(
        '[SOCKET_JOIN_ROOM] ' +
          JSON.stringify({
            tag: 'SOCKET_JOIN_ROOM',
            socketId: socket.id,
            userId,
            companyId,
            requestedRoom: room,
            accepted: true,
            reason: 'ok',
            currentRooms: Array.from(socket.rooms).filter((r) => r !== socket.id),
          }),
      )

      callback?.({
        success: true,
        room,
        message: `Joined room: ${room}`,
      })
    } catch (error) {
      const room = typeof data === 'string' ? data : data?.room
      logger.error({ error, socketId: socket.id, room }, 'Failed to join room')
      // [TRACE-WA] Log estruturado de join (falha por exception)
      console.log(
        '[SOCKET_JOIN_ROOM] ' +
          JSON.stringify({
            tag: 'SOCKET_JOIN_ROOM',
            socketId: socket.id,
            userId: socket.data?.userId,
            companyId: socket.data?.companyId,
            requestedRoom: room || '',
            accepted: false,
            reason: 'exception',
          }),
      )
      callback?.({
        success: false,
        room: room || '',
        error: 'Failed to join room',
      })
    }
  }

  /**
   * Handle de leave_room event
   */
  private handleLeaveRoom(
    socket: TypedSocket,
    data: LeaveRoomPayload | string,
    callback?: (response: RoomResponse) => void
  ): void {
    try {
      // Mesmo tratamento do handleJoinRoom: aceitar string ou { room }
      const room = typeof data === 'string' ? data : data?.room
      if (!room || typeof room !== 'string') {
        callback?.({ success: false, room: '', error: 'room name required' })
        return
      }

      socket.leave(room)

      logger.info(
        {
          socketId: socket.id,
          userId: socket.data.userId,
          room,
        },
        'Socket left room'
      )

      callback?.({
        success: true,
        room,
        message: `Left room: ${room}`,
      })
    } catch (error) {
      const room = typeof data === 'string' ? data : data?.room
      logger.error({ error, socketId: socket.id, room }, 'Failed to leave room')
      callback?.({
        success: false,
        room: room || '',
        error: 'Failed to leave room',
      })
    }
  }

  /**
   * Handle de typing event
   */
  private handleTyping(socket: TypedSocket, data: TypingPayload): void {
    try {
      const { conversationId } = data
      const { userId } = socket.data

      // Emitir para todos na conversation room, exceto o sender
      socket.to(SocketRooms.conversation(conversationId)).emit('inbox:typing', {
        conversationId,
        user: {
          id: userId,
          firstName: '',
          lastName: '',
        },
        isTyping: true,
      })

      logger.debug(
        {
          userId,
          conversationId,
        },
        'User typing in conversation'
      )
    } catch (error) {
      logger.error({ error, userId: socket.data.userId }, 'Failed to handle typing event')
    }
  }

  /**
   * Handle de stop_typing event
   */
  private handleStopTyping(socket: TypedSocket, data: TypingPayload): void {
    try {
      const { conversationId } = data
      const { userId } = socket.data

      socket.to(SocketRooms.conversation(conversationId)).emit('inbox:typing', {
        conversationId,
        user: {
          id: userId,
          firstName: '',
          lastName: '',
        },
        isTyping: false,
      })

      logger.debug(
        {
          userId,
          conversationId,
        },
        'User stopped typing in conversation'
      )
    } catch (error) {
      logger.error({ error, userId: socket.data.userId }, 'Failed to handle stop_typing event')
    }
  }

  /**
   * Handle de message_read event
   */
  private handleMessageRead(socket: TypedSocket, data: MessageReadPayload): void {
    try {
      const { conversationId, messageId } = data
      const { userId } = socket.data

      socket.to(SocketRooms.conversation(conversationId)).emit('inbox:message_read', {
        conversationId,
        messageId,
        readBy: {
          id: userId,
          firstName: '',
          lastName: '',
        },
        readAt: new Date().toISOString(),
      })

      logger.debug(
        {
          userId,
          conversationId,
          messageId,
        },
        'Message marked as read'
      )
    } catch (error) {
      logger.error({ error, userId: socket.data.userId }, 'Failed to handle message_read event')
    }
  }

  /**
   * Handle de disconnect event
   */
  private handleDisconnect(socket: TypedSocket): void {
    const { userId, companyId } = socket.data

    // Notificar outros usuários da empresa que este usuário está offline
    socket.to(SocketRooms.company(companyId)).emit('user:offline', {
      userId,
      firstName: '',
      lastName: '',
      timestamp: new Date().toISOString(),
    })

    logger.info(
      {
        socketId: socket.id,
        userId,
        companyId,
      },
      'Socket disconnected'
    )
  }

  // ============================================================================
  // MÉTODOS PÚBLICOS PARA EMITIR EVENTOS
  // ============================================================================

  /**
   * Emitir evento para todos os usuários de uma empresa
   */
  emitToCompany(companyId: string, event: keyof ServerToClientEvents, data: any): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized')
      return
    }

    this.io.to(SocketRooms.company(companyId)).emit(event as any, data)

    logger.debug(
      {
        companyId,
        event,
      },
      'Event emitted to company'
    )
  }

  /**
   * Emitir evento para um usuário específico
   */
  emitToUser(userId: string, event: keyof ServerToClientEvents, data: any): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized')
      return
    }

    this.io.to(SocketRooms.user(userId)).emit(event as any, data)

    logger.debug(
      {
        userId,
        event,
      },
      'Event emitted to user'
    )
  }

  /**
   * Emitir evento para uma room específica
   */
  emitToRoom(room: string, event: keyof ServerToClientEvents, data: any): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized')
      return
    }

    this.io.to(room).emit(event as any, data)

    logger.debug(
      {
        room,
        event,
      },
      'Event emitted to room'
    )
  }

  /**
   * Obter instância do Socket.io (para uso avançado)
   */
  getIO(): TypedSocketServer | null {
    return this.io
  }

  /**
   * Verificar se Socket.io está inicializado
   */
  isInitialized(): boolean {
    return this.io !== null
  }

  /**
   * Obter número de conexões ativas
   */
  async getConnectionsCount(): Promise<number> {
    if (!this.io) return 0

    const sockets = await this.io.fetchSockets()
    return sockets.length
  }

  /**
   * Obter usuários online de uma empresa
   */
  async getOnlineUsers(companyId: string): Promise<string[]> {
    if (!this.io) return []

    const sockets = await this.io.in(SocketRooms.company(companyId)).fetchSockets()
    const userIds = new Set<string>()

    sockets.forEach((socket) => {
      if (socket.data.userId) {
        userIds.add(socket.data.userId)
      }
    })

    return Array.from(userIds)
  }
}

// Singleton instance
export const socketService = new SocketService()
