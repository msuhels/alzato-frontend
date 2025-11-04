import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
 

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const openSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-gray-custom-50">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={openSidebar} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
