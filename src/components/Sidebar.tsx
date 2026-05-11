import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, LogOut, User as UserIcon, X, Bell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { paymentsService } from '../services/payments';
// Replace branded text+icon with the provided SVG logo

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

const Sidebar = ({ isOpen = false, onClose }: SidebarProps) => {
  const { logout, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  console.log('Sidebar rendered with user:');
  /* [COMMENTED OUT - ORIGINAL FUNCTIONALITY - START]
  useEffect(() => {
    let isMounted = true;

    const fetchUnread = async () => {
      if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
        if (isMounted) setUnreadCount(null);
        return;
      }
      try {
        const res = await paymentsService.getUnreadCount();
        if (isMounted) setUnreadCount(res.total ?? 0);
      } catch (error) {
        // Swallow errors; badge is non-critical UI
        if (isMounted) setUnreadCount(0);
      }
    };

    fetchUnread();
    const handleActivityUpdate = () => fetchUnread();
    window.addEventListener('activityLog:updated', handleActivityUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('activityLog:updated', handleActivityUpdate);
    };
  }, [user]);
  [COMMENTED OUT - ORIGINAL FUNCTIONALITY - END] */

  // [NEW FUNCTIONALITY] - Fetch count of payments from last 24 hours
  useEffect(() => {
    let isMounted = true;

    const fetchLast24HoursCount = async () => {
      if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
        if (isMounted) setUnreadCount(null);
        return;
      }
      try {
        // Calculate date 24 hours ago
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const createdFrom = twentyFourHoursAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD

        const res = await paymentsService.list({
          limit: 100,
          offset: 0,
          created_from: createdFrom
        });
        if (isMounted) setUnreadCount(res.items?.length ?? 0);
      } catch (error) {
        // Swallow errors; badge is non-critical UI
        if (isMounted) setUnreadCount(0);
      }
    };

    fetchLast24HoursCount();
    const handleActivityUpdate = () => fetchLast24HoursCount();
    window.addEventListener('activityLog:updated', handleActivityUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('activityLog:updated', handleActivityUpdate);
    };
  }, [user]);

  const navItems = [
    ...(user?.role === 'admin' ? [{ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' }] : []),
    { icon: Users, label: 'Students', path: '/students' },
    ...(user?.role === 'admin' ? [
      { icon: CreditCard, label: 'Payments', path: '/payments' },
      { icon: Bell, label: 'Updates', path: '/updates' },
    ] : []),
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
                  `flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition-colors ${isActive
                    ? 'bg-primary-light text-primary'
                    : 'text-gray-custom-500 hover:bg-gray-custom-100'
                  }`
                }
                onClick={onClose}
              >
                <item.icon size={20} />
                <span className="flex-1">{item.label}</span>
                {item.label === 'Updates' && (unreadCount ?? 0) > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-2 text-xs font-semibold text-white">
                    {unreadCount && unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
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
          className={`absolute left-0 top-0 h-full transform transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          {content}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
