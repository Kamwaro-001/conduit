import { Injectable, NotFoundException } from '@nestjs/common';
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

  create(dto: CreateWorkflowDto) {
    const workflow = this.workflowsRepo.create(dto);
    return this.workflowsRepo.save(workflow);
  }

  findAll() {
    return this.workflowsRepo.find();
  }

  async findOne(id: string) {
    const workflow = await this.workflowsRepo.findOne({
      where: { id },
      relations: {
        nodes: true,
        edges: true,
      },
    });
    if (!workflow)
      throw new NotFoundException(`Workflow with id ${id} not found`);
    return workflow;
  }

  async update(id: string, dto: UpdateWorkflowDto) {
    // this approach may cause a race condition: if another request may have modified or deleted the record
    // const result = await this.workflowsRepo.update(id, dto);
    // if (result.affected === 0)
    //   throw new NotFoundException(`Workflow with id ${id} not found`);
    // return this.findOne(id);

    // fix: using typeorm's preload method to load the entity and update it in a single transaction
    const workflow = await this.workflowsRepo.preload({ id, ...dto });
    if (!workflow)
      throw new NotFoundException(`Workflow with id ${id} not found`);
    return this.workflowsRepo.save(workflow);
  }

  async remove(id: string) {
    const result = await this.workflowsRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Workflow with id ${id} not found`);
  }

  async sync(id: string, dto: SyncWorkflowDto) {
    const workflow = await this.workflowsRepo.findOneBy({ id });
    if (!workflow)
      throw new NotFoundException(`Workflow with id ${id} not found`);

    // clear canvas: edges then nodes
    await Promise.all([
      this.edgesRepo.delete({ workflow: { id } }),
      this.nodesRepo.delete({ workflow: { id } }),
    ]);

    // prepare the new nodes .. map over DTO and attach the parent workflow object to each node
    const newNodes = dto.nodes.map((nodeDto) => {
      return this.nodesRepo.create({
        ...nodeDto,
        workflow: workflow, // link the foreign key
      });
    });

    // new edges
    const newEdges = dto.edges.map((edgeDto) => {
      return this.edgesRepo.create({
        ...edgeDto,
        workflow: workflow,
      });
    });

    // Save new state ~ nodes then edges (to avoid foreign key constraint issues)
    await Promise.all([
      newNodes.length > 0 ? this.nodesRepo.save(newNodes) : Promise.resolve(),
      newEdges.length > 0 ? this.edgesRepo.save(newEdges) : Promise.resolve(),
    ]);

    // Fetch and return the fully updated workflow
    return this.findOne(id);
  }
}
