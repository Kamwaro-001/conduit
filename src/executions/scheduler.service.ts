import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Workflow } from '../workflows/entities/workflow.entity.js';
import { NodeType } from '../workflows/entities/node.entity.js';
import { WorkflowStatus } from '../workflows/dto/update-workflow.dto.js';

@Injectable()
export class SchedulerService
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Workflow)
    private readonly workflowsRepo: Repository<Workflow>,
    @InjectQueue('node-execution')
    private readonly nodeQueue: Queue,
  ) {}

  /**
   * On startup, re-register all published workflows that have SCHEDULE nodes.
   * This ensures scheduled jobs survive server restarts.
   */
  async onApplicationBootstrap() {
    const publishedWorkflows = await this.workflowsRepo.find({
      where: { status: WorkflowStatus.PUBLISHED },
      relations: { nodes: true },
    });

    for (const workflow of publishedWorkflows) {
      await this.register(workflow);
    }

    this.logger.log(
      `Initialized schedules for ${publishedWorkflows.length} published workflow(s)`,
    );
  }

  /**
   * Register (or update) a BullMQ job scheduler for each SCHEDULE node in the workflow.
   * Uses upsertJobScheduler so it's safe to call multiple times.
   */
  async register(workflow: Workflow): Promise<void> {
    const scheduleNodes = workflow.nodes.filter(
      (n) => n.type === NodeType.SCHEDULE,
    );

    for (const node of scheduleNodes) {
      const cron: string = node.config.cron;
      const tz: string = node.config.timezone ?? 'Africa/Nairobi';

      if (!cron) {
        this.logger.warn(
          `SCHEDULE node ${node.id} has no cron expression — skipping`,
        );
        continue;
      }

      const schedulerId = this.buildSchedulerId(workflow.id, node.id);

      await this.nodeQueue.upsertJobScheduler(
        schedulerId,
        { pattern: cron, tz },
        {
          name: 'execute-node',
          data: { nodeId: node.id, workflowId: workflow.id, inputPayload: {} },
        },
      );

      this.logger.log(
        `Scheduled workflow ${workflow.id} | node ${node.id} | cron: "${cron}" | tz: ${tz}`,
      );
    }
  }

  /**
   * Remove all scheduled jobs for a given workflow.
   */
  async deregisterAll(workflowId: string): Promise<void> {
    const schedulers = await this.nodeQueue.getJobSchedulers(0, -1);
    for (const scheduler of schedulers) {
      if (scheduler.id?.startsWith(`schedule:${workflowId}:`)) {
        await this.nodeQueue.removeJobScheduler(scheduler.id);
        this.logger.log(`Removed job scheduler: ${scheduler.id}`);
      }
    }

    const queuedJobs = await this.nodeQueue.getJobs(
      ['waiting', 'delayed', 'prioritized'],
      0,
      -1,
    );

    for (const job of queuedJobs) {
      if (job.data?.workflowId !== workflowId || job.repeatJobKey) {
        continue;
      }

      await job.remove();
      this.logger.log(`Removed queued job ${job.id} for workflow ${workflowId}`);
    }
  }

  private buildSchedulerId(workflowId: string, nodeId: string): string {
    return `schedule:${workflowId}:${nodeId}`;
  }
}
