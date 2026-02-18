import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useProjectStore, useUIStore } from '../stores';
import NotificationBanner from './NotificationBanner';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Plus
} from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  // Check if we are on the simple article generation page
  const isSimplePage = location.pathname === '/articles/new' || location.pathname === '/';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: '儀表板' },
    { path: '/projects', icon: FolderOpen, label: '專案管理' },
    { path: '/articles', icon: FileText, label: '文章列表' },
    { path: '/settings', icon: Settings, label: '設定' },
  ];
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 全域通知橫幅 */}
      <NotificationBanner />

      {/* Sidebar */}
      {!isSimplePage && (
        <aside
          className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 ${sidebarOpen ? 'w-64' : 'w-0'
            } overflow-hidden`}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-primary-600">ContentPilot</h1>
              <button
                onClick={toggleSidebar}
                className="lg:hidden p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <Link
              to="/wizard"
              className="flex items-center justify-center gap-2 w-full mb-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">新增專案</span>
            </Link>

            {/* Current Project */}
            {currentProject && (
              <div className="mb-6 p-3 bg-primary-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">當前專案</p>
                <p className="font-semibold text-sm truncate">{currentProject.name}</p>
              </div>
            )}

            {/* Navigation */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Info & Logout */}
          <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200 bg-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-600 font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>登出</span>
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div
        className={`flex-1 transition-all duration-300 ${!isSimplePage && sidebarOpen ? 'lg:ml-64' : 'ml-0'
          }`}
      >
        {/* Top Bar */}
        {!isSimplePage && (
          <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="px-6 py-4 flex items-center justify-between">
              <button
                onClick={toggleSidebar}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                {currentProject && (
                  <div className="hidden md:block">
                    <p className="text-sm text-gray-600">
                      專案: <span className="font-semibold text-gray-900">{currentProject.name}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {!isSimplePage && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
}
