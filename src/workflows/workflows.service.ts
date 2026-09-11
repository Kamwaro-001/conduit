import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkflowDto } from './dto/create-workflow.dto.js';
import {
  UpdateWorkflowDto,
  WorkflowStatus,
} from './dto/update-workflow.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Workflow } from './entities/workflow.entity.js';
import { Repository } from 'typeorm';
import { Node } from './entities/node.entity.js';
import { Edge } from './entities/edge.entity.js';
import { SyncWorkflowDto } from './dto/sync-workflow.dto.js';
import { SchedulerService } from '../executions/scheduler.service.js';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowsRepo: Repository<Workflow>,
    @InjectRepository(Node)
    private readonly nodesRepo: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgesRepo: Repository<Edge>,
    private readonly schedulerService: SchedulerService,
  ) {}

  create(dto: CreateWorkflowDto, userId: string) {
    const workflow = this.workflowsRepo.create({
      ...dto,
      user: { id: userId },
    });
    return this.workflowsRepo.save(workflow);
  }

  findAll(userId: string) {
    return this.workflowsRepo.find({ where: { user: { id: userId } } });
  }

  async findOne(id: string, userId: string) {
    const workflow = await this.workflowsRepo.findOne({
      where: { id },
      relations: { nodes: true, edges: true, user: true },
    });
    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);
    if (workflow.user.id !== userId) throw new ForbiddenException();
    return workflow;
  }

  async update(id: string, dto: UpdateWorkflowDto, userId: string) {
    await this.assertOwner(id, userId);
    const workflow = await this.workflowsRepo.preload({ id, ...dto });
    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);
    const saved = await this.workflowsRepo.save(workflow);

    // Sync scheduled jobs whenever the status changes.
    if (dto.status) {
      // Load nodes to pass to the scheduler.
      const full = await this.workflowsRepo.findOne({
        where: { id },
        relations: { nodes: true },
      });
      if (full) {
        if (dto.status === WorkflowStatus.PUBLISHED) {
          await this.schedulerService.register(full);
        } else {
          // DRAFT or ARCHIVED — remove any active schedules.
          await this.schedulerService.deregisterAll(id);
        }
      }
    }

    return saved;
  }

  async remove(id: string, userId: string) {
    await this.assertOwner(id, userId);
    // Clean up any scheduled jobs before deleting.
    await this.schedulerService.deregisterAll(id);
    const result = await this.workflowsRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Workflow ${id} not found`);
  }

  async sync(id: string, dto: SyncWorkflowDto, userId: string) {
    await this.assertOwner(id, userId);

    await Promise.all([
      this.edgesRepo.delete({ workflow: { id } }),
      this.nodesRepo.delete({ workflow: { id } }),
    ]);

    const workflow = await this.workflowsRepo.findOneBy({ id });

    const newNodes = dto.nodes.map((nodeDto) =>
      this.nodesRepo.create({ ...nodeDto, workflow: workflow! }),
    );
    const newEdges = dto.edges.map((edgeDto) =>
      this.edgesRepo.create({ ...edgeDto, workflow: workflow! }),
    );

    await Promise.all([
      newNodes.length > 0 ? this.nodesRepo.save(newNodes) : Promise.resolve(),
      newEdges.length > 0 ? this.edgesRepo.save(newEdges) : Promise.resolve(),
    ]);

    return this.findOne(id, userId);
    const updated = await this.findOne(id, userId);

    // Re-register schedules after sync in case cron expressions changed.
    if (updated.status === WorkflowStatus.PUBLISHED) {
      await this.schedulerService.register(updated);
    }

    return updated;
  }

  // Shared ownership check used by mutating methods
  private async assertOwner(id: string, userId: string) {
    const workflow = await this.workflowsRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);
    if (workflow.user.id !== userId) throw new ForbiddenException();
  }
}
