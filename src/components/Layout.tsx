import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ChatAssistant } from './ChatAssistant';

export function Layout() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
      <ChatAssistant />
    </div>
  );
}
