import { Module } from '@nestjs/common';
import { ExecutionsService } from './executions.service.js';
import { WebhooksController } from './executions.controller.js';
import { GraphTraversalService } from './graph-traversal.service.js';
import { BullModule } from '@nestjs/bullmq';
import { NodeProcessor } from './node.processor.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Node } from '../workflows/entities/node.entity.js';
import { Edge } from '../workflows/entities/edge.entity.js';
import { Workflow } from '../workflows/entities/workflow.entity.js';
import { ExecutionLog } from './entities/execution-log.entity.js';
import { ExecutionsGateway } from './executions.gateway.js';

@Module({
  imports: [
    // the queue to use for tasks
    BullModule.registerQueue({
      name: 'node-execution',
    }),
    TypeOrmModule.forFeature([Workflow, Node, Edge, ExecutionLog]),
  ],
  controllers: [WebhooksController],
  providers: [
    ExecutionsService,
    GraphTraversalService,
    NodeProcessor,
    ExecutionsGateway,
  ],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
