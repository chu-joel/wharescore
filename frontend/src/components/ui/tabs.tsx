'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue>({ activeTab: '', setActiveTab: () => {} });

export function useTabs() {
  return useContext(TabsContext);
}

interface TabsProps {
  defaultValue: string;
  children: ReactNode;
  className?: string;
  onTabChange?: (tab: string) => void;
}

export function Tabs({ defaultValue, children, className = '', onTabChange }: TabsProps) {
  const [activeTab, setActiveTabState] = useState(defaultValue);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  }, [onTabChange]);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div className={`flex gap-1 p-1 rounded-xl bg-muted/60 border border-border ${className}`} role="tablist">
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className = '' }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={`
        flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200
        ${isActive
          ? 'bg-background text-piq-primary shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
  const { activeTab } = useTabs();
  const isActive = activeTab === value;

  // Use CSS-only hiding (not HTML hidden attribute) so print:block can override
  return (
    <div
      role="tabpanel"
      aria-hidden={!isActive}
      className={`${isActive ? '' : 'hidden print:block'} ${className}`}
    >
      {children}
    </div>
  );
}
