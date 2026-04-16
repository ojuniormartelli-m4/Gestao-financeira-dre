import React, { createContext, useContext, useState, useEffect } from 'react';

interface FilterContextType {
  selectedBankId: string;
  setSelectedBankId: (id: string) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedBankId, setSelectedBankId] = useState<string>(() => {
    return localStorage.getItem('finscale_selected_bank') || 'all';
  });

  useEffect(() => {
    localStorage.setItem('finscale_selected_bank', selectedBankId);
  }, [selectedBankId]);

  return (
    <FilterContext.Provider value={{ selectedBankId, setSelectedBankId }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter deve ser usado dentro de um FilterProvider');
  }
  return context;
}
