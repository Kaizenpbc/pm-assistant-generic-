import { FastifyInstance } from 'fastify';

export interface TaskSuggestion {
  id: string;
  name: string;
  description: string;
  estimatedDays: number;
  complexity: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dependencies: string[];
  riskLevel: number;
  suggestedAssignee?: string;
  category: string;
  skills: string[];
  deliverables: string[];
}

export interface ProjectAnalysis {
  projectType: string;
  complexity: 'low' | 'medium' | 'high';
  estimatedDuration: number;
  riskLevel: number;
  suggestedPhases: any[];
  taskSuggestions: TaskSuggestion[];
  criticalPath: string[];
  resourceRequirements: {
    developers?: number;
    designers?: number;
    testers?: number;
    managers?: number;
  };
}

export class FallbackTaskBreakdownService {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async analyzeProject(projectDescription: string, projectType?: string): Promise<ProjectAnalysis> {
    try {
      const analysis = await this.extractProjectInfo(projectDescription);
      const taskData = await this.generateTaskSuggestions(analysis, projectType);

      const complexity = this.calculateProjectComplexity(taskData.tasks);
      const riskLevel = this.calculateRiskLevel(taskData.tasks);
      const criticalPath = this.identifyCriticalPath(taskData.tasks);
      const resourceRequirements = this.estimateResourceRequirements(taskData.tasks);
      const estimatedDuration = this.calculateEstimatedDuration(taskData.tasks);

      return {
        projectType: analysis.projectType,
        complexity,
        estimatedDuration,
        riskLevel,
        suggestedPhases: taskData.phases,
        taskSuggestions: taskData.tasks,
        criticalPath,
        resourceRequirements,
      };
    } catch (error) {
      this.fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error in fallback task breakdown');
      throw new Error('Failed to analyze project for task breakdown');
    }
  }

  private async extractProjectInfo(description: string) {
    const keywords = (description || '').toLowerCase();

    const projectTypeScores: Record<string, number> = {
      construction_project: 0,
      mobile_app: 0,
      web_application: 0,
      backend_service: 0,
      data_project: 0,
      design_project: 0,
      e_commerce: 0,
      game_development: 0,
      iot_project: 0,
      ai_ml_project: 0
    };

    if (keywords.includes('mobile app') || keywords.includes('app development') ||
        keywords.includes('ios') || keywords.includes('android') ||
        keywords.includes('react native') || keywords.includes('flutter')) {
      projectTypeScores.mobile_app += 3;
    }
    if (keywords.includes('restaurant') || keywords.includes('ordering') ||
        keywords.includes('delivery') || keywords.includes('food')) {
      projectTypeScores.mobile_app += 2;
    }
    if (keywords.includes('web') || keywords.includes('website') ||
        keywords.includes('react') || keywords.includes('vue') ||
        keywords.includes('angular') || keywords.includes('frontend')) {
      projectTypeScores.web_application += 3;
    }
    if (keywords.includes('e-commerce') || keywords.includes('shopping') ||
        keywords.includes('store') || keywords.includes('payment')) {
      projectTypeScores.e_commerce += 2;
      projectTypeScores.web_application += 1;
    }
    if (keywords.includes('api') || keywords.includes('backend') ||
        keywords.includes('microservice') || keywords.includes('server')) {
      projectTypeScores.backend_service += 3;
    }
    if (keywords.includes('database') || keywords.includes('data') ||
        keywords.includes('analytics') || keywords.includes('reporting') ||
        keywords.includes('dashboard') || keywords.includes('visualization')) {
      projectTypeScores.data_project += 3;
    }
    if (keywords.includes('ai') || keywords.includes('machine learning') ||
        keywords.includes('ml') || keywords.includes('artificial intelligence') ||
        keywords.includes('neural') || keywords.includes('model')) {
      projectTypeScores.ai_ml_project += 3;
    }
    if (keywords.includes('design') || keywords.includes('ui/ux') ||
        keywords.includes('wireframe') || keywords.includes('prototype')) {
      projectTypeScores.design_project += 3;
    }
    if (keywords.includes('game') || keywords.includes('gaming') ||
        keywords.includes('unity') || keywords.includes('unreal')) {
      projectTypeScores.game_development += 3;
    }
    if (keywords.includes('iot') || keywords.includes('internet of things') ||
        keywords.includes('sensor') || keywords.includes('embedded')) {
      projectTypeScores.iot_project += 3;
    }
    if (keywords.includes('construction') || keywords.includes('building') ||
        keywords.includes('infrastructure') || keywords.includes('civil') ||
        keywords.includes('architectural') || keywords.includes('contractor') ||
        keywords.includes('foundation') || keywords.includes('structural') ||
        keywords.includes('permits') || keywords.includes('site') ||
        keywords.includes('excavation') || keywords.includes('mep')) {
      projectTypeScores.construction_project += 4;
    }

    const projectType = Object.keys(projectTypeScores).reduce((a, b) =>
      projectTypeScores[a] > projectTypeScores[b] ? a : b
    );

    const phases: string[] = [];
    if (keywords.includes('planning') || keywords.includes('requirements')) phases.push('Planning & Requirements');
    if (keywords.includes('design') || keywords.includes('ui') || keywords.includes('ux')) phases.push('Design');
    if (keywords.includes('development') || keywords.includes('coding') || keywords.includes('implementation')) phases.push('Development');
    if (keywords.includes('testing') || keywords.includes('qa') || keywords.includes('quality')) phases.push('Testing & QA');
    if (keywords.includes('deployment') || keywords.includes('launch') || keywords.includes('release')) phases.push('Deployment & Launch');

    return { projectType, phases };
  }

  private async generateTaskSuggestions(analysis: any, projectType?: string): Promise<{ tasks: TaskSuggestion[], phases: any[] }> {
    const baseTasks = this.getBaseTasksForType(analysis.projectType || projectType);
    const customizedTasks = baseTasks.map(task => ({
      ...task,
      id: `${task.id}_${Date.now()}`,
    }));
    return this.organizeDefaultPhases(customizedTasks);
  }

  private organizeDefaultPhases(tasks: TaskSuggestion[]): { tasks: TaskSuggestion[], phases: any[] } {
    type PhaseGroup = { id: string; name: string; description: string; estimatedDays: number; tasks: TaskSuggestion[] };
    const phases: PhaseGroup[] = [
      { id: 'planning-phase', name: 'Planning Phase', description: 'Requirements analysis and project planning', estimatedDays: 0, tasks: [] },
      { id: 'development-phase', name: 'Development Phase', description: 'Main development and implementation work', estimatedDays: 0, tasks: [] },
      { id: 'testing-phase', name: 'Testing Phase', description: 'Testing, QA, and quality assurance', estimatedDays: 0, tasks: [] },
      { id: 'deployment-phase', name: 'Deployment Phase', description: 'Deployment and project handover', estimatedDays: 0, tasks: [] },
    ];

    tasks.forEach(task => {
      const category = task.category?.toLowerCase() || '';
      if (category.includes('planning') || category.includes('requirements') || category.includes('design')) {
        phases[0].tasks.push(task); phases[0].estimatedDays += task.estimatedDays;
      } else if (category.includes('development') || category.includes('implementation') || category.includes('coding')) {
        phases[1].tasks.push(task); phases[1].estimatedDays += task.estimatedDays;
      } else if (category.includes('testing') || category.includes('qa') || category.includes('quality')) {
        phases[2].tasks.push(task); phases[2].estimatedDays += task.estimatedDays;
      } else if (category.includes('deployment') || category.includes('launch') || category.includes('handover')) {
        phases[3].tasks.push(task); phases[3].estimatedDays += task.estimatedDays;
      } else {
        phases[1].tasks.push(task); phases[1].estimatedDays += task.estimatedDays;
      }
    });

    return { tasks, phases: phases.filter(p => p.tasks.length > 0) };
  }

  private getBaseTasksForType(projectType: string): TaskSuggestion[] {
    const taskTemplates: Record<string, TaskSuggestion[]> = {
      mobile_app: [
        { id: 'requirements', name: 'Requirements Analysis', description: 'Gather and analyze user requirements', estimatedDays: 3, complexity: 'medium', priority: 'high', dependencies: [], riskLevel: 20, category: 'Planning', skills: ['Business Analysis'], deliverables: ['Requirements Document'] },
        { id: 'ui_design', name: 'UI/UX Design', description: 'Create wireframes, mockups, and designs', estimatedDays: 5, complexity: 'high', priority: 'high', dependencies: ['requirements'], riskLevel: 30, category: 'Design', skills: ['UI/UX Design'], deliverables: ['Wireframes', 'Mockups'] },
        { id: 'backend_api', name: 'Backend API Development', description: 'Develop server-side APIs', estimatedDays: 8, complexity: 'high', priority: 'high', dependencies: ['requirements'], riskLevel: 40, category: 'Development', skills: ['Backend Development'], deliverables: ['API Endpoints'] },
        { id: 'frontend', name: 'Frontend Development', description: 'Develop mobile app frontend', estimatedDays: 10, complexity: 'high', priority: 'high', dependencies: ['ui_design', 'backend_api'], riskLevel: 35, category: 'Development', skills: ['Mobile Development'], deliverables: ['Mobile App'] },
        { id: 'testing', name: 'Testing & QA', description: 'Comprehensive testing', estimatedDays: 4, complexity: 'medium', priority: 'high', dependencies: ['frontend'], riskLevel: 25, category: 'Testing', skills: ['Testing', 'QA'], deliverables: ['Test Cases'] },
        { id: 'deployment', name: 'Deployment & Launch', description: 'Deploy to app stores', estimatedDays: 2, complexity: 'medium', priority: 'high', dependencies: ['testing'], riskLevel: 30, category: 'Deployment', skills: ['DevOps'], deliverables: ['Production App'] },
      ],
      web_application: [
        { id: 'requirements', name: 'Requirements Analysis', description: 'Gather web application requirements', estimatedDays: 2, complexity: 'medium', priority: 'high', dependencies: [], riskLevel: 15, category: 'Planning', skills: ['Business Analysis'], deliverables: ['Requirements Document'] },
        { id: 'ui_design', name: 'UI/UX Design', description: 'Create web application designs', estimatedDays: 4, complexity: 'medium', priority: 'high', dependencies: ['requirements'], riskLevel: 25, category: 'Design', skills: ['UI/UX Design', 'Web Design'], deliverables: ['Wireframes', 'Mockups'] },
        { id: 'backend', name: 'Backend Development', description: 'Develop server-side logic and APIs', estimatedDays: 6, complexity: 'high', priority: 'high', dependencies: ['requirements'], riskLevel: 35, category: 'Development', skills: ['Backend Development'], deliverables: ['Backend Services'] },
        { id: 'frontend', name: 'Frontend Development', description: 'Develop responsive web frontend', estimatedDays: 7, complexity: 'high', priority: 'high', dependencies: ['ui_design', 'backend'], riskLevel: 30, category: 'Development', skills: ['Frontend Development'], deliverables: ['Web Application'] },
        { id: 'testing', name: 'Testing & QA', description: 'Comprehensive testing including cross-browser', estimatedDays: 3, complexity: 'medium', priority: 'high', dependencies: ['frontend'], riskLevel: 20, category: 'Testing', skills: ['Testing', 'QA'], deliverables: ['Test Cases'] },
        { id: 'deployment', name: 'Deployment & Launch', description: 'Deploy to production', estimatedDays: 1, complexity: 'low', priority: 'high', dependencies: ['testing'], riskLevel: 25, category: 'Deployment', skills: ['DevOps'], deliverables: ['Production Website'] },
      ],
      construction_project: [
        { id: 'site_survey', name: 'Site Survey & Analysis', description: 'Conduct comprehensive site survey', estimatedDays: 5, complexity: 'high', priority: 'high', dependencies: [], riskLevel: 25, category: 'Planning', skills: ['Civil Engineering', 'Surveying'], deliverables: ['Site Survey Report'] },
        { id: 'permits', name: 'Permits & Regulatory Approvals', description: 'Obtain building permits and clearances', estimatedDays: 15, complexity: 'high', priority: 'high', dependencies: ['site_survey'], riskLevel: 40, category: 'Planning', skills: ['Regulatory Compliance'], deliverables: ['Building Permits'] },
        { id: 'design', name: 'Architectural Design & Engineering', description: 'Develop architectural plans and engineering designs', estimatedDays: 20, complexity: 'high', priority: 'high', dependencies: ['site_survey'], riskLevel: 30, category: 'Design', skills: ['Architecture', 'Structural Engineering'], deliverables: ['Architectural Plans'] },
        { id: 'procurement', name: 'Material Procurement', description: 'Source and procure construction materials', estimatedDays: 10, complexity: 'medium', priority: 'high', dependencies: ['design'], riskLevel: 35, category: 'Development', skills: ['Procurement'], deliverables: ['Material Contracts'] },
        { id: 'site_prep', name: 'Site Preparation', description: 'Clear site and prepare for construction', estimatedDays: 8, complexity: 'medium', priority: 'high', dependencies: ['permits', 'procurement'], riskLevel: 30, category: 'Development', skills: ['Excavation'], deliverables: ['Prepared Site'] },
        { id: 'foundation', name: 'Foundation Construction', description: 'Pour concrete foundation', estimatedDays: 12, complexity: 'high', priority: 'high', dependencies: ['site_prep'], riskLevel: 35, category: 'Development', skills: ['Concrete Work'], deliverables: ['Concrete Foundation'] },
        { id: 'structural', name: 'Structural Framing', description: 'Erect structural frame and roofing', estimatedDays: 15, complexity: 'high', priority: 'high', dependencies: ['foundation'], riskLevel: 40, category: 'Development', skills: ['Structural Framing'], deliverables: ['Structural Frame'] },
        { id: 'mep', name: 'MEP Systems Installation', description: 'Install mechanical, electrical, and plumbing', estimatedDays: 18, complexity: 'high', priority: 'high', dependencies: ['structural'], riskLevel: 35, category: 'Development', skills: ['Electrical', 'Plumbing', 'HVAC'], deliverables: ['MEP Systems'] },
        { id: 'finishing', name: 'Interior & Exterior Finishing', description: 'Complete interior and exterior finishes', estimatedDays: 20, complexity: 'medium', priority: 'medium', dependencies: ['mep'], riskLevel: 25, category: 'Development', skills: ['Interior Finishing'], deliverables: ['Finished Building'] },
        { id: 'testing_commissioning', name: 'Testing & Commissioning', description: 'Test all systems and inspect', estimatedDays: 5, complexity: 'high', priority: 'high', dependencies: ['finishing'], riskLevel: 30, category: 'Testing', skills: ['Systems Testing'], deliverables: ['Test Reports'] },
        { id: 'handover', name: 'Final Inspection & Handover', description: 'Final inspections and client handover', estimatedDays: 3, complexity: 'medium', priority: 'high', dependencies: ['testing_commissioning'], riskLevel: 25, category: 'Deployment', skills: ['Inspection'], deliverables: ['Certificate of Occupancy'] },
      ],
    };

    return taskTemplates[projectType] || taskTemplates.mobile_app;
  }

  private calculateProjectComplexity(tasks: TaskSuggestion[]): 'low' | 'medium' | 'high' {
    const highCount = tasks.filter(t => t.complexity === 'high').length;
    if (highCount / tasks.length > 0.6) return 'high';
    if (highCount / tasks.length > 0.3) return 'medium';
    return 'low';
  }

  private calculateRiskLevel(tasks: TaskSuggestion[]): number {
    return Math.round(tasks.reduce((sum, t) => sum + t.riskLevel, 0) / tasks.length);
  }

  private identifyCriticalPath(tasks: TaskSuggestion[]): string[] {
    return tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').map(t => t.id);
  }

  private estimateResourceRequirements(tasks: TaskSuggestion[]) {
    const req = { developers: 0, designers: 0, testers: 0, managers: 0 };
    tasks.forEach(task => {
      if (task.skills.some(s => s.includes('Development') || s.includes('Programming'))) req.developers += Math.ceil(task.estimatedDays / 5);
      if (task.skills.some(s => s.includes('Design') || s.includes('UI/UX'))) req.designers += Math.ceil(task.estimatedDays / 3);
      if (task.skills.some(s => s.includes('Testing') || s.includes('QA'))) req.testers += Math.ceil(task.estimatedDays / 4);
      if (task.skills.some(s => s.includes('Management') || s.includes('Analysis'))) req.managers += Math.ceil(task.estimatedDays / 7);
    });
    return req;
  }

  private calculateEstimatedDuration(tasks: TaskSuggestion[]): number {
    return tasks.reduce((sum, t) => sum + t.estimatedDays, 0);
  }
}

export const AITaskBreakdownService = FallbackTaskBreakdownService;
