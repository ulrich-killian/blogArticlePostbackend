import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { UseGuards } from '@nestjs/common';
  import { JwtAuthGuard } from '../auth/jwt-auth.guard';
  import { JwtService } from '@nestjs/jwt';
  
  @WebSocketGateway({
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    namespace: 'notifications',
  })
  export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds
  
    constructor(private jwtService: JwtService) {}
  
    async handleConnection(client: Socket) {
      try {
        // Authenticate the connection using JWT token
        const token = client.handshake.auth.token || client.handshake.headers.authorization;
        if (!token) {
          client.disconnect();
          return;
        }
  
        const payload = this.jwtService.verify(token.replace('Bearer ', ''));
        const userId = payload.sub || payload.userId;
  
        // Store socket connection
        const userSockets = this.userSockets.get(userId) || [];
        this.userSockets.set(userId, [...userSockets, client.id]);
  
        // Join user to their personal room
        client.join(`user:${userId}`);
        
        console.log(`User ${userId} connected with socket ${client.id}`);
      } catch (error) {
        client.disconnect();
      }
    }
  
    handleDisconnect(client: Socket) {
      // Remove socket from mapping
      for (const [userId, sockets] of this.userSockets.entries()) {
        const filtered = sockets.filter(id => id !== client.id);
        if (filtered.length === 0) {
          this.userSockets.delete(userId);
        } else {
          this.userSockets.set(userId, filtered);
        }
      }
    }
  
    // Send notification to a specific user
    sendNotificationToUser(userId: string, notification: any) {
      this.server.to(`user:${userId}`).emit('new-notification', notification);
    }
  
    // Mark notifications as read
    @SubscribeMessage('mark-read')
    handleMarkRead(client: Socket, payload: { notificationIds: string[] }) {
      // This will be handled by the service
      client.emit('marked-read', { success: true });
    }
  }