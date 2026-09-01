import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Workflow } from './workflow.entity.js';

export enum NodeType {
  TRIGGER = 'TRIGGER',
  DELAY = 'DELAY',
  EMAIL = 'EMAIL',
  CONDITION = 'CONDITION',
  WEBHOOK = 'WEBHOOK',
}

@Entity('nodes')
export class Node {
  @PrimaryColumn()
  id: string;

  @ManyToOne('Workflow', 'nodes', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @Column({
    type: 'enum',
    enum: NodeType,
  })
  type: NodeType;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  uiPosition: { x: number; y: number };
}
