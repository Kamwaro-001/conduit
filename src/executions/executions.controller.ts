import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ExecutionsService } from './executions.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Workflow } from '../workflows/entities/workflow.entity.js';
import { Repository } from 'typeorm';
import { GraphTraversalService } from './graph-traversal.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/current-user.decorator.js';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    @InjectRepository(Workflow)
    private readonly workflowsRepo: Repository<Workflow>,
    private readonly traversalService: GraphTraversalService,
    private readonly executionsService: ExecutionsService,
  ) {}

  @Post(':workflowId')
  async handleWebhook(
    @Param('workflowId') workflowId: string,
    @Body() payload: Record<string, any>,
  ) {
    const workflow = await this.workflowsRepo.findOne({
      where: { id: workflowId },
      relations: { nodes: true, edges: true },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    if (workflow.status !== 'PUBLISHED') {
      throw new BadRequestException(
        `Workflow ${workflowId} is not active (${workflow.status})`,
      );
    }

    const startNodes = this.traversalService.getStartNodes(
      workflow.nodes,
      workflow.edges,
    );

    if (startNodes.length === 0) {
      throw new BadRequestException(
        `No valid trigger nodes found for workflow ${workflowId}`,
      );
    }

    for (const startNode of startNodes) {
      this.logger.log(
        `[WEBHOOK RECEIVED] Triggering workflow ${workflowId} via node ${startNode.id}`,
      );
      await this.executionsService.dispatchNode(
        startNode.id,
        workflowId,
        payload,
      );
    }

    return {
      message: 'Workflow execution queued',
      workflowId,
      triggeredNodes: startNodes.map((node) => node.id),
    };
  }
}

@Controller('executions')
@UseGuards(JwtAuthGuard)
export class ExecutionsController {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowsRepo: Repository<Workflow>,
    private readonly executionsService: ExecutionsService,
  ) {}

  /**
   * GET /executions/:workflowId
   * Returns execution log history for a workflow, most recent first.
   * Only the workflow owner can query their own logs.
   */
  @Get(':workflowId')
  async getExecutionLogs(
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const workflow = await this.workflowsRepo.findOne({
      where: { id: workflowId },
      relations: { user: true },
    });

    if (!workflow || workflow.user.id !== user.sub) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    return this.executionsService.findLogs(workflowId);
  }
}
