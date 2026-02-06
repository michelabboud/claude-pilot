import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Footer } from '../components/Footer';

interface Project {
  name: string;
  observationCount: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  projects: Project[];
  selectedProject: string | null;
  onSelectProject: (name: string | null) => void;
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
  projects,
  selectedProject,
  onSelectProject,
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
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={onSelectProject}
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
        <main className="flex-1 p-6 overflow-y-auto flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
