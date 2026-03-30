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
    <div className={`flex border-b border-gray-200 ${className}`} role="tablist">
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
        px-5 py-3 text-sm font-medium transition-all relative
        ${isActive
          ? 'text-indigo-700 border-b-2 border-indigo-600 -mb-px bg-white'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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

  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      className={`${isActive ? '' : 'hidden print:block'} ${className}`}
    >
      {children}
    </div>
  );
}
