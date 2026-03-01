import { z, ZodSchema } from 'zod';
import { policyEngineService, type EvaluationContext } from './PolicyEngineService';
import { auditLedgerService } from './AuditLedgerService';

export interface AgentCapability {
  id: string;
  capability: string;
  version: string;
  description: string;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  permissions: string[];
  timeoutMs?: number;
  handler: (input: any) => Promise<any>;
}

export interface InvocationResult {
  success: boolean;
  output?: any;
  error?: string;
  durationMs: number;
  capabilityId: string;
}

export interface InvocationContext {
  actorId: string;
  actorType: 'user' | 'api_key' | 'system';
  source: 'web' | 'mcp' | 'api' | 'system';
  projectId?: string;
}

class AgentRegistry {
  private capabilities = new Map<string, AgentCapability>();

  register(cap: AgentCapability): void {
    if (this.capabilities.has(cap.id)) {
      throw new Error(`Agent capability "${cap.id}" is already registered`);
    }
    this.capabilities.set(cap.id, cap);
    console.log(`[AgentRegistry] Registered: ${cap.id} (${cap.capability})`);
  }

  unregister(id: string): void {
    this.capabilities.delete(id);
  }

  get(id: string): AgentCapability | undefined {
    return this.capabilities.get(id);
  }

  findByCapability(name: string): AgentCapability[] {
    const results: AgentCapability[] = [];
    for (const cap of this.capabilities.values()) {
      if (cap.capability === name || cap.capability.startsWith(name + '.') || name.startsWith(cap.capability + '.')) {
        results.push(cap);
      }
    }
    return results;
  }

  listAll(): AgentCapability[] {
    return Array.from(this.capabilities.values());
  }

  async invoke(
    capabilityId: string,
    input: unknown,
    context: InvocationContext,
  ): Promise<InvocationResult> {
    const cap = this.capabilities.get(capabilityId);
    if (!cap) {
      return { success: false, error: `Unknown capability: ${capabilityId}`, durationMs: 0, capabilityId };
    }

    const start = Date.now();

    // 1. Validate input
    const inputResult = cap.inputSchema.safeParse(input);
    if (!inputResult.success) {
      const error = `Input validation failed: ${inputResult.error.message}`;
      await this.audit(cap, context, false, error, 0);
      return { success: false, error, durationMs: Date.now() - start, capabilityId };
    }

    // 2. Policy gate
    const policyCtx: EvaluationContext = {
      actorId: context.actorId,
      entityType: 'agent',
      entityId: capabilityId,
      projectId: context.projectId,
    };
    try {
      const policyResult = await policyEngineService.evaluate(`agent.invoke.${cap.capability}`, policyCtx);
      if (!policyResult.allowed) {
        const error = `Policy blocked: ${policyResult.matchedPolicies.map(p => p.policyName).join(', ')}`;
        await this.audit(cap, context, false, error, Date.now() - start);
        return { success: false, error, durationMs: Date.now() - start, capabilityId };
      }
    } catch {
      // Policy engine failure is non-blocking — proceed
    }

    // 3. Execute with timeout
    const timeoutMs = cap.timeoutMs ?? 60000;
    let output: any;
    try {
      output = await Promise.race([
        cap.handler(inputResult.data),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Agent timeout after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
    } catch (err: any) {
      const error = err.message || 'Agent execution failed';
      await this.audit(cap, context, false, error, Date.now() - start);
      return { success: false, error, durationMs: Date.now() - start, capabilityId };
    }

    // 4. Validate output
    const outputResult = cap.outputSchema.safeParse(output);
    if (!outputResult.success) {
      const error = `Output validation failed: ${outputResult.error.message}`;
      await this.audit(cap, context, false, error, Date.now() - start);
      return { success: false, error, durationMs: Date.now() - start, capabilityId };
    }

    const durationMs = Date.now() - start;
    await this.audit(cap, context, true, undefined, durationMs);
    return { success: true, output: outputResult.data, durationMs, capabilityId };
  }

  clear(): void {
    this.capabilities.clear();
  }

  private async audit(
    cap: AgentCapability,
    context: InvocationContext,
    success: boolean,
    error: string | undefined,
    durationMs: number,
  ): Promise<void> {
    try {
      await auditLedgerService.append({
        actorId: context.actorId,
        actorType: context.actorType,
        action: success ? 'agent.invoke.success' : 'agent.invoke.failure',
        entityType: 'agent',
        entityId: cap.id,
        projectId: context.projectId ?? null,
        payload: { capability: cap.capability, durationMs, error },
        source: context.source,
      });
    } catch {
      // Audit failure is non-blocking
    }
  }
}

export const agentRegistry = new AgentRegistry();
