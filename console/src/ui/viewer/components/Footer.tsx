import { Icon } from './ui';

export function Footer() {
  return (
    <footer className="mt-auto pt-8 pb-6 px-6 border-t border-base-300/30">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-base-content/40">
        <div className="flex items-center gap-2">
          <Icon icon="lucide:plane" size={14} className="text-primary/60" />
          <span>
            &copy; {new Date().getFullYear()}{' '}
            <a
              href="https://claude-pilot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/70 hover:text-primary transition-colors"
            >
              Claude Pilot
            </a>
          </span>
          <span className="text-base-content/20">|</span>
          <span>
            Created by{' '}
            <a
              href="https://maxritter.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/70 hover:text-primary transition-colors"
            >
              Max Ritter
            </a>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/maxritter/claude-pilot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base-content/40 hover:text-primary transition-colors"
            title="GitHub"
          >
            <Icon icon="lucide:github" size={14} />
          </a>
          <a
            href="https://www.linkedin.com/in/rittermax/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base-content/40 hover:text-primary transition-colors"
            title="LinkedIn"
          >
            <Icon icon="lucide:linkedin" size={14} />
          </a>
          <a
            href="mailto:mail@maxritter.net"
            className="text-base-content/40 hover:text-primary transition-colors"
            title="Email"
          >
            <Icon icon="lucide:mail" size={14} />
          </a>
        </div>
      </div>
    </footer>
  );
}
