import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { NodeType } from '../entities/node.entity.js';
import { Type } from 'class-transformer';

class NodeDto {
  @IsUUID()
  id: string;

  @IsEnum(NodeType)
  type: NodeType;

  @IsObject()
  config: Record<string, unknown>;

  @IsObject()
  ui_position: Record<string, unknown>;
}

class EdgeDto {
  @IsUUID()
  id: string;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsString()
  @IsNotEmpty()
  target: string;

  @IsOptional()
  @IsString()
  source_handle?: string;
}

export class SyncWorkflowDto {
  // nodes and edges
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeDto)
  nodes: NodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeDto)
  edges: EdgeDto[];
}
