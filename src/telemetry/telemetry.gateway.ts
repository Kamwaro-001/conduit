import { InjectQueue } from '@nestjs/bullmq';
import {
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Queue } from 'bullmq';
import { Server } from 'socket.io';
import * as os from 'os';

@WebSocketGateway({ cors: true })
export class TelemetryGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    @InjectQueue('workflow-execution') private executionQueue: Queue,
  ) {}

  afterInit() {
    setInterval(async () => {
      try {
        // Get queue depth
        const counts = await this.executionQueue.getJobCounts();
        const activeJobs = counts.active + counts.waiting;

        // Calculate health based on system memory
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // 100% health = 0% memory used. Drops as memory fills up.
        const healthPercentage = 100 - (usedMem / totalMem) * 100;

        this.server.emit('engine_telemetry', {
          activeJobs,
          workerHealth: healthPercentage.toFixed(2),
        });
      } catch (error) {
        console.error('Error fetching telemetry data:', error);
      }
    }, 2000);
  }
}
