/**
 * Service Container — lightweight DI for Fastify
 *
 * Centralizes service instantiation so they can be:
 * 1. Accessed via `fastify.services.xxx` in routes (no direct imports needed)
 * 2. Overridden in tests by replacing entries before server starts
 *
 * Usage in routes:
 *   const { projectService, scheduleService } = fastify.services;
 *
 * Usage in tests:
 *   container.projectService = mockProjectService as any;
 */

import { projectService, ProjectService } from './services/ProjectService';
import { scheduleService, ScheduleService } from './services/ScheduleService';
import { resourceService, ResourceService } from './services/ResourceService';
import { userService, UserService } from './services/UserService';
import { auditLedgerService, AuditLedgerService } from './services/AuditLedgerService';
import { policyEngineService, PolicyEngineService } from './services/PolicyEngineService';
import { agentRegistry, AgentRegistry } from './services/AgentRegistryService';
import { agentScheduler, AgentSchedulerService } from './services/AgentSchedulerService';
import { webhookService, WebhookService } from './services/WebhookService';
import { notificationService, NotificationService } from './services/NotificationService';
import { sprintService, SprintService } from './services/SprintService';
import { templateService, TemplateService } from './services/TemplateService';
import { approvalWorkflowService, ApprovalWorkflowService } from './services/ApprovalWorkflowService';
import { customFieldService, CustomFieldService } from './services/CustomFieldService';
import { fileAttachmentService, FileAttachmentService } from './services/FileAttachmentService';
import { timeEntryService, TimeEntryService } from './services/TimeEntryService';
import { integrationService, IntegrationService } from './services/IntegrationService';
import { apiKeyService, ApiKeyService } from './services/ApiKeyService';
import { stripeService, StripeService } from './services/StripeService';
import { emailService, EmailService } from './services/EmailService';

export interface ServiceContainer {
  projectService: ProjectService;
  scheduleService: ScheduleService;
  resourceService: ResourceService;
  userService: UserService;
  auditLedgerService: AuditLedgerService;
  policyEngineService: PolicyEngineService;
  agentRegistry: AgentRegistry;
  agentScheduler: AgentSchedulerService;
  webhookService: WebhookService;
  notificationService: NotificationService;
  sprintService: SprintService;
  templateService: TemplateService;
  approvalWorkflowService: ApprovalWorkflowService;
  customFieldService: CustomFieldService;
  fileAttachmentService: FileAttachmentService;
  timeEntryService: TimeEntryService;
  integrationService: IntegrationService;
  apiKeyService: ApiKeyService;
  stripeService: StripeService;
  emailService: EmailService;
}

export const serviceContainer: ServiceContainer = {
  projectService,
  scheduleService,
  resourceService,
  userService,
  auditLedgerService,
  policyEngineService,
  agentRegistry,
  agentScheduler,
  webhookService,
  notificationService,
  sprintService,
  templateService,
  approvalWorkflowService,
  customFieldService,
  fileAttachmentService,
  timeEntryService,
  integrationService,
  apiKeyService,
  stripeService,
  emailService,
};
