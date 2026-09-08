// acts as the websocket server.

import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class ExecutionsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('subscribe_workflow')
  handleSubscribe(
    @MessageBody() workflowId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`workflow_${workflowId}`);
  }

  // broadcastNodeStatus(workflowId: string, nodeId: string, status: string) {
  //   // emit an event 'node_status' containing the update
  //   this.server.emit('node_status', {
  //     workflowId,
  //     nodeId,
  //     status,
  //     timestamp: new Date().toISOString(),
  //   });
  // }

  broadcastNodeStatus(
    workflowId: string,
    nodeId: string,
    status: 'RUNNING' | 'SUCCESS' | 'FAILED',
    durationMs: number,
  ) {
    this.server.to(`workflow_${workflowId}`).emit('node_status', {
      nodeId,
      status,
      duration: durationMs,
    });
  }
}
