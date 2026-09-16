import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service.js';
import { WorkflowsController } from './workflows.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from './entities/workflow.entity.js';
import { Node } from './entities/node.entity.js';
import { Edge } from './entities/edge.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { ExecutionsModule } from '../executions/executions.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, Node, Edge]),
    AuthModule,
    ExecutionsModule,
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
})
export class WorkflowsModule {}
