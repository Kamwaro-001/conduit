import { WorkflowStatus } from '../dto/update-workflow.dto.js';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Node } from './node.entity.js';
import type { Edge } from './edge.entity.js';
import type { User } from '../../users/entities/user.entity.js';

@Entity('workflows')
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: WorkflowStatus,
    default: WorkflowStatus.DRAFT,
  })
  status: WorkflowStatus;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('User', 'workflows', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany('Node', 'workflow', { cascade: true })
  nodes: Node[];

  @OneToMany('Edge', 'workflow', { cascade: true })
  edges: Edge[];
}
