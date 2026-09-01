import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Workflow } from './workflow.entity.js';

@Entity()
export class Edge {
  @PrimaryColumn()
  id: string;

  @Column()
  source: string;

  @Column()
  target: string;

  @Column({ type: 'varchar', name: 'source_handle', nullable: true })
  source_handle: string | null;

  @ManyToOne('Workflow', 'edges', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;
}
