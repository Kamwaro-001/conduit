import { Module } from '@nestjs/common';
import { ExecutionsService } from './executions.service.js';
import { ExecutionsController } from './executions.controller.js';
import { GraphTraversalService } from './graph-traversal.service.js';
import { BullModule } from '@nestjs/bullmq';
import { NodeProcessor } from './node.processor.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Node } from '../workflows/entities/node.entity.js';
import { Edge } from '../workflows/entities/edge.entity.js';

@Module({
  imports: [
    // the queue to use for tasks
    BullModule.registerQueue({
      name: 'node-execution',
    }),
    TypeOrmModule.forFeature([Node, Edge]),
  ],
  controllers: [ExecutionsController],
  providers: [ExecutionsService, GraphTraversalService, NodeProcessor],
})
export class ExecutionsModule {}
