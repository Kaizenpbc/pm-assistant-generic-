import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Monitor,
  Building2,
  Landmark,
  Route,
  Layout,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { TemplateCard } from './TemplateCard';
import { TemplatePreview } from './TemplatePreview';
import { TemplateCustomizeForm } from './TemplateCustomizeForm';

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'category' | 'template' | 'preview' | 'customize' | 'scratch';

const categories = [
  { key: 'it', label: 'IT & Software', icon: Monitor, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { key: 'construction', label: 'Construction', icon: Building2, color: 'bg-orange-50 text-orange-600 border-orange-200' },
  { key: 'infrastructure', label: 'Infrastructure', icon: Landmark, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { key: 'roads', label: 'Roads & Bridges', icon: Route, color: 'bg-green-50 text-green-600 border-green-200' },
  { key: 'other', label: 'General', icon: Layout, color: 'bg-gray-50 text-gray-600 border-gray-200' },
];

export const TemplatePicker: React.FC<TemplatePickerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: templatesData } = useQuery({
    queryKey: ['templates', selectedCategory],
    queryFn: () => apiService.getTemplates(selectedCategory || undefined),
    enabled: !!selectedCategory,
  });

  const { data: templateDetail } = useQuery({
    queryKey: ['template', selectedTemplateId],
    queryFn: () => apiService.getTemplate(selectedTemplateId!),
    enabled: !!selectedTemplateId,
  });

  const applyMutation = useMutation({
    mutationFn: (data: {
      templateId: string;
      projectName: string;
      startDate: string;
      budget?: number;
      priority?: string;
      location?: string;
      selectedTaskRefIds?: string[];
    }) => apiService.applyTemplate(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
      resetState();
      navigate(`/project/${result.project.id}`);
    },
    onError: () => {
      setErrorMessage('Failed to create project from template. Please try again.');
    },
  });

  const blankProjectMutation = useMutation({
    mutationFn: (data: {
      name: string;
      status: string;
      priority: string;
      budgetAllocated?: number;
      startDate?: string;
      location?: string;
    }) => apiService.createProject(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
      resetState();
      const projectId = result.project?.id || result.id;
      if (projectId) navigate(`/project/${projectId}`);
    },
    onError: () => {
      setErrorMessage('Failed to create project. Please try again.');
    },
  });

  const templates = templatesData?.templates || [];
  const template = templateDetail?.template;

  const resetState = () => {
    setStep('category');
    setSelectedCategory(null);
    setSelectedTemplateId(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  const handleCategorySelect = (key: string) => {
    setErrorMessage(null);
    if (key === 'scratch') {
      setStep('scratch');
      return;
    }
    setSelectedCategory(key);
    setStep('template');
  };

  const handleTemplateSelect = (id: string) => {
    setErrorMessage(null);
    setSelectedTemplateId(id);
    setStep('customize');
  };

  const handlePreview = (id: string) => {
    setSelectedTemplateId(id);
    setStep('preview');
  };

  const handleCustomize = (data: {
    projectName: string;
    startDate: string;
    budget?: number;
    priority: string;
    location?: string;
    selectedTaskRefIds?: string[];
  }) => {
    setErrorMessage(null);
    if (!selectedTemplateId) return;
    applyMutation.mutate({
      templateId: selectedTemplateId,
      ...data,
    });
  };

  const handleBlankProjectSubmit = (data: {
    projectName: string;
    startDate: string;
    budget?: number;
    priority: string;
    location?: string;
  }) => {
    setErrorMessage(null);
    blankProjectMutation.mutate({
      name: data.projectName,
      status: 'planning',
      priority: data.priority,
      budgetAllocated: data.budget,
      startDate: data.startDate,
      location: data.location,
    });
  };

  if (!isOpen) return null;

  const stepTitles: Record<Step, string> = {
    category: 'New Project',
    template: 'Choose a Template',
    preview: 'Template Preview',
    customize: 'Customize Your Project',
    scratch: 'New Blank Project',
  };

  const stepNumber = step === 'category' ? 0 : (step === 'template' || step === 'preview') ? 1 : 2;
  const stepIndicators = [
    { label: 'Category', active: step === 'category', completed: stepNumber > 0 },
    { label: 'Template', active: step === 'template' || step === 'preview', completed: stepNumber > 1 },
    { label: 'Create', active: step === 'customize' || step === 'scratch', completed: false },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{stepTitles[step]}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              {stepIndicators.map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <div className={`w-6 h-px ${s.completed || s.active ? 'bg-indigo-300' : 'bg-gray-200'}`} />}
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      s.active
                        ? 'bg-indigo-100 text-indigo-700'
                        : s.completed
                          ? 'bg-green-100 text-green-700'
                          : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error banner */}
          {errorMessage && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-700">{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Category Selection */}
          {step === 'category' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleCategorySelect(cat.key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:shadow-md ${cat.color}`}
                  >
                    <Icon className="w-8 h-8" />
                    <span className="text-sm font-medium">{cat.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => handleCategorySelect('scratch')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all"
              >
                <FileText className="w-8 h-8" />
                <span className="text-sm font-medium">Start from Scratch</span>
              </button>
            </div>
          )}

          {/* Step 2: Template Grid */}
          {step === 'template' && (
            <div>
              <button
                onClick={() => { setStep('category'); setSelectedCategory(null); }}
                className="text-xs text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1"
              >
                &larr; Back to categories
              </button>
              {templates.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500">No templates found for this category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {templates.map((t: any) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      onSelect={handleTemplateSelect}
                      onPreview={handlePreview}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2b: Preview */}
          {step === 'preview' && template && (
            <TemplatePreview
              template={template}
              onBack={() => setStep('template')}
              onSelect={() => setStep('customize')}
            />
          )}

          {/* Step 3: Customize */}
          {step === 'customize' && template && (
            <TemplateCustomizeForm
              templateName={template.name}
              estimatedDurationDays={template.estimatedDurationDays}
              phaseCount={template.tasks.filter((t: any) => t.isSummary).length}
              taskCount={template.tasks.filter((t: any) => !t.isSummary).length}
              tasks={template.tasks}
              onBack={() => setStep('template')}
              onSubmit={handleCustomize}
              isSubmitting={applyMutation.isPending}
            />
          )}

          {/* Step 3b: Blank Project */}
          {step === 'scratch' && (
            <TemplateCustomizeForm
              templateName=""
              estimatedDurationDays={0}
              phaseCount={0}
              taskCount={0}
              tasks={[]}
              onBack={() => setStep('category')}
              onSubmit={handleBlankProjectSubmit}
              isSubmitting={blankProjectMutation.isPending}
            />
          )}
        </div>
      </div>
    </div>
  );
};
