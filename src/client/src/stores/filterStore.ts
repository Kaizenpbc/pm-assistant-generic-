import { create } from 'zustand';

interface FilterState {
  selectedPortfolioId: string | null;
  selectedPmUserId: string | null;

  setPortfolioFilter: (id: string | null) => void;
  setPmFilter: (id: string | null) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>()((set) => ({
  selectedPortfolioId: null,
  selectedPmUserId: null,

  setPortfolioFilter: (id) =>
    set({
      selectedPortfolioId: id,
      selectedPmUserId: null, // reset PM filter when portfolio changes
    }),

  setPmFilter: (id) => set({ selectedPmUserId: id }),

  clearFilters: () =>
    set({
      selectedPortfolioId: null,
      selectedPmUserId: null,
    }),
}));
