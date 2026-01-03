
import React, { useState } from 'react';
import { UserRole, AppUser, Notification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: AppUser;
  onLogout: () => void;
  notifications: Notification[];
  onMarkNotificationRead: (id: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentUser, 
  onLogout, 
  notifications, 
  onMarkNotificationRead 
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const relevantNotifications = notifications.filter(n => 
    n.toUserId === currentUser.id || n.toRole === currentUser.role || n.toRole === UserRole.ADMIN
  ).slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                LTS - <span className="text-blue-600">Re-Fueling</span> by YAYA
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-all relative"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsNotifOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden">
                      <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h4 className="font-semibold text-sm text-slate-900">Notifications</h4>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {relevantNotifications.length === 0 ? (
                          <div className="p-6 text-center text-sm text-slate-500 italic">No notifications</div>
                        ) : relevantNotifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => { onMarkNotificationRead(n.id); setIsNotifOpen(false); }}
                            className={`p-4 border-b border-slate-50 cursor-pointer transition-colors ${!n.read ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                          >
                            <p className="text-sm text-slate-800">{n.message}</p>
                            <span className="text-xs text-slate-400 mt-1 block">{new Date(n.timestamp).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200">
                <div className="text-right flex flex-col items-end">
                  <div className="text-[12px] sm:text-sm font-semibold text-slate-900 leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-blue-600 font-medium hidden sm:block uppercase tracking-wider">{currentUser.role.replace('_', ' ')}</div>
                </div>
                <button 
                  onClick={onLogout}
                  className="bg-slate-100 p-2 rounded-lg hover:bg-slate-200 transition-all text-slate-600 hover:text-red-600"
                  title="Logout"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            LTS - Re-Fueling by YAYA &copy; {new Date().getFullYear()} • Efficiency Driven Fleet Management
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
