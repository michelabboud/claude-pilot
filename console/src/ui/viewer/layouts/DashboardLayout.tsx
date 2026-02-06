import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  workerStatus: 'online' | 'offline' | 'processing';
  queueDepth?: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleLogs?: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function DashboardLayout({
  children,
  currentPath,
  workerStatus,
  queueDepth,
  theme,
  onToggleTheme,
  onToggleLogs,
  sidebarCollapsed,
  onToggleSidebar,
}: DashboardLayoutProps) {
  const themeName = theme === 'dark' ? 'claude-pilot' : 'claude-pilot-light';

  return (
    <div className="dashboard-layout flex min-h-screen" data-theme={themeName}>
      <Sidebar
        currentPath={currentPath}
        workerStatus={workerStatus}
        queueDepth={queueDepth}
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          theme={theme}
          onToggleTheme={onToggleTheme}
          onToggleLogs={onToggleLogs}
        />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
