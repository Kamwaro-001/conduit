import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Workflow } from '../../workflows/entities/workflow.entity.js';
import type { Node } from '../../workflows/entities/node.entity.js';

@Entity('execution-logs')
export class ExecutionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['RUNNING', 'SUCCESS', 'FAILED'] })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  result_payload: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @CreateDateColumn()
  started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @ManyToOne('Workflow', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @ManyToOne('Node', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_id' })
  node: Node;
}
