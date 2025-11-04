import { Menu, User } from 'lucide-react';

type HeaderProps = {
  onMenuClick?: () => void;
};

const Header = ({ onMenuClick }: HeaderProps) => {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b bg-white px-4 md:px-8">
      <div className="flex items-center">
        <button
          aria-label="Open sidebar"
          onClick={onMenuClick}
          className="md:hidden rounded p-2 hover:bg-gray-custom-100"
        >
          <Menu size={22} />
        </button>
      </div>
      <div className="flex items-center gap-4">
        {/* <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-custom-400" size={20} />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-64 rounded-lg border bg-gray-custom-50 py-2 pl-10 pr-4 focus:border-primary focus:outline-none"
          />
        </div> */}
        {/* <button className="rounded-full p-2 hover:bg-gray-custom-100">
          <Bell size={24} className="text-gray-custom-500" />
        </button> */}
        <div className="h-10 w-10 rounded-full bg-gray-custom-100 flex items-center justify-center">
          <User className="text-gray-custom-500" size={20} />
        </div>
      </div>
    </header>
  );
};

export default Header;
