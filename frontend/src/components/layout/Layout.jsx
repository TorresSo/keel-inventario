import { Outlet } from 'react-router-dom';

import Notifications from '../ui/Notifications';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 p-5 md:p-6">
          <Outlet />
        </main>
      </div>
      <Notifications />
    </div>
  );
}
