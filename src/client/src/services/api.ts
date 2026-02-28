import axios, { AxiosInstance, AxiosResponse } from 'axios';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.DEV ? 'http://localhost:3001/api/v1' : '/api/v1',
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 errors (token expired) — skip for login/register requests
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url?.includes('/auth/refresh') &&
          !originalRequest.url?.includes('/auth/login') &&
          !originalRequest.url?.includes('/auth/register')
        ) {
          originalRequest._retry = true;

          try {
            // Try to refresh the token (empty body ensures Content-Type is sent)
            await this.api.post('/auth/refresh', {});
            return this.api(originalRequest);
          } catch (_refreshError) {
            // Refresh failed, redirect to login
            window.location.href = '/login';
            return Promise.reject(_refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // -------------------------------------------------------------------------
  // Auth endpoints
  // -------------------------------------------------------------------------

  async login(username: string, password: string) {
    try {
      const response = await this.api.post('/auth/login', { username, password });
      return response.data;
    } catch (err: unknown) {
      // Debug: use fetch as fallback to bypass Axios issues
      const baseURL = import.meta.env.DEV ? 'http://localhost:3001/api/v1' : '/api/v1';
      const res = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: body } };
      }
      return res.json();
    }
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    fullName: string;
  }) {
    const response = await this.api.post('/auth/register', userData);
    return response.data;
  }

  async logout() {
    const response = await this.api.post('/auth/logout');
    return response.data;
  }

  async verifyEmail(token: string) {
    const response = await this.api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    return response.data;
  }

  async forgotPassword(email: string) {
    const response = await this.api.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(token: string, password: string) {
    const response = await this.api.post('/auth/reset-password', { token, password });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.api.get('/users/me');
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Stripe / Subscription endpoints
  // -------------------------------------------------------------------------

  async createCheckoutSession() {
    const response = await this.api.post('/stripe/create-checkout-session');
    return response.data;
  }

  async createPortalSession() {
    const response = await this.api.post('/stripe/create-portal-session');
    return response.data;
  }

  async getSubscriptionStatus() {
    const response = await this.api.get('/stripe/subscription-status');
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Project endpoints
  // -------------------------------------------------------------------------

  async getProjects() {
    const response = await this.api.get('/projects');
    return response.data;
  }

  async getProject(id: string) {
    const response = await this.api.get(`/projects/${id}`);
    return response.data;
  }

  async createProject(projectData: {
    name: string;
    description?: string;
    status?: string;
    priority?: string;
    budgetAllocated?: number;
    startDate?: string;
    endDate?: string;
    location?: string;
  }) {
    const response = await this.api.post('/projects', projectData);
    return response.data;
  }

  async updateProject(id: string, projectData: Record<string, unknown>) {
    const response = await this.api.put(`/projects/${id}`, projectData);
    return response.data;
  }

  async deleteProject(id: string) {
    const response = await this.api.delete(`/projects/${id}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Schedule endpoints
  // -------------------------------------------------------------------------

  async getSchedules(projectId: string) {
    const response = await this.api.get(`/schedules/project/${projectId}`);
    return response.data;
  }

  async createSchedule(scheduleData: {
    projectId: string;
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
  }) {
    const response = await this.api.post('/schedules', scheduleData);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Task endpoints
  // -------------------------------------------------------------------------

  async getTasks(scheduleId: string) {
    const response = await this.api.get(`/schedules/${scheduleId}/tasks`);
    return response.data;
  }

  async createTask(
    scheduleId: string,
    taskData: {
      name: string;
      description?: string;
      status?: string;
      priority?: string;
      assignedTo?: string;
      dueDate?: string;
      estimatedDays?: number;
      startDate?: string;
      endDate?: string;
      progressPercentage?: number;
      dependency?: string;
      parentTaskId?: string;
    }
  ) {
    const response = await this.api.post(`/schedules/${scheduleId}/tasks`, taskData);
    return response.data;
  }

  async updateTask(scheduleId: string, taskId: string, taskData: Record<string, unknown>) {
    const response = await this.api.put(`/schedules/${scheduleId}/tasks/${taskId}`, taskData);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // AI Chat endpoints
  // -------------------------------------------------------------------------

  async streamChatMessage(data: {
    message: string;
    conversationId?: string;
    context?: { type: string; projectId?: string };
  }): Promise<Response> {
    const streamBase = import.meta.env.DEV ? 'http://localhost:3001' : '';
    return fetch(`${streamBase}/api/v1/ai-chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
  }

  async sendChatMessage(data: {
    message: string;
    conversationId?: string;
    context?: { type: string; projectId?: string };
  }) {
    const response = await this.api.post('/ai-chat/message', data);
    return response.data;
  }

  async executeAlertAction(data: { toolName: string; params: Record<string, any> }) {
    const response = await this.api.post('/alerts/execute-action', data);
    return response.data;
  }

  async getAlerts() {
    const response = await this.api.get('/alerts');
    return response.data;
  }

  async getAlertsSummary() {
    const response = await this.api.get('/alerts/summary');
    return response.data;
  }

  // -------------------------------------------------------------------------
  // AI Chat extended endpoints
  // -------------------------------------------------------------------------

  async createProjectFromChat(description: string) {
    const response = await this.api.post('/ai-chat/create-project', { description });
    return response.data;
  }

  async extractTasksFromNotes(data: {
    meetingNotes: string;
    projectId?: string;
    scheduleId?: string;
  }) {
    const response = await this.api.post('/ai-chat/extract-tasks', data);
    return response.data;
  }

  async getConversations() {
    const response = await this.api.get('/ai-chat/conversations');
    return response.data;
  }

  async getConversation(conversationId: string) {
    const response = await this.api.get(`/ai-chat/conversations/${conversationId}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Predictions endpoints
  // -------------------------------------------------------------------------

  async getDashboardPredictions() {
    const response = await this.api.get('/predictions/dashboard');
    return response.data;
  }

  async getProjectRisks(projectId: string) {
    const response = await this.api.get(`/predictions/project/${projectId}/risks`);
    return response.data;
  }

  async getProjectWeather(projectId: string) {
    const response = await this.api.get(`/predictions/project/${projectId}/weather`);
    return response.data;
  }

  async getProjectBudget(projectId: string) {
    const response = await this.api.get(`/predictions/project/${projectId}/budget`);
    return response.data;
  }

  async getProjectHealth(projectId: string) {
    const response = await this.api.get(`/predictions/project/${projectId}/health`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // AI Reports endpoints
  // -------------------------------------------------------------------------

  async generateReport(data: {
    reportType: string;
    projectId?: string;
  }) {
    const response = await this.api.post('/ai-reports/generate', data);
    return response.data;
  }

  async getReportHistory() {
    const response = await this.api.get('/ai-reports/history');
    return response.data;
  }

  // -------------------------------------------------------------------------
  // AI Scheduling endpoints
  // -------------------------------------------------------------------------

  async getTaskBreakdown(data: {
    projectDescription: string;
    projectType?: string;
    estimatedDurationMonths?: number;
  }) {
    const response = await this.api.post('/ai-scheduling/breakdown', data);
    return response.data;
  }

  async getSchedulingDependencies(data: { tasks: Array<{ id: string; name: string }> }) {
    const response = await this.api.post('/ai-scheduling/dependencies', data);
    return response.data;
  }

  async getSchedulingOptimization(data: { projectId: string }) {
    const response = await this.api.post('/ai-scheduling/optimization', data);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Learning & Feedback endpoints
  // -------------------------------------------------------------------------

  async submitFeedback(data: {
    feature: string;
    projectId?: string;
    userAction: 'accepted' | 'modified' | 'rejected';
    feedbackText?: string;
  }) {
    const response = await this.api.post('/learning/feedback', data);
    return response.data;
  }

  async submitAccuracy(data: {
    projectId: string;
    metricType: string;
    predictedValue: number;
    actualValue: number;
    projectType?: string;
  }) {
    const response = await this.api.post('/learning/accuracy', data);
    return response.data;
  }

  async getAccuracyReport(projectType?: string) {
    const params = projectType ? { projectType } : {};
    const response = await this.api.get('/learning/accuracy-report', { params });
    return response.data;
  }

  async getFeedbackStats(feature?: string) {
    const params = feature ? { feature } : {};
    const response = await this.api.get('/learning/feedback-stats', { params });
    return response.data;
  }

  async getLearningInsights() {
    const response = await this.api.get('/learning/insights');
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Intelligence endpoints
  // -------------------------------------------------------------------------

  async getPortfolioAnomalies() {
    const response = await this.api.get('/intelligence/anomalies');
    return response.data;
  }

  async getProjectAnomalies(projectId: string) {
    const response = await this.api.get(`/intelligence/anomalies/project/${projectId}`);
    return response.data;
  }

  async getCrossProjectIntelligence() {
    const response = await this.api.get('/intelligence/cross-project');
    return response.data;
  }

  async getSimilarProjects(projectId: string) {
    const response = await this.api.get(`/intelligence/cross-project/similar/${projectId}`);
    return response.data;
  }

  async modelScenario(data: {
    projectId: string;
    scenario: string;
    parameters?: {
      budgetChangePct?: number;
      workerChange?: number;
      daysExtension?: number;
      scopeChangePct?: number;
    };
  }) {
    const response = await this.api.post('/intelligence/scenarios', data);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Project Members (RBAC)
  // -------------------------------------------------------------------------

  async getProjectMembers(projectId: string) {
    const response = await this.api.get(`/projects/${projectId}/members`);
    return response.data;
  }

  async addProjectMember(projectId: string, data: { userId: string; userName: string; email: string; role: string }) {
    const response = await this.api.post(`/projects/${projectId}/members`, data);
    return response.data;
  }

  async updateProjectMemberRole(projectId: string, memberId: string, role: string) {
    const response = await this.api.put(`/projects/${projectId}/members/${memberId}`, { role });
    return response.data;
  }

  async removeProjectMember(projectId: string, memberId: string) {
    const response = await this.api.delete(`/projects/${projectId}/members/${memberId}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Audit Trail
  // -------------------------------------------------------------------------

  async getAuditTrail(projectId: string, limit = 50, offset = 0) {
    const response = await this.api.get(`/audit/${projectId}`, { params: { limit, offset } });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Portfolio
  // -------------------------------------------------------------------------

  async getPortfolio() {
    const response = await this.api.get('/portfolio');
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Critical Path
  // -------------------------------------------------------------------------

  async getCriticalPath(scheduleId: string) {
    const response = await this.api.get(`/schedules/${scheduleId}/critical-path`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Baselines
  // -------------------------------------------------------------------------

  async getBaselines(scheduleId: string) {
    const response = await this.api.get(`/schedules/${scheduleId}/baselines`);
    return response.data;
  }

  async createBaseline(scheduleId: string, name: string) {
    const response = await this.api.post(`/schedules/${scheduleId}/baselines`, { name });
    return response.data;
  }

  async compareBaseline(scheduleId: string, baselineId: string) {
    const response = await this.api.get(`/schedules/${scheduleId}/baselines/${baselineId}/compare`);
    return response.data;
  }

  async deleteBaseline(scheduleId: string, baselineId: string) {
    const response = await this.api.delete(`/schedules/${scheduleId}/baselines/${baselineId}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // S-Curve
  // -------------------------------------------------------------------------

  async getSCurveData(projectId: string) {
    const response = await this.api.get(`/predictions/project/${projectId}/evm/s-curve`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Resources
  // -------------------------------------------------------------------------

  async getResources() {
    const response = await this.api.get('/resources');
    return response.data;
  }

  async createResource(data: {
    name: string;
    role: string;
    email: string;
    capacityHoursPerWeek?: number;
    skills?: string[];
  }) {
    const response = await this.api.post('/resources', data);
    return response.data;
  }

  async getResourceWorkload(projectId: string) {
    const response = await this.api.get(`/resources/workload/${projectId}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Comments & Activity
  // -------------------------------------------------------------------------

  async getTaskComments(scheduleId: string, taskId: string) {
    const response = await this.api.get(`/schedules/${scheduleId}/tasks/${taskId}/comments`);
    return response.data;
  }

  async addTaskComment(scheduleId: string, taskId: string, text: string) {
    const response = await this.api.post(`/schedules/${scheduleId}/tasks/${taskId}/comments`, { text });
    return response.data;
  }

  async deleteTaskComment(scheduleId: string, taskId: string, commentId: string) {
    const response = await this.api.delete(`/schedules/${scheduleId}/tasks/${taskId}/comments/${commentId}`);
    return response.data;
  }

  async getTaskActivity(scheduleId: string, taskId: string) {
    const response = await this.api.get(`/schedules/${scheduleId}/tasks/${taskId}/activity`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Workflows
  // -------------------------------------------------------------------------

  async getWorkflows(projectId?: string) {
    const params = projectId ? `?projectId=${projectId}` : '';
    const response = await this.api.get(`/workflows${params}`);
    return response.data;
  }

  async getWorkflow(id: string) {
    const response = await this.api.get(`/workflows/${id}`);
    return response.data;
  }

  async createWorkflow(data: Record<string, unknown>) {
    const response = await this.api.post('/workflows', data);
    return response.data;
  }

  async updateWorkflow(id: string, data: Record<string, unknown>) {
    const response = await this.api.put(`/workflows/${id}`, data);
    return response.data;
  }

  async deleteWorkflow(id: string) {
    const response = await this.api.delete(`/workflows/${id}`);
    return response.data;
  }

  async toggleWorkflow(id: string, enabled: boolean) {
    const response = await this.api.patch(`/workflows/${id}/toggle`, { enabled });
    return response.data;
  }

  async triggerWorkflow(id: string, entityType: string, entityId: string) {
    const response = await this.api.post(`/workflows/${id}/trigger`, { entityType, entityId });
    return response.data;
  }

  async getWorkflowExecutions(filters?: Record<string, string>) {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    const response = await this.api.get(`/workflows/executions${params}`);
    return response.data;
  }

  async getWorkflowExecution(id: string) {
    const response = await this.api.get(`/workflows/executions/${id}`);
    return response.data;
  }

  async resumeWorkflowExecution(id: string, nodeId: string, result: Record<string, unknown> = {}) {
    const response = await this.api.post(`/workflows/executions/${id}/resume`, { nodeId, result });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  async exportProjectCSV(projectId: string) {
    const response = await this.api.get(`/exports/projects/${projectId}/export?format=csv`, {
      responseType: 'blob',
    });
    // Trigger download
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-${projectId}-export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // -------------------------------------------------------------------------
  // Monte Carlo Simulation
  // -------------------------------------------------------------------------

  async runMonteCarloSimulation(scheduleId: string, config?: { iterations?: number; confidenceLevels?: number[]; uncertaintyModel?: string }) {
    const response = await this.api.post(`/monte-carlo/${scheduleId}/simulate`, config || {});
    return response.data;
  }

  // -------------------------------------------------------------------------
  // EVM Forecast
  // -------------------------------------------------------------------------

  async getEVMForecast(projectId: string) {
    const response = await this.api.get(`/evm-forecast/${projectId}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Auto-Reschedule
  // -------------------------------------------------------------------------

  async getDelays(scheduleId: string) {
    const response = await this.api.get(`/auto-reschedule/${scheduleId}/delays`);
    return response.data;
  }

  async generateRescheduleProposal(scheduleId: string) {
    const response = await this.api.post(`/auto-reschedule/${scheduleId}/propose`);
    return response.data;
  }

  async getRescheduleProposals(scheduleId: string) {
    const response = await this.api.get(`/auto-reschedule/${scheduleId}/proposals`);
    return response.data;
  }

  async acceptRescheduleProposal(proposalId: string) {
    const response = await this.api.post(`/auto-reschedule/proposals/${proposalId}/accept`);
    return response.data;
  }

  async rejectRescheduleProposal(proposalId: string, feedback?: string) {
    const response = await this.api.post(`/auto-reschedule/proposals/${proposalId}/reject`, { feedback });
    return response.data;
  }

  async modifyRescheduleProposal(proposalId: string, modifications: any[]) {
    const response = await this.api.post(`/auto-reschedule/proposals/${proposalId}/modify`, { modifications });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Resource Optimizer
  // -------------------------------------------------------------------------

  async getResourceForecast(projectId: string, weeksAhead?: number) {
    const params = weeksAhead ? { weeksAhead } : {};
    const response = await this.api.get(`/resource-optimizer/${projectId}/forecast`, { params });
    return response.data;
  }

  async getSkillMatch(taskId: string, scheduleId: string) {
    const response = await this.api.post('/resource-optimizer/skill-match', { taskId, scheduleId });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Meeting Intelligence
  // -------------------------------------------------------------------------

  async analyzeMeetingTranscript(data: { transcript: string; projectId: string; scheduleId: string }) {
    const response = await this.api.post('/meeting-intelligence/analyze', data);
    return response.data;
  }

  async applyMeetingChanges(analysisId: string, selectedItems: number[]) {
    const response = await this.api.post(`/meeting-intelligence/${analysisId}/apply`, { selectedItems });
    return response.data;
  }

  async getMeetingHistory(projectId: string) {
    const response = await this.api.get(`/meeting-intelligence/project/${projectId}/history`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Lessons Learned
  // -------------------------------------------------------------------------

  async getLessonsKnowledgeBase() {
    const response = await this.api.get('/lessons-learned/knowledge-base');
    return response.data;
  }

  async extractLessons(projectId: string) {
    const response = await this.api.post(`/lessons-learned/extract/${projectId}`);
    return response.data;
  }

  async getRelevantLessons(projectType?: string, category?: string) {
    const params: Record<string, string> = {};
    if (projectType) params.projectType = projectType;
    if (category) params.category = category;
    const response = await this.api.get('/lessons-learned/relevant', { params });
    return response.data;
  }

  async detectPatterns() {
    const response = await this.api.post('/lessons-learned/patterns');
    return response.data;
  }

  async suggestMitigations(riskDescription: string, projectType: string) {
    const response = await this.api.post('/lessons-learned/mitigations', { riskDescription, projectType });
    return response.data;
  }

  async addLesson(data: { projectId: string; projectName: string; projectType: string; category: string; title: string; description: string; impact: string; recommendation: string }) {
    const response = await this.api.post('/lessons-learned', data);
    return response.data;
  }

  async seedLessons() {
    const response = await this.api.post('/lessons-learned/seed');
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Natural Language Query
  // -------------------------------------------------------------------------

  async submitNLQuery(data: { query: string; context?: { projectId?: string } }) {
    const response = await this.api.post('/nl-query', data);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  async getTemplates(projectType?: string, category?: string) {
    const params: Record<string, string> = {};
    if (projectType) params.projectType = projectType;
    if (category) params.category = category;
    const response = await this.api.get('/templates', { params });
    return response.data;
  }

  async getTemplate(id: string) {
    const response = await this.api.get(`/templates/${id}`);
    return response.data;
  }

  async createTemplate(data: Record<string, unknown>) {
    const response = await this.api.post('/templates', data);
    return response.data;
  }

  async applyTemplate(data: {
    templateId: string;
    projectName: string;
    startDate: string;
    budget?: number;
    priority?: string;
    location?: string;
    selectedTaskRefIds?: string[];
  }) {
    const response = await this.api.post('/templates/apply', data);
    return response.data;
  }

  async saveProjectAsTemplate(data: {
    projectId: string;
    templateName: string;
    description?: string;
    tags?: string[];
  }) {
    const response = await this.api.post('/templates/save-from-project', data);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Export (continued)
  // -------------------------------------------------------------------------

  async exportProjectJSON(projectId: string) {
    const response = await this.api.get(`/exports/projects/${projectId}/export?format=json`);
    return response.data;
  }

  /**
   * Generate a printable HTML report in a new window and trigger print.
   */
  async exportProjectPDF(projectId: string) {
    const data = await this.exportProjectJSON(projectId);
    const project = data.project;
    const schedules = data.schedules || [];

    const statusColor: Record<string, string> = {
      completed: '#22c55e',
      in_progress: '#3b82f6',
      pending: '#9ca3af',
      cancelled: '#ef4444',
    };

    let taskRowsHtml = '';
    for (const sch of schedules) {
      for (const t of sch.tasks) {
        const color = statusColor[t.status] || '#9ca3af';
        taskRowsHtml += `<tr>
          <td>${sch.name}</td>
          <td>${t.name}</td>
          <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px"></span>${t.status.replace('_', ' ')}</td>
          <td>${t.priority}</td>
          <td>${t.assignedTo}</td>
          <td>${t.startDate}</td>
          <td>${t.endDate}</td>
          <td>
            <div style="background:#e5e7eb;border-radius:4px;height:14px;width:80px;position:relative">
              <div style="background:${color};border-radius:4px;height:100%;width:${t.progressPercentage}%"></div>
              <span style="position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:9px;line-height:14px">${t.progressPercentage}%</span>
            </div>
          </td>
        </tr>`;
      }
    }

    const budgetPct = project && project.budgetAllocated > 0
      ? Math.round((project.budgetSpent / project.budgetAllocated) * 100)
      : 0;

    const html = `<!DOCTYPE html>
<html><head>
<title>Project Report - ${project?.name || 'Export'}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; padding: 40px; font-size: 11px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .meta { color: #6b7280; font-size: 10px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi .label { font-size: 9px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
  .kpi .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #f9fafb; text-align: left; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; font-weight: 600; text-transform: uppercase; font-size: 9px; color: #6b7280; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
  tr:hover { background: #f9fafb; }
  .footer { margin-top: 30px; text-align: center; color: #9ca3af; font-size: 9px; }
  @media print { body { padding: 20px; } @page { size: landscape; margin: 0.4in; } }
</style>
</head><body>
<div class="header">
  <div>
    <h1>${project?.name || 'Project Report'}</h1>
    <div class="meta">Status: ${project?.status || 'N/A'} | Generated: ${new Date().toLocaleString()}</div>
  </div>
</div>

${project ? `<div class="kpis">
  <div class="kpi">
    <div class="label">Progress</div>
    <div class="value" style="color:#3b82f6">${project.progressPercentage || 0}%</div>
  </div>
  <div class="kpi">
    <div class="label">Budget Spent</div>
    <div class="value" style="color:${budgetPct > 90 ? '#ef4444' : '#22c55e'}">$${((project.budgetSpent || 0) / 1e6).toFixed(1)}M / $${((project.budgetAllocated || 0) / 1e6).toFixed(1)}M</div>
  </div>
  <div class="kpi">
    <div class="label">Budget Used</div>
    <div class="value">${budgetPct}%</div>
  </div>
  <div class="kpi">
    <div class="label">Schedules</div>
    <div class="value">${schedules.length}</div>
  </div>
</div>` : ''}

<h2>Task Schedule</h2>
<table>
  <thead>
    <tr><th>Schedule</th><th>Task</th><th>Status</th><th>Priority</th><th>Assigned To</th><th>Start</th><th>End</th><th>Progress</th></tr>
  </thead>
  <tbody>${taskRowsHtml}</tbody>
</table>

${schedules.some((s: any) => s.criticalPath?.criticalPathTaskIds?.length) ? `
<h2>Critical Path</h2>
${schedules.filter((s: any) => s.criticalPath?.criticalPathTaskIds?.length).map((s: any) => `
  <p style="margin-bottom:4px"><strong>${s.name}</strong> - Duration: ${s.criticalPath.projectDuration} days, Critical tasks: ${s.criticalPath.criticalPathTaskIds.length}</p>
  <p style="color:#6b7280;margin-bottom:12px">${s.criticalPath.criticalPathTaskIds.map((id: string) => {
    const task = s.tasks.find((t: any) => t.id === id);
    return task ? task.name : id;
  }).join(' → ')}</p>
`).join('')}` : ''}

<div class="footer">Kovarti PM Assistant - Project Report</div>

<script>window.onload = function() { window.print(); }</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  // -------------------------------------------------------------------------
  // Task Prioritization
  // -------------------------------------------------------------------------

  async getTaskPrioritization(projectId: string, scheduleId: string) {
    const response = await this.api.get(`/task-prioritization/${projectId}/${scheduleId}/prioritize`);
    return response.data;
  }

  async applyTaskPriority(projectId: string, scheduleId: string, taskId: string, priority: string) {
    const response = await this.api.post(`/task-prioritization/${projectId}/${scheduleId}/apply`, { taskId, priority });
    return response.data;
  }

  async applyAllTaskPriorities(projectId: string, scheduleId: string, changes: Array<{ taskId: string; priority: string }>) {
    const response = await this.api.post(`/task-prioritization/${projectId}/${scheduleId}/apply-all`, { changes });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------

  async getNotifications(limit = 50, offset = 0) {
    const response = await this.api.get('/notifications', { params: { limit, offset } });
    return response.data;
  }

  async getUnreadNotificationCount() {
    const response = await this.api.get('/notifications/unread-count');
    return response.data;
  }

  async markNotificationRead(id: string) {
    const response = await this.api.post(`/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsRead() {
    const response = await this.api.post('/notifications/mark-all-read');
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Agent
  // -------------------------------------------------------------------------

  async triggerAgentScan() {
    const response = await this.api.post('/agent/trigger');
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Agent Activity Log
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // File Attachments
  // -------------------------------------------------------------------------

  async uploadAttachment(entityType: string, entityId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post(`/attachments/${entityType}/${entityId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async getAttachments(entityType: string, entityId: string) {
    const response = await this.api.get(`/attachments/${entityType}/${entityId}`);
    return response.data;
  }

  async downloadAttachment(id: string) {
    const response = await this.api.get(`/attachments/${id}/download`, { responseType: 'blob' });
    return response.data;
  }

  async uploadAttachmentVersion(id: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post(`/attachments/${id}/version`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async getAttachmentVersions(id: string) {
    const response = await this.api.get(`/attachments/${id}/versions`);
    return response.data;
  }

  async deleteAttachment(id: string) {
    const response = await this.api.delete(`/attachments/${id}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Time Entries
  // -------------------------------------------------------------------------

  async createTimeEntry(data: {
    taskId: string; scheduleId: string; projectId: string;
    date: string; hours: number; description?: string; billable?: boolean;
  }) {
    const response = await this.api.post('/time-entries', data);
    return response.data;
  }

  async getTaskTimeEntries(taskId: string) {
    const response = await this.api.get(`/time-entries/task/${taskId}`);
    return response.data;
  }

  async getProjectTimeEntries(projectId: string, startDate?: string, endDate?: string) {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await this.api.get(`/time-entries/project/${projectId}`, { params });
    return response.data;
  }

  async getWeeklyTimesheet(weekStart: string) {
    const response = await this.api.get('/time-entries/timesheet', { params: { weekStart } });
    return response.data;
  }

  async getActualVsEstimated(scheduleId: string) {
    const response = await this.api.get(`/time-entries/actual-vs-estimated/${scheduleId}`);
    return response.data;
  }

  async updateTimeEntry(id: string, data: { date?: string; hours?: number; description?: string; billable?: boolean }) {
    const response = await this.api.put(`/time-entries/${id}`, data);
    return response.data;
  }

  async deleteTimeEntry(id: string) {
    const response = await this.api.delete(`/time-entries/${id}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Custom Fields
  // -------------------------------------------------------------------------

  async getCustomFields(projectId: string, entityType?: string) {
    const params: Record<string, string> = {};
    if (entityType) params.entityType = entityType;
    const response = await this.api.get(`/custom-fields/project/${projectId}`, { params });
    return response.data;
  }

  async createCustomField(projectId: string, data: {
    entityType: string; fieldName: string; fieldLabel: string;
    fieldType: string; options?: string[]; isRequired?: boolean; sortOrder?: number;
  }) {
    const response = await this.api.post(`/custom-fields/project/${projectId}`, data);
    return response.data;
  }

  async updateCustomField(id: string, data: { fieldLabel?: string; fieldType?: string; options?: string[]; isRequired?: boolean; sortOrder?: number }) {
    const response = await this.api.put(`/custom-fields/${id}`, data);
    return response.data;
  }

  async deleteCustomField(id: string) {
    const response = await this.api.delete(`/custom-fields/${id}`);
    return response.data;
  }

  async getCustomFieldValues(entityType: string, entityId: string, projectId: string) {
    const response = await this.api.get(`/custom-fields/values/${entityType}/${entityId}`, { params: { projectId } });
    return response.data;
  }

  async saveCustomFieldValues(entityType: string, entityId: string, values: Array<{ fieldId: string; text?: string; number?: number; date?: string; boolean?: boolean }>) {
    const response = await this.api.post(`/custom-fields/values/${entityType}/${entityId}`, { values });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Network Diagram
  // -------------------------------------------------------------------------

  async getNetworkDiagram(scheduleId: string) {
    const response = await this.api.get(`/network-diagram/${scheduleId}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Burndown / Burnup
  // -------------------------------------------------------------------------

  async getBurndownData(scheduleId: string) {
    const response = await this.api.get(`/burndown/${scheduleId}`);
    return response.data;
  }

  async getVelocityData(scheduleId: string) {
    const response = await this.api.get(`/burndown/${scheduleId}/velocity`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Agent Activity Log
  // -------------------------------------------------------------------------

  async getAgentActivityLog(projectId: string, limit = 50, offset = 0, agent?: string) {
    const params: Record<string, string | number> = { limit, offset };
    if (agent) params.agent = agent;
    const response = await this.api.get(`/agent-log/${projectId}`, { params });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Approval Workflows & Change Requests
  // -------------------------------------------------------------------------

  async createApprovalWorkflow(projectId: string, data: { name: string; description?: string; entityType: string; steps: any[] }) {
    const response = await this.api.post(`/approvals/workflows/${projectId}`, data);
    return response.data;
  }

  async getApprovalWorkflows(projectId: string) {
    const response = await this.api.get(`/approvals/workflows/${projectId}`);
    return response.data;
  }

  async updateApprovalWorkflow(id: string, data: Record<string, unknown>) {
    const response = await this.api.put(`/approvals/workflows/${id}`, data);
    return response.data;
  }

  async deleteApprovalWorkflow(id: string) {
    const response = await this.api.delete(`/approvals/workflows/${id}`);
    return response.data;
  }

  async createChangeRequest(projectId: string, data: { title: string; description: string; category: string; priority?: string; impactSummary?: string }) {
    const response = await this.api.post(`/approvals/change-requests/${projectId}`, data);
    return response.data;
  }

  async getChangeRequests(projectId: string, status?: string) {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const response = await this.api.get(`/approvals/change-requests/${projectId}`, { params });
    return response.data;
  }

  async getChangeRequestDetail(id: string) {
    const response = await this.api.get(`/approvals/change-requests/${id}/detail`);
    return response.data;
  }

  async submitChangeRequestForApproval(id: string, workflowId: string) {
    const response = await this.api.post(`/approvals/change-requests/${id}/submit`, { workflowId });
    return response.data;
  }

  async actOnChangeRequest(id: string, action: string, comment?: string) {
    const response = await this.api.post(`/approvals/change-requests/${id}/action`, { action, comment });
    return response.data;
  }

  async withdrawChangeRequest(id: string) {
    const response = await this.api.post(`/approvals/change-requests/${id}/withdraw`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Client / Stakeholder Portal
  // -------------------------------------------------------------------------

  async createPortalLink(projectId: string, data: { permissions: Record<string, boolean>; label?: string; expiresAt?: string }) {
    const response = await this.api.post(`/portal/links/${projectId}`, data);
    return response.data;
  }

  async getPortalLinks(projectId: string) {
    const response = await this.api.get(`/portal/links/${projectId}`);
    return response.data;
  }

  async updatePortalLink(id: string, data: Record<string, unknown>) {
    const response = await this.api.put(`/portal/links/${id}`, data);
    return response.data;
  }

  async deletePortalLink(id: string) {
    const response = await this.api.delete(`/portal/links/${id}`);
    return response.data;
  }

  async getPortalComments(projectId: string) {
    const response = await this.api.get(`/portal/comments/${projectId}`);
    return response.data;
  }

  async getPortalView(token: string) {
    const response = await this.api.get(`/portal/view/${token}`);
    return response.data;
  }

  async addPortalComment(token: string, data: { entityType: string; entityId: string; authorName: string; content: string }) {
    const response = await this.api.post(`/portal/view/${token}/comment`, data);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Resource Leveling
  // -------------------------------------------------------------------------

  async getResourceHistogram(scheduleId: string) {
    const response = await this.api.get(`/resource-leveling/${scheduleId}/histogram`);
    return response.data;
  }

  async levelResources(scheduleId: string) {
    const response = await this.api.post(`/resource-leveling/${scheduleId}/level`);
    return response.data;
  }

  async applyResourceLeveling(scheduleId: string, adjustments: any[]) {
    const response = await this.api.post(`/resource-leveling/${scheduleId}/apply`, { adjustments });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // External Integrations
  // -------------------------------------------------------------------------

  async createIntegration(data: { provider: string; config: Record<string, unknown>; projectId?: string }) {
    const response = await this.api.post('/integrations', data);
    return response.data;
  }

  async getIntegrations() {
    const response = await this.api.get('/integrations');
    return response.data;
  }

  async getIntegration(id: string) {
    const response = await this.api.get(`/integrations/${id}`);
    return response.data;
  }

  async updateIntegration(id: string, data: Record<string, unknown>) {
    const response = await this.api.put(`/integrations/${id}`, data);
    return response.data;
  }

  async deleteIntegration(id: string) {
    const response = await this.api.delete(`/integrations/${id}`);
    return response.data;
  }

  async testIntegrationConnection(id: string) {
    const response = await this.api.post(`/integrations/${id}/test`);
    return response.data;
  }

  async syncIntegration(id: string, direction: string) {
    const response = await this.api.post(`/integrations/${id}/sync`, { direction });
    return response.data;
  }

  async getIntegrationSyncLog(id: string) {
    const response = await this.api.get(`/integrations/${id}/log`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Sprint Planning / Agile Mode
  // -------------------------------------------------------------------------

  async createSprint(data: { projectId: string; scheduleId: string; name: string; goal?: string; startDate: string; endDate: string; velocityCommitment?: number }) {
    const response = await this.api.post('/sprints', data);
    return response.data;
  }

  async getSprints(projectId: string) {
    const response = await this.api.get(`/sprints/project/${projectId}`);
    return response.data;
  }

  async getSprint(id: string) {
    const response = await this.api.get(`/sprints/${id}`);
    return response.data;
  }

  async updateSprint(id: string, data: Record<string, unknown>) {
    const response = await this.api.put(`/sprints/${id}`, data);
    return response.data;
  }

  async deleteSprint(id: string) {
    const response = await this.api.delete(`/sprints/${id}`);
    return response.data;
  }

  async addSprintTask(sprintId: string, taskId: string, storyPoints?: number) {
    const response = await this.api.post(`/sprints/${sprintId}/tasks`, { taskId, storyPoints });
    return response.data;
  }

  async removeSprintTask(sprintId: string, taskId: string) {
    const response = await this.api.delete(`/sprints/${sprintId}/tasks/${taskId}`);
    return response.data;
  }

  async startSprint(id: string) {
    const response = await this.api.post(`/sprints/${id}/start`);
    return response.data;
  }

  async completeSprint(id: string) {
    const response = await this.api.post(`/sprints/${id}/complete`);
    return response.data;
  }

  async getSprintBoard(sprintId: string) {
    const response = await this.api.get(`/sprints/${sprintId}/board`);
    return response.data;
  }

  async getSprintBurndown(sprintId: string) {
    const response = await this.api.get(`/sprints/${sprintId}/burndown`);
    return response.data;
  }

  async getVelocityHistory(projectId: string) {
    const response = await this.api.get(`/sprints/velocity/${projectId}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Custom Report Builder
  // -------------------------------------------------------------------------

  async createReportTemplate(data: { name: string; description?: string; config: Record<string, unknown>; isShared?: boolean }) {
    const response = await this.api.post('/report-builder/templates', data);
    return response.data;
  }

  async getReportTemplates() {
    const response = await this.api.get('/report-builder/templates');
    return response.data;
  }

  async getReportTemplate(id: string) {
    const response = await this.api.get(`/report-builder/templates/${id}`);
    return response.data;
  }

  async updateReportTemplate(id: string, data: Record<string, unknown>) {
    const response = await this.api.put(`/report-builder/templates/${id}`, data);
    return response.data;
  }

  async deleteReportTemplate(id: string) {
    const response = await this.api.delete(`/report-builder/templates/${id}`);
    return response.data;
  }

  async generateReportFromTemplate(templateId: string, params?: Record<string, unknown>) {
    const response = await this.api.post(`/report-builder/templates/${templateId}/generate`, params || {});
    return response.data;
  }

  async exportReportFromTemplate(templateId: string, format: string) {
    const response = await this.api.post(`/report-builder/templates/${templateId}/export`, { format });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Project Intake Forms
  // -------------------------------------------------------------------------

  async createIntakeForm(data: { name: string; description?: string; fields: any[] }) {
    const response = await this.api.post('/intake/forms', data);
    return response.data;
  }

  async getIntakeForms() {
    const response = await this.api.get('/intake/forms');
    return response.data;
  }

  async getIntakeForm(id: string) {
    const response = await this.api.get(`/intake/forms/${id}`);
    return response.data;
  }

  async updateIntakeForm(id: string, data: Record<string, unknown>) {
    const response = await this.api.put(`/intake/forms/${id}`, data);
    return response.data;
  }

  async deleteIntakeForm(id: string) {
    const response = await this.api.delete(`/intake/forms/${id}`);
    return response.data;
  }

  async submitIntakeForm(formId: string, values: Record<string, unknown>) {
    const response = await this.api.post(`/intake/forms/${formId}/submit`, { values });
    return response.data;
  }

  async getIntakeSubmissions(formId?: string, status?: string) {
    const params: Record<string, string> = {};
    if (formId) params.formId = formId;
    if (status) params.status = status;
    const response = await this.api.get('/intake/submissions', { params });
    return response.data;
  }

  async getIntakeSubmission(id: string) {
    const response = await this.api.get(`/intake/submissions/${id}`);
    return response.data;
  }

  async reviewIntakeSubmission(id: string, data: { status: string; notes?: string }) {
    const response = await this.api.post(`/intake/submissions/${id}/review`, data);
    return response.data;
  }

  async convertIntakeToProject(submissionId: string) {
    const response = await this.api.post(`/intake/submissions/${submissionId}/convert`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Global Search
  // -------------------------------------------------------------------------

  async search(q: string) {
    const response = await this.api.get('/search', { params: { q } });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // API Keys
  // -------------------------------------------------------------------------

  async createApiKey(data: { name: string; scopes?: string[]; rateLimit?: number; expiresAt?: string }) {
    const response = await this.api.post('/api-keys', data);
    return response.data;
  }

  async listApiKeys() {
    const response = await this.api.get('/api-keys');
    return response.data;
  }

  async revokeApiKey(id: string) {
    const response = await this.api.delete(`/api-keys/${id}`);
    return response.data;
  }

  async getApiKeyUsage(id: string, since?: string) {
    const response = await this.api.get(`/api-keys/${id}/usage`, { params: { since } });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------

  async createWebhook(data: { url: string; events: string[] }) {
    const response = await this.api.post('/webhooks', data);
    return response.data;
  }

  async listWebhooks() {
    const response = await this.api.get('/webhooks');
    return response.data;
  }

  async updateWebhook(id: string, data: { url?: string; events?: string[]; isActive?: boolean }) {
    const response = await this.api.put(`/webhooks/${id}`, data);
    return response.data;
  }

  async deleteWebhook(id: string) {
    const response = await this.api.delete(`/webhooks/${id}`);
    return response.data;
  }

  async testWebhook(id: string) {
    const response = await this.api.post(`/webhooks/${id}/test`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Analytics Summary
  // -------------------------------------------------------------------------

  async getAnalyticsSummary() {
    const response = await this.api.get('/analytics/summary');
    return response.data;
  }

  async getProjectAnalyticsSummary(projectId: string) {
    const response = await this.api.get(`/analytics/summary/project/${projectId}`);
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Bulk Operations
  // -------------------------------------------------------------------------

  async bulkCreateTasks(scheduleId: string, tasks: any[]) {
    const response = await this.api.post('/bulk/tasks', { scheduleId, tasks });
    return response.data;
  }

  async bulkUpdateTasks(updates: Array<{ id: string; scheduleId: string; [key: string]: any }>) {
    const response = await this.api.put('/bulk/tasks', { updates });
    return response.data;
  }

  async bulkUpdateTaskStatus(scheduleId: string, taskIds: string[], status: string) {
    const response = await this.api.put('/bulk/tasks/status', { scheduleId, taskIds, status });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Audit Ledger & Compliance
  // -------------------------------------------------------------------------

  async verifyAuditChain(projectId?: string) {
    const params = projectId ? { projectId } : {};
    const response = await this.api.get('/audit/verify', { params });
    return response.data;
  }

  async getComplianceExport(projectId: string, format: 'csv' | 'pdf' = 'csv', from?: string, to?: string) {
    const params: Record<string, string> = { format };
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await this.api.get(`/audit/${projectId}/compliance-export`, { params });
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Policy Engine
  // -------------------------------------------------------------------------

  async getPolicies(projectId?: string) {
    const params = projectId ? { projectId } : {};
    const response = await this.api.get('/policies', { params });
    return response.data;
  }

  async createPolicy(data: Record<string, unknown>) {
    const response = await this.api.post('/policies', data);
    return response.data;
  }

  async updatePolicy(id: string, data: Record<string, unknown>) {
    const response = await this.api.put(`/policies/${id}`, data);
    return response.data;
  }

  async deletePolicy(id: string) {
    const response = await this.api.delete(`/policies/${id}`);
    return response.data;
  }

  async getPolicyEvaluationStats(projectId?: string, since?: string) {
    const params: Record<string, string> = {};
    if (projectId) params.projectId = projectId;
    if (since) params.since = since;
    const response = await this.api.get('/policies/evaluations/stats', { params });
    return response.data;
  }

  /** Generic request helper for one-off API calls */
  async request(method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) {
    const response = await this.api[method](path, data as any);
    return response.data;
  }
}

export const apiService = new ApiService();
