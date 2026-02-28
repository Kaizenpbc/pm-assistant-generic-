import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { approvalWorkflowService } from '../services/ApprovalWorkflowService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function approvalWorkflowRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST /workflows/:projectId — create workflow
  fastify.post('/workflows/:projectId', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { projectId } = request.params as { projectId: string };
      const body = request.body as any;
      const workflow = await approvalWorkflowService.createWorkflow(projectId, { ...body, createdBy: user.userId });
      return { workflow };
    } catch (error) {
      console.error('Create workflow error:', error);
      return reply.status(500).send({ error: 'Failed to create workflow' });
    }
  });

  // GET /workflows/:projectId — list workflows
  fastify.get('/workflows/:projectId', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const workflows = await approvalWorkflowService.getWorkflows(projectId);
      return { workflows };
    } catch (error) {
      console.error('Get workflows error:', error);
      return reply.status(500).send({ error: 'Failed to fetch workflows' });
    }
  });

  // PUT /workflows/:id — update workflow
  fastify.put('/workflows/:id', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const workflow = await approvalWorkflowService.updateWorkflow(id, body);
      return { workflow };
    } catch (error) {
      console.error('Update workflow error:', error);
      return reply.status(500).send({ error: 'Failed to update workflow' });
    }
  });

  // DELETE /workflows/:id — delete workflow
  fastify.delete('/workflows/:id', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await approvalWorkflowService.deleteWorkflow(id);
      return { message: 'Workflow deleted' };
    } catch (error) {
      console.error('Delete workflow error:', error);
      return reply.status(500).send({ error: 'Failed to delete workflow' });
    }
  });

  // POST /change-requests/:projectId — create change request
  fastify.post('/change-requests/:projectId', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { projectId } = request.params as { projectId: string };
      const body = request.body as any;
      const changeRequest = await approvalWorkflowService.createChangeRequest(projectId, { ...body, requestedBy: user.userId });
      return { changeRequest };
    } catch (error) {
      console.error('Create change request error:', error);
      return reply.status(500).send({ error: 'Failed to create change request' });
    }
  });

  // GET /change-requests/:projectId — list change requests
  fastify.get('/change-requests/:projectId', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const { status } = request.query as { status?: string };
      const changeRequests = await approvalWorkflowService.getChangeRequests(projectId, status);
      return { changeRequests };
    } catch (error) {
      console.error('Get change requests error:', error);
      return reply.status(500).send({ error: 'Failed to fetch change requests' });
    }
  });

  // GET /change-requests/:id/detail — get change request detail
  fastify.get('/change-requests/:id/detail', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const detail = await approvalWorkflowService.getChangeRequestDetail(id);
      return { detail };
    } catch (error) {
      console.error('Get change request detail error:', error);
      return reply.status(500).send({ error: 'Failed to fetch change request detail' });
    }
  });

  // POST /change-requests/:id/submit — submit for approval
  fastify.post('/change-requests/:id/submit', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { workflowId } = request.body as { workflowId: string };
      const result = await approvalWorkflowService.submitForApproval(id, workflowId);
      return { result };
    } catch (error) {
      console.error('Submit for approval error:', error);
      return reply.status(500).send({ error: 'Failed to submit for approval' });
    }
  });

  // POST /change-requests/:id/action — act on step
  fastify.post('/change-requests/:id/action', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as { id: string };
      const { action, comment } = request.body as { action: string; comment?: string };
      const result = await approvalWorkflowService.actOnStep(id, user.userId, action, comment);
      return { result };
    } catch (error) {
      console.error('Act on step error:', error);
      return reply.status(500).send({ error: 'Failed to process action' });
    }
  });

  // POST /change-requests/:id/withdraw — withdraw change request
  fastify.post('/change-requests/:id/withdraw', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await approvalWorkflowService.withdrawChangeRequest(id);
      return { result };
    } catch (error) {
      console.error('Withdraw change request error:', error);
      return reply.status(500).send({ error: 'Failed to withdraw change request' });
    }
  });
}
