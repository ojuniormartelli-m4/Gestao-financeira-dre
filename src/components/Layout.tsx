import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ChatAssistant } from './ChatAssistant';
import { useSidebar } from '../contexts/SidebarContext';
import { cn } from '../lib/utils';

export function Layout() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-bg text-text-primary flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-4 lg:p-8 overflow-x-hidden transition-all duration-300",
        isCollapsed ? "lg:ml-[70px]" : "lg:ml-64"
      )}>
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
      <ChatAssistant />
    </div>
  );
}
