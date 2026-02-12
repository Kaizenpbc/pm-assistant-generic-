import axios, { AxiosInstance, AxiosResponse } from 'axios';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: 'http://localhost:3001/api/v1',
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

        // Handle 401 errors (token expired)
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url?.includes('/auth/refresh')
        ) {
          originalRequest._retry = true;

          try {
            // Try to refresh the token
            await this.api.post('/auth/refresh');
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
    const response = await this.api.post('/auth/login', { username, password });
    return response.data;
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

  async getCurrentUser() {
    const response = await this.api.get('/users/me');
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
    return fetch('http://localhost:3001/api/v1/ai-chat/stream', {
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

  async getWorkflows() {
    const response = await this.api.get('/workflows');
    return response.data;
  }

  async getWorkflowExecutions() {
    const response = await this.api.get('/workflows/executions');
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

<div class="footer">PM Assistant - Project Report</div>

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
}

export const apiService = new ApiService();
