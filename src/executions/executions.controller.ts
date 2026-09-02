import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ExecutionsService } from './executions.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Workflow } from '../workflows/entities/workflow.entity.js';
import { Repository } from 'typeorm';
import { GraphTraversalService } from './graph-traversal.service.js';

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
    // fetch workflow, with its nodes and edges.
    const workflow = await this.workflowsRepo.findOne({
      where: { id: workflowId },
      relations: {
        nodes: true,
        edges: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    // guard clause to ignore draft or archived workflows
    if (workflow.status !== 'PUBLISHED') {
      throw new BadRequestException(
        `Workflow ${workflowId} is not active (${workflow.status})`,
      );
    }
    // Find the starting trigger node(s)
    const startNodes = this.traversalService.getStartNodes(
      workflow.nodes,
      workflow.edges,
    );

    if (startNodes.length === 0) {
      throw new BadRequestException(
        `No valid trigger nodes found for workflow ${workflowId}`,
      );
    }

    // 4. Dispatch the trigger node(s) to BullMQ with the incoming webhook payload
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
