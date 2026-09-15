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
import { QueueEvents, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../common/constants/queue-names.constant';
import { ConfigService } from '@nestjs/config';
import { JOB_STATUS } from './constants/job-status.constant';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/generation',
})
export class GenerationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GenerationGateway.name);
  private queueEvents: QueueEvents;

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.SITE_GENERATION) private readonly siteGenerationQueue: Queue
  ) {
    this.setupQueueEvents();
  }

  private setupQueueEvents() {
    const connectionUrl = this.configService.get<string>('REDIS_URL');
    if (!connectionUrl) {
      this.logger.warn('REDIS_URL not found, GenerationGateway cannot stream progress.');
      return;
    }

    this.queueEvents = new QueueEvents(QUEUE_NAMES.SITE_GENERATION, { connection: { url: connectionUrl } });

    this.queueEvents.on('progress', (args: { jobId: string; data: number | object }) => {
      this.server.to(`job_${args.jobId}`).emit('progress', { progress: args.data });
    });

    this.queueEvents.on('completed', (args: { jobId: string; returnvalue: any; prev?: string }) => {
      this.server.to(`job_${args.jobId}`).emit('progress', { status: JOB_STATUS.COMPLETED });
    });

    this.queueEvents.on('failed', (args: { jobId: string; failedReason: string }) => {
      this.server.to(`job_${args.jobId}`).emit('progress', { status: JOB_STATUS.FAILED, reason: args.failedReason });
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to generation: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from generation: ${client.id}`);
  }

  @SubscribeMessage('subscribeToJob')
  async handleSubscribeToJob(client: Socket, payload: { token: string; jobId: string }) {
    try {
      // Validate token to ensure they are authenticated
      const decoded = this.jwtTokenService.verifyToken(payload.token);
      if (!decoded) throw new Error('Invalid token');

      this.logger.log(`Client ${client.id} subscribed to job ${payload.jobId}`);
      client.join(`job_${payload.jobId}`);

      // Try fetching current job status immediately
      try {
        const job = await this.siteGenerationQueue.getJob(payload.jobId);
        if (job) {
          const state = await job.getState();
          if (state === 'failed') {
             client.emit('progress', { status: JOB_STATUS.FAILED, reason: job.failedReason });
          } else if (state === 'completed') {
             client.emit('progress', { status: JOB_STATUS.COMPLETED });
          } else if (job.progress) {
             client.emit('progress', { progress: job.progress });
          }
        }
      } catch (e) {
        this.logger.error(`Error fetching initial job status for ${payload.jobId}`, e);
      }

      return { event: 'subscribed', data: `job_${payload.jobId}` };
    } catch (e) {
      this.logger.warn(`Client ${client.id} failed to subscribe: Invalid token`);
      client.disconnect();
      return { event: 'error', data: 'Unauthorized' };
    }
  }
}
