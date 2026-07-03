// Re-export from decomposed module (see dagWorkflow/ directory)
export {
  dagWorkflowService,
  resolveTemplates,
} from './dagWorkflow/index';

export type {
  NodeType,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecution,
  WorkflowNodeExecution,
  DefinitionWithGraph,
  ExecutionWithNodes,
} from './dagWorkflow/types';
