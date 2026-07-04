import { intakeFormRepository } from '../database/IntakeFormRepository';
import { projectService, Project } from './ProjectService';

export interface IntakeFormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface IntakeForm {
  id: string;
  name: string;
  description: string | null;
  fields: IntakeFormField[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeSubmission {
  id: string;
  formId: string;
  submittedBy: string;
  valuesJson: Record<string, any>;
  status: string;
  reviewerId: string | null;
  reviewNotes: string | null;
  convertedProjectId: string | null;
  createdAt: string;
  updatedAt: string;
  formName?: string;
  submitterName?: string;
}

class IntakeFormService {
  async createForm(data: { name: string; description?: string; fields: IntakeFormField[] }, userId: string): Promise<IntakeForm> {
    return intakeFormRepository.createForm(data, userId);
  }

  async getForms(): Promise<IntakeForm[]> {
    return intakeFormRepository.findActiveForms();
  }

  async getFormById(id: string): Promise<IntakeForm | null> {
    return intakeFormRepository.findById(id);
  }

  async updateForm(id: string, data: { name?: string; description?: string; fields?: IntakeFormField[]; isActive?: boolean }): Promise<IntakeForm> {
    return intakeFormRepository.updateForm(id, data);
  }

  async deleteForm(id: string): Promise<void> {
    return intakeFormRepository.deleteForm(id);
  }

  async submitForm(formId: string, values: Record<string, any>, userId: string): Promise<IntakeSubmission> {
    return intakeFormRepository.createSubmission(formId, values, userId);
  }

  async getSubmissions(formId?: string, status?: string): Promise<IntakeSubmission[]> {
    return intakeFormRepository.findSubmissions(formId, status);
  }

  async getSubmissionById(id: string): Promise<IntakeSubmission | null> {
    return intakeFormRepository.findSubmissionById(id);
  }

  async reviewSubmission(id: string, status: string, notes: string, reviewerId: string): Promise<IntakeSubmission> {
    return intakeFormRepository.reviewSubmission(id, status, notes, reviewerId);
  }

  async convertToProject(submissionId: string, userId: string): Promise<Project> {
    const submission = await this.getSubmissionById(submissionId);
    if (!submission) throw new Error('Submission not found');

    const form = await this.getFormById(submission.formId);
    if (!form) throw new Error('Form not found');

    const values = submission.valuesJson;
    let projectName = '';
    let projectDescription = '';

    const nameField = form.fields.find(f =>
      f.label.toLowerCase() === 'name' || f.label.toLowerCase() === 'project name',
    );
    if (nameField && values[nameField.id]) {
      projectName = String(values[nameField.id]);
    } else {
      const firstTextField = form.fields.find(f => f.type === 'text');
      if (firstTextField && values[firstTextField.id]) {
        projectName = String(values[firstTextField.id]);
      } else {
        projectName = `Project from ${form.name}`;
      }
    }

    const descriptionParts = form.fields
      .filter(f => values[f.id] !== undefined && values[f.id] !== null && values[f.id] !== '')
      .map(f => `${f.label}: ${values[f.id]}`);
    projectDescription = descriptionParts.join('\n');

    const project = await projectService.create({
      name: projectName,
      description: projectDescription,
      status: 'planning',
      userId,
    });

    await intakeFormRepository.markConverted(submissionId, project.id);

    return project;
  }
}

export const intakeFormService = new IntakeFormService();
