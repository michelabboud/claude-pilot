import { TopbarActions } from './TopbarActions';

interface TopbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleLogs?: () => void;
}

export function Topbar({ theme, onToggleTheme, onToggleLogs }: TopbarProps) {
  return (
    <header className="h-14 bg-base-100 border-b border-base-300/50 flex items-center justify-end px-6 gap-4">
      <TopbarActions theme={theme} onToggleTheme={onToggleTheme} onToggleLogs={onToggleLogs} />
    </header>
  );
}
