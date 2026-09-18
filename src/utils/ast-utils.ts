import { v4 as uuidv4 } from 'uuid';
import type { ASTNode } from '../skills/schemas/skill-outputs.schema';

/**
 * Idempotently injects a UUID into an AST node and all its children.
 * If a node already has an id, it is preserved.
 */
export function injectNodeIds(node: ASTNode | string): ASTNode | string {
  if (typeof node === 'string') {
    return node;
  }

  // Create a new node object to avoid mutating the original
  const newNode: ASTNode = {
    ...node,
    id: node.id || uuidv4(),
  };

  if (newNode.children && Array.isArray(newNode.children)) {
    newNode.children = newNode.children.map((child: ASTNode | string) => injectNodeIds(child));
  }

  return newNode;
}

/**
 * Recursively finds an ASTNode by its UUID.
 */
export function findNodeById(node: ASTNode | string, id: string): ASTNode | null {
  if (typeof node === 'string') return null;
  if (node.id === id) return node;

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Recursively replaces an ASTNode by its UUID, returning a new tree.
 */
export function replaceNodeById(node: ASTNode | string, id: string, newNode: ASTNode): ASTNode | string {
  if (typeof node === 'string') return node;
  if (node.id === id) return newNode;

  const result: ASTNode = { ...node };

  if (result.children && Array.isArray(result.children)) {
    result.children = result.children.map((child: ASTNode | string) => replaceNodeById(child, id, newNode));
  }

  return result;
}
