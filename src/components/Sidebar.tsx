import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AlzatLogo from './AlzatLogo';

const Sidebar = () => {
  const { logout } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Students', path: '/students' },
    { icon: CreditCard, label: 'Payments', path: '/payments' },
  ];

  return (
    <aside className="hidden w-64 flex-col border-r bg-white p-4 md:flex">
      <div className="p-4">
        <AlzatLogo layout="horizontal" size="md" />
      </div>
      <nav className="mt-8 flex-1">
        <ul>
          {navItems.map((item) => (
            <li key={item.label}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-light text-primary'
                      : 'text-gray-custom-500 hover:bg-gray-custom-100'
                  }`
                }
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto">
        <div className="flex items-center gap-3 p-2">
            <img src="https://i.pravatar.cc/150?u=admin" alt="Admin User" className="h-10 w-10 rounded-full" />
            <div>
                <p className="font-semibold text-gray-custom-800">Admin User</p>
                <p className="text-sm text-gray-custom-500">admin@school.com</p>
            </div>
        </div>
         <button onClick={logout} className="mt-4 flex w-full items-center gap-3 rounded-lg px-4 py-3 font-medium text-gray-custom-500 hover:bg-gray-custom-100">
            <LogOut size={20} />
            <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
