import { Injectable } from '@nestjs/common';
import { Node, NodeType } from '../workflows/entities/node.entity.js';
import { Edge } from '../workflows/entities/edge.entity.js';

// find the in and out-degree of each node
@Injectable()
export class GraphTraversalService {
  // find the start node: in-degree of 0.
  getStartNodes(nodes: Node[], edges: Edge[]): Node[] {
    return nodes.filter((node) => {
      const hasIncomingEdges = edges.some((edge) => edge.target === node.id);

      // A true start node has no incoming lines AND is classified as a TRIGGER
      return !hasIncomingEdges && node.type === NodeType.TRIGGER;
    });
  }

  // find the IDs of next nodes to exec, based on current node.
  getNextNodeIds(
    currentNodeId: string,
    edges: Edge[],
    sourceHandle?: string,
  ): string[] {
    let outgoingEdges = edges.filter((edge) => edge.source === currentNodeId);

    // If the current node is a Branch/Condition, only follow the edge that matches the result
    if (sourceHandle) {
      outgoingEdges = outgoingEdges.filter(
        (edge) => edge.source_handle === sourceHandle,
      );
    }

    // Return an array of the target node UUIDs
    return outgoingEdges.map((edge) => edge.target);
  }
}
