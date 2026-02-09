import axios, { AxiosInstance, AxiosResponse } from 'axios';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: 'http://localhost:3002/api/v1',
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
    return fetch('http://localhost:3002/api/v1/ai-chat/stream', {
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
}

export const apiService = new ApiService();
