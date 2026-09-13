import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtTokenService } from '../auth/jwt/jwt.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow frontend-dashboard to connect
  },
  namespace: '/leads',
})
export class LeadsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LeadsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtTokenService: JwtTokenService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, token: string) {
    try {
      // Validate token
      const payload = this.jwtTokenService.verifyToken(token);
      const userId = payload.sub;
      
      this.logger.log(`Client ${client.id} joined room for user ${userId}`);
      client.join(`user_${userId}`);
      return { event: 'joined', data: `user_${userId}` };
    } catch (e) {
      this.logger.warn(`Client ${client.id} failed to join room: Invalid token`);
      client.disconnect();
      return { event: 'error', data: 'Unauthorized' };
    }
  }

  notifyNewLead(userId: string, leadData: any) {
    this.logger.log(`Notifying user ${userId} of new lead`);
    this.server.to(`user_${userId}`).emit('new_lead', leadData);
  }
}
