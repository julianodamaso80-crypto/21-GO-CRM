import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/auth-store'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface SocketContextValue {
  socket: Socket | null
  connectionStatus: ConnectionStatus
  emit: (event: string, data?: any) => void
  joinRoom: (room: string) => void
  leaveRoom: (room: string) => void
}

const SocketContext = createContext<SocketContextValue | null>(null)

const _isProductionBrowser = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
const SOCKET_URL = _isProductionBrowser ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3333')
const isDev = import.meta.env.DEV

function log(...args: any[]) {
  if (isDev) {
    console.log('[Socket.io]', ...args)
  }
}

interface SocketProviderProps {
  children: React.ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const { token, user, isAuthenticated } = useAuthStore()

  // Initialize socket connection
  useEffect(() => {
    if (!isAuthenticated || !token || !user) {
      log('Not authenticated, skipping socket connection')
      if (socket) {
        log('Disconnecting socket due to logout')
        socket.disconnect()
        setSocket(null)
        setConnectionStatus('disconnected')
      }
      return
    }

    log('Initializing socket connection...')
    setConnectionStatus('connecting')

    const socketInstance = io(SOCKET_URL, {
      auth: {
        token,
      },
      // Polling PRIMEIRO (mais robusto atras de proxies/CDN), WS por upgrade
      // automatico. Se WS falhar, polling continua funcionando (real-time
      // fica ~3s em vez de <100ms, mas mensagens chegam). Garante que
      // mensagens novas aparecem mesmo em redes onde WS direto eh dropado.
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      // Cap em 50 tentativas com backoff: evita loop infinito (411 requests
      // em 5min sufocava o servidor) e impede que aba antiga com token
      // expirado fique martelando socket forever.
      reconnectionAttempts: 50,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    })

    // Connection events
    socketInstance.on('connect', () => {
      log('Connected successfully', socketInstance.id)
      setConnectionStatus('connected')

      // Auto-join company room
      if (user?.companyId) {
        socketInstance.emit('join_room', `company:${user.companyId}`)
        log(`Joined company room: company:${user.companyId}`)
      }
    })

    socketInstance.on('disconnect', (reason) => {
      log('Disconnected:', reason)
      setConnectionStatus('disconnected')
    })

    socketInstance.on('connect_error', (error) => {
      log('Connection error:', error.message)
      setConnectionStatus('disconnected')
    })

    socketInstance.on('reconnect', (attemptNumber) => {
      log('Reconnected after', attemptNumber, 'attempts')
      setConnectionStatus('connected')

      // Re-join company room after reconnection
      if (user?.companyId) {
        socketInstance.emit('join_room', `company:${user.companyId}`)
        log(`Re-joined company room: company:${user.companyId}`)
      }
    })

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      log('Reconnection attempt:', attemptNumber)
      setConnectionStatus('connecting')
    })

    socketInstance.on('reconnect_error', (error) => {
      log('Reconnection error:', error.message)
    })

    socketInstance.on('reconnect_failed', () => {
      log('Reconnection failed - max attempts reached')
      setConnectionStatus('disconnected')
    })

    // Global event listeners for debugging
    socketInstance.onAny((eventName, ...args) => {
      log(`Event received: ${eventName}`, args)
    })

    setSocket(socketInstance)

    // [TRACE-WA] expoe a instancia pra que os logs PROOF consigam ler transport/connected
    if (typeof window !== 'undefined') {
      (window as any).__crmSocket = socketInstance
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      log('Cleaning up socket connection')
      socketInstance.disconnect()
      setSocket(null)
      setConnectionStatus('disconnected')
      // [TRACE-WA] remove referencia ao desconectar
      if (typeof window !== 'undefined' && (window as any).__crmSocket === socketInstance) {
        (window as any).__crmSocket = null
      }
    }
  }, [isAuthenticated, token, user])

  // Emit event helper
  const emit = useCallback((event: string, data?: any) => {
    if (socket && connectionStatus === 'connected') {
      log(`Emitting event: ${event}`, data)
      socket.emit(event, data)
    } else {
      log(`Cannot emit ${event} - socket not connected`)
    }
  }, [socket, connectionStatus])

  // Join room helper
  const joinRoom = useCallback((room: string) => {
    if (socket && connectionStatus === 'connected') {
      log(`Joining room: ${room}`)
      socket.emit('join_room', room)
    } else {
      log(`Cannot join room ${room} - socket not connected`)
    }
  }, [socket, connectionStatus])

  // Leave room helper
  const leaveRoom = useCallback((room: string) => {
    if (socket && connectionStatus === 'connected') {
      log(`Leaving room: ${room}`)
      socket.emit('leave_room', room)
    } else {
      log(`Cannot leave room ${room} - socket not connected`)
    }
  }, [socket, connectionStatus])

  const value: SocketContextValue = {
    socket,
    connectionStatus,
    emit,
    joinRoom,
    leaveRoom,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

// Hook to access socket context
export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
