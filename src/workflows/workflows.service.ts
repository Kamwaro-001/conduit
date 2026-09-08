import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkflowDto } from './dto/create-workflow.dto.js';
import { UpdateWorkflowDto } from './dto/update-workflow.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Workflow } from './entities/workflow.entity.js';
import { Repository } from 'typeorm';
import { Node } from './entities/node.entity.js';
import { Edge } from './entities/edge.entity.js';
import { SyncWorkflowDto } from './dto/sync-workflow.dto.js';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowsRepo: Repository<Workflow>,
    @InjectRepository(Node)
    private readonly nodesRepo: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgesRepo: Repository<Edge>,
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
    if (!workflow)
      throw new NotFoundException(`Workflow ${id} not found`);
    if (workflow.user.id !== userId)
      throw new ForbiddenException();
    return workflow;
  }

  async update(id: string, dto: UpdateWorkflowDto, userId: string) {
    await this.assertOwner(id, userId);
    const workflow = await this.workflowsRepo.preload({ id, ...dto });
    if (!workflow)
      throw new NotFoundException(`Workflow ${id} not found`);
    return this.workflowsRepo.save(workflow);
  }

  async remove(id: string, userId: string) {
    await this.assertOwner(id, userId);
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
