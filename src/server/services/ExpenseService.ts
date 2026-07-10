import { expenseRepository, type Expense } from '../database/ExpenseRepository';

class ExpenseService {
  async create(data: {
    projectId: string;
    date: string;
    amount: number;
    category: string;
    vendor?: string;
    description?: string;
    receiptAttachmentId?: string;
    createdBy: string;
  }): Promise<Expense> {
    return expenseRepository.create(data);
  }

  async getByProject(projectId: string, startDate?: string, endDate?: string): Promise<Expense[]> {
    return expenseRepository.findByProject(projectId, startDate, endDate);
  }

  async update(id: string, data: Partial<Pick<Expense, 'date' | 'amount' | 'category' | 'vendor' | 'description'>>): Promise<Expense | null> {
    return expenseRepository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return expenseRepository.deleteById(id);
  }

  async getSummaryByCategory(projectId: string) {
    return expenseRepository.getSummaryByCategory(projectId);
  }

  async getMonthlySpend(projectId: string) {
    return expenseRepository.getMonthlySpend(projectId);
  }
}

export const expenseService = new ExpenseService();
