// React import not needed for JSX with new TS/JSX transform
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, LogOut, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
// Replace branded text+icon with the provided SVG logo

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

const Sidebar = ({ isOpen = false, onClose }: SidebarProps) => {
  const { logout, user } = useAuth();

  const navItems = [
    ...(user?.role === 'admin' ? [{ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' }] : []),
    { icon: Users, label: 'Students', path: '/students' },
    { icon: CreditCard, label: 'Payments', path: '/payments' },
  ];
  const content = (
    <div className="flex h-full w-64 flex-col border-r bg-white p-4">
      <div className="p-4 flex items-center justify-between">
        <img src="/logo/alzato-logo.webp" alt="Alzato logo" className="h-12 w-40 object-contain" />
        {onClose && (
          <button aria-label="Close sidebar" onClick={onClose} className="md:hidden rounded p-2 hover:bg-gray-custom-100">
            <X size={20} />
          </button>
        )}

      </div>
      <nav className="mt-4 flex-1">
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
                onClick={onClose}
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
          <div className="h-10 w-10 rounded-full bg-gray-custom-100 flex items-center justify-center">
            <UserIcon size={20} className="text-gray-custom-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-custom-800">{
              [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User'
            }</p>
          </div>
        </div>
        <button onClick={logout} className="mt-4 flex w-full items-center gap-3 rounded-lg px-4 py-3 font-medium text-gray-custom-500 hover:bg-gray-custom-100">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex">{content}</aside>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-40 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!isOpen}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black transition-opacity ${isOpen ? 'opacity-40' : 'opacity-0'}`}
          onClick={onClose}
        />
        {/* Panel */}
        <div
          className={`absolute left-0 top-0 h-full transform transition-transform ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {content}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
