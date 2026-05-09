// Socket.io Event Types - CRM IA ENTERPRISE
// Tipos TypeScript para eventos Socket.io do servidor e cliente

// @ts-ignore
import { Message, Appointment, Card } from '../../../shared/types'

// ============================================================================
// EVENTOS DO SERVIDOR (Server -> Client)
// ============================================================================

export interface ServerToClientEvents {
  // Inbox / Chat
  'inbox:new_message': (data: InboxNewMessagePayload) => void
  'inbox:message_read': (data: InboxMessageReadPayload) => void
  'inbox:typing': (data: InboxTypingPayload) => void
  'inbox:conversation_assigned': (data: InboxConversationAssignedPayload) => void
  'conversation:updated': (data: ConversationUpdatedPayload) => void
  'conversation:assigned': (data: ConversationAssignedPayload) => void

  // Notifications
  'notification:new': (data: NotificationPayload) => void

  // Dashboard
  'dashboard:stats_update': (data: DashboardStatsUpdatePayload) => void

  // Kanban / Cards
  'deal:moved': (data: DealMovedPayload) => void
  'deal:created': (data: DealCreatedPayload) => void
  'deal:updated': (data: DealUpdatedPayload) => void
  'deal:deleted': (data: DealDeletedPayload) => void

  // Appointments
  'appointment:created': (data: AppointmentCreatedPayload) => void
  'appointment:updated': (data: AppointmentUpdatedPayload) => void
  'appointment:deleted': (data: AppointmentDeletedPayload) => void
  'appointment:reminder': (data: AppointmentReminderPayload) => void

  // System
  'user:online': (data: UserPresencePayload) => void
  'user:offline': (data: UserPresencePayload) => void
  'company:broadcast': (data: CompanyBroadcastPayload) => void
}

// ============================================================================
// EVENTOS DO CLIENTE (Client -> Server)
// ============================================================================

export interface ClientToServerEvents {
  // Connection
  'join_room': (data: JoinRoomPayload, callback?: (response: RoomResponse) => void) => void
  'leave_room': (data: LeaveRoomPayload, callback?: (response: RoomResponse) => void) => void

  // Typing indicator
  'typing': (data: TypingPayload) => void
  'stop_typing': (data: StopTypingPayload) => void

  // Message read receipts
  'message_read': (data: MessageReadPayload) => void

  // Presence
  'presence:update': (data: PresenceUpdatePayload) => void
}

// ============================================================================
// PAYLOADS - SERVER EVENTS
// ============================================================================

export interface InboxNewMessagePayload {
  conversationId: string
  message: Message
  contact: {
    id: string
    fullName: string
    avatar?: string
  }
  channel: {
    type: 'whatsapp' | 'instagram' | 'webchat'
    name: string
  }
}

export interface InboxMessageReadPayload {
  conversationId: string
  messageId: string
  readBy: {
    id: string
    firstName: string
    lastName: string
  }
  readAt: string
}

export interface InboxTypingPayload {
  conversationId: string
  user?: {
    id: string
    firstName: string
    lastName: string
  }
  contact?: {
    id: string
    fullName: string
  }
  isTyping: boolean
}

export interface InboxConversationAssignedPayload {
  conversationId: string
  assignedTo: {
    id: string
    firstName: string
    lastName: string
    avatar?: string
  }
  assignedBy: {
    id: string
    firstName: string
    lastName: string
  }
  timestamp: string
}

// Eventos simplificados pra UI invalidar query (Projeto Japão Fase 5)
export interface ConversationUpdatedPayload {
  conversationId: string
  status?: string
  [key: string]: any
}

export interface ConversationAssignedPayload {
  conversationId: string
  assignedToId: string
}

export interface NotificationPayload {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  link?: string
  actionLabel?: string
  userId?: string
  companyId: string
  createdAt: string
  expiresAt?: string
}

export interface DashboardStatsUpdatePayload {
  companyId: string
  stats: {
    contacts?: number
    leads?: number
    deals?: number
    revenue?: number
    appointments?: number
  }
  timestamp: string
}

export interface DealMovedPayload {
  cardId: string
  card: Partial<Card>
  fromPhaseId: string
  fromPhaseName: string
  toPhaseId: string
  toPhaseName: string
  movedBy: {
    id: string
    firstName: string
    lastName: string
  }
  timestamp: string
}

export interface DealCreatedPayload {
  card: Card
  createdBy: {
    id: string
    firstName: string
    lastName: string
  }
  timestamp: string
}

export interface DealUpdatedPayload {
  cardId: string
  card: Partial<Card>
  updatedFields: string[]
  updatedBy: {
    id: string
    firstName: string
    lastName: string
  }
  timestamp: string
}

export interface DealDeletedPayload {
  cardId: string
  pipeId: string
  deletedBy: {
    id: string
    firstName: string
    lastName: string
  }
  timestamp: string
}

export interface AppointmentCreatedPayload {
  appointment: Appointment
  createdBy: {
    id: string
    firstName: string
    lastName: string
  }
  timestamp: string
}

export interface AppointmentUpdatedPayload {
  appointmentId: string
  appointment: Partial<Appointment>
  updatedFields: string[]
  updatedBy: {
    id: string
    firstName: string
    lastName: string
  }
  timestamp: string
}

export interface AppointmentDeletedPayload {
  appointmentId: string
  deletedBy: {
    id: string
    firstName: string
    lastName: string
  }
  timestamp: string
}

export interface AppointmentReminderPayload {
  appointment: Appointment
  reminderType: '1hour' | '1day'
  timestamp: string
}

export interface UserPresencePayload {
  userId: string
  firstName: string
  lastName: string
  avatar?: string
  timestamp: string
}

export interface CompanyBroadcastPayload {
  companyId: string
  type: string
  title: string
  message: string
  data?: Record<string, any>
  timestamp: string
}

// ============================================================================
// PAYLOADS - CLIENT EVENTS
// ============================================================================

export interface JoinRoomPayload {
  room: string
  metadata?: Record<string, any>
}

export interface LeaveRoomPayload {
  room: string
}

export interface TypingPayload {
  conversationId: string
}

export interface StopTypingPayload {
  conversationId: string
}

export interface MessageReadPayload {
  conversationId: string
  messageId: string
}

export interface PresenceUpdatePayload {
  status: 'online' | 'away' | 'busy' | 'offline'
}

export interface RoomResponse {
  success: boolean
  room: string
  message?: string
  error?: string
}

// ============================================================================
// SOCKET DATA (attach to socket instance)
// ============================================================================

export interface SocketData {
  userId: string
  companyId: string
  email: string
  roleId: string
}

// ============================================================================
// ROOM NAMING CONVENTIONS
// ============================================================================

export const SocketRooms = {
  // Company-wide room
  company: (companyId: string) => `company:${companyId}`,

  // User-specific room
  user: (userId: string) => `user:${userId}`,

  // Conversation room
  conversation: (conversationId: string) => `conversation:${conversationId}`,

  // Pipeline/Kanban room
  pipe: (pipeId: string) => `pipe:${pipeId}`,

  // Dashboard room (company stats)
  dashboard: (companyId: string) => `dashboard:${companyId}`,

  // Appointments room (for calendar)
  appointments: (companyId: string) => `appointments:${companyId}`,

  // Inbox namespace room
  inbox: (companyId: string) => `inbox:${companyId}`,
} as const
