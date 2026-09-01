import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service.js';
import { WorkflowsController } from './workflows.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from './entities/workflow.entity.js';
import { Node } from './entities/node.entity.js';
import { Edge } from './entities/edge.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Workflow, Node, Edge])],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
})
export class WorkflowsModule {}
