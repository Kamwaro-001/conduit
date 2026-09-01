import { WorkflowStatus } from '../dto/update-workflow.dto.js';
import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Node } from './node.entity.js';
import type { Edge } from './edge.entity.js';

@Entity('edges')
export class Workflow {
  // uuid
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // name of the action, e.g "customer onboarding sequence"
  @Column()
  name: string;

  // trigger to run only published workflows
  @Column({
    type: 'enum',
    enum: WorkflowStatus,
    default: WorkflowStatus.DRAFT,
  })
  status: WorkflowStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany('Node', 'workflow', { cascade: true })
  nodes: Node[];

  @OneToMany('Edge', 'workflow', { cascade: true })
  edges: Edge[];
}
