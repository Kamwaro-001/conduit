// acts as the websocket server.

import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class ExecutionsGateway {
  @WebSocketServer()
  server: Server;

  broadcastNodeStatus(workflowId: string, nodeId: string, status: string) {
    // emit an event 'node_status' containing the update
    this.server.emit('node_status', {
      workflowId,
      nodeId,
      status,
      timestamp: new Date().toISOString(),
    });
  }
}
