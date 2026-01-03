
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  UserRole, 
  FuelRequest, 
  RequestStatus, 
  Notification, 
  AppUser,
  ChatMessage 
} from './types';
import { 
  INITIAL_USERS, 
  STORAGE_KEYS
} from './constants';
import Layout from './components/Layout';
import { analyzeFuelingTrends } from './services/geminiService';

// Thresholds for abnormal usage
const ALERT_THRESHOLDS = {
  MIN_DISTANCE: 30, // KM
  MIN_HOURS_BETWEEN: 12, // Hours
};

const App = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [requests, setRequests] = useState<FuelRequest[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REQUESTS);
    return saved ? JSON.parse(saved) : [];
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return saved ? JSON.parse(saved) : [];
  });

  // UI & Filter State
  const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'summary'>('requests');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<FuelRequest | null>(null);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<FuelRequest | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Filtering States for List View
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'ALL'>('ALL');

  // Persist State
  useEffect(() => localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests)), [requests]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications)), [notifications]);
  useEffect(() => {
    if (currentUser) localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    else localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }, [currentUser]);

  // Monitor for 10-minute delays
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      requests.forEach(req => {
        const diffMinutes = (now - req.updatedAt) / (1000 * 60);

        if (req.status === RequestStatus.PM_APPROVED && diffMinutes >= 10) {
          const alreadyNotified = notifications.some(n => n.requestId === req.id && n.message.includes("Admin Delay"));
          if (!alreadyNotified) {
            addNotification('', UserRole.PM, `Admin Delay: Request ${req.id} is pending dispatch for >10 mins`, req.id);
          }
        }

        if (req.status === RequestStatus.ADMIN_PROCESSED && diffMinutes >= 10) {
          const alreadyNotified = notifications.some(n => n.requestId === req.id && n.message.includes("Verification Pending"));
          if (!alreadyNotified) {
            addNotification(req.userId, UserRole.USER, `Verification Pending: Please upload fueling photos for ${req.id}`, req.id);
          }
        }
      });
    }, 60000);

    return () => clearInterval(timer);
  }, [requests, notifications]);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const u = fd.get('username') as string;
    const p = fd.get('password') as string;
    
    const user = users.find(x => x.username === u && x.password === p);
    if (user) {
      if (user.blocked) {
        setLoginError('Your account has been blocked. Please contact admin.');
        return;
      }
      setCurrentUser(user);
      setLoginError('');
      setActiveTab('requests');
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const userData = {
      name: fd.get('name') as string,
      username: fd.get('username') as string,
      password: fd.get('password') as string || '123',
      role: fd.get('role') as UserRole,
      email: fd.get('email') as string,
    };

    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...userData } : u));
      if (currentUser?.id === editingUser.id) {
        setCurrentUser(prev => prev ? { ...prev, ...userData } : null);
      }
    } else {
      const newUser: AppUser = {
        id: Math.random().toString(36).substr(2, 9),
        blocked: false,
        muted: false,
        ...userData
      };
      setUsers([...users, newUser]);
    }
    
    setIsUserFormOpen(false);
    setEditingUser(null);
  };

  const handleEditUser = (user: AppUser) => {
    setEditingUser(user);
    setIsUserFormOpen(true);
  };

  const handleToggleBlock = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, blocked: !u.blocked } : u));
  };

  const addNotification = (toUserId: string, toRole: UserRole, message: string, requestId: string, isChat = false) => {
    const newNotif: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      toUserId, toRole, message, requestId, read: false, timestamp: Date.now(), isChat
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleSaveRequest = (data: Partial<FuelRequest>) => {
    if (!currentUser) return;
    
    if (editingRequest) {
      const isRejected = editingRequest.status === RequestStatus.REJECTED;
      const timeElapsed = Date.now() - editingRequest.createdAt;
      
      if (!isRejected && timeElapsed > 5 * 60 * 1000) {
        alert("This request is locked and can no longer be edited.");
        return;
      }

      setRequests(prev => prev.map(r => r.id === editingRequest.id ? { 
        ...r, 
        ...data, 
        status: RequestStatus.PENDING,
        updatedAt: Date.now() 
      } : r));
      addNotification('', UserRole.PM, `${currentUser.name} resubmitted request ${editingRequest.id}`, editingRequest.id);
    } else {
      const newRequest: FuelRequest = {
        id: `REQ-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        status: RequestStatus.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        chatMessages: [],
        chatDisabled: false,
        ...data as any
      };
      setRequests(prev => [newRequest, ...prev]);
      addNotification('', UserRole.PM, `New request from ${currentUser.name}`, newRequest.id);
    }
    
    setIsFormOpen(false);
    setEditingRequest(null);
  };

  const updateStatus = (id: string, update: Partial<FuelRequest>) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...update, updatedAt: Date.now() } : r));
    if (selectedRequest?.id === id) {
      setSelectedRequest(prev => prev ? { ...prev, ...update } : null);
    }
  };

  const handleAddRequestMessage = (requestId: string, text?: string, image?: string) => {
    if (!currentUser) return;
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      text,
      image,
      timestamp: Date.now()
    };
    
    setRequests(prev => prev.map(r => {
      if (r.id === requestId) {
        const msgs = [...(r.chatMessages || []), newMessage];
        return { ...r, chatMessages: msgs, updatedAt: Date.now() };
      }
      return r;
    }));

    if (selectedRequest?.id === requestId) {
      setSelectedRequest(prev => prev ? {
        ...prev,
        chatMessages: [...(prev.chatMessages || []), newMessage]
      } : null);
    }

    const req = requests.find(r => r.id === requestId);
    if (req) {
      if (currentUser.role === UserRole.USER) {
        addNotification('', UserRole.PM, `New message on ${requestId} from ${currentUser.name}`, requestId, true);
      } else {
        addNotification(req.userId, UserRole.USER, `New management message on ${requestId}`, requestId, true);
      }
    }
  };

  const handleVerificationUpload = (id: string, images: string[]) => {
    updateStatus(id, { 
      status: RequestStatus.VERIFICATION_SUBMITTED, 
      postFuelingImages: images 
    });
    addNotification('', UserRole.ADMIN, `User uploaded verification photos for ${id}`, id);
  };

  const handleRunAiAnalysis = async () => {
    setLoadingAi(true);
    const result = await analyzeFuelingTrends(requests);
    setLoadingAi(false);
    if (result) alert(result);
  };

  const handleExportRequests = () => {
    const headers = ['ID', 'Date', 'Status', 'User', 'Plate', 'Project', 'Region', 'Prev Mi', 'New Mi', 'Diff', 'Last L', 'Req L', 'Station', 'PM Note', 'Admin Reply'];
    const rows = filteredRequests.map(r => [
      r.id, r.date, r.status, r.userName, r.plateNumber, r.projectName, r.region,
      r.lastMileage, r.newMileage, (r.newMileage - r.lastMileage),
      r.lastRequestLiters, r.newRequestLiters,
      r.stationName, (r.pmNote || '').replace(/,/g, ';'), (r.adminReplyData || '').replace(/,/g, ';')
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `FuelRequests_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getAlertStatus = (req: FuelRequest) => {
    const prev = requests
      .filter(r => r.plateNumber.toLowerCase() === req.plateNumber.toLowerCase() && r.createdAt < req.createdAt)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    const alerts = [];
    const dist = req.newMileage - req.lastMileage;
    if (dist < ALERT_THRESHOLDS.MIN_DISTANCE) {
      alerts.push("Mileage Increase Too Small (<30KM)");
    }
    if (prev) {
      const hoursDiff = (req.createdAt - prev.createdAt) / (1000 * 60 * 60);
      if (hoursDiff < ALERT_THRESHOLDS.MIN_HOURS_BETWEEN) {
        alerts.push("Fuel Request Too Frequent (<12h)");
      }
    }
    return alerts;
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 sm:px-10 shadow-lg rounded-2xl border border-slate-200">
            <div className="flex flex-col items-center mb-8">
              <div className="bg-blue-600 p-3 rounded-xl mb-4 shadow-blue-200 shadow-lg">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight text-center">
                LTS - <span className="text-blue-600">Re-Fueling</span> by YAYA
              </h2>
              <p className="text-slate-500 text-sm mt-1">Enterprise Fleet Portal</p>
            </div>
            
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input name="username" required className="appearance-none block w-full px-4 py-2.5 border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input name="password" type="password" required className="appearance-none block w-full px-4 py-2.5 border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              {loginError && <p className="text-red-600 text-xs font-medium text-center bg-red-50 py-2 rounded-md">{loginError}</p>}
              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all font-semibold active:scale-95">
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const isManagement = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PM;
  
  let filteredRequests = currentUser.role === UserRole.USER 
    ? requests.filter(r => r.userId === currentUser.id) 
    : requests;

  if (isManagement) {
    filteredRequests = filteredRequests.filter(req => {
      const matchesSearch = 
        req.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = 
        (!startDate || req.date >= startDate) && 
        (!endDate || req.date <= endDate);

      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;

      return matchesSearch && matchesDate && matchesStatus;
    });
  }

  return (
    <Layout 
      currentUser={currentUser} 
      onLogout={() => setCurrentUser(null)}
      notifications={notifications}
      onMarkNotificationRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            📋 <span className="hidden sm:inline">Fuel Requests</span><span className="sm:hidden">Requests</span>
          </button>
          {isManagement && (
            <>
              <button 
                onClick={() => setActiveTab('summary')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'summary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                📊 <span className="hidden sm:inline">Performance Summary</span><span className="sm:hidden">Summary</span>
              </button>
              <button 
                onClick={() => setActiveTab('users')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                👥 <span className="hidden sm:inline">Directory</span><span className="sm:hidden">Users</span>
              </button>
            </>
          )}
        </div>

        {activeTab === 'summary' && isManagement ? (
          <MonthlySummary requests={requests} />
        ) : activeTab === 'users' ? (
          <UserManagementList 
            users={users} 
            currentUser={currentUser} 
            onEditUser={handleEditUser} 
            onToggleBlock={handleToggleBlock}
          />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {currentUser.role === UserRole.USER ? 'My Fuel Logs' : 'Fleet Dashboard'}
              </h1>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {isManagement && (
                  <>
                    <button onClick={handleRunAiAnalysis} disabled={loadingAi} className="flex-1 sm:flex-none bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 disabled:opacity-50 transition-all">
                      {loadingAi ? '⌛ Analyzing...' : '✨ AI Analysis'}
                    </button>
                    <button onClick={handleExportRequests} className="flex-1 sm:flex-none bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-all">
                      📥 Export Dashboard
                    </button>
                  </>
                )}
                {currentUser.role === UserRole.USER && (
                  <button onClick={() => { setEditingRequest(null); setIsFormOpen(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 flex items-center justify-center gap-2 transition-all active:scale-95">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    New Request
                  </button>
                )}
              </div>
            </div>

            {isManagement && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Search Fleet</label>
                  <input 
                    type="text" 
                    placeholder="Plate, Project, or User" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                  <select 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value as any)} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    {Object.values(RequestStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none" />
                </div>
              </div>
            )}

            {/* Request Cards Grid - Mobile Friendly */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequests.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
                  No fueling records found matching filters.
                </div>
              ) : filteredRequests.map(req => {
                const dist = req.newMileage - req.lastMileage;
                const alerts = getAlertStatus(req);
                const isRejected = req.status === RequestStatus.REJECTED;
                const isPending = req.status === RequestStatus.PENDING;
                
                const isEditable = currentUser.role === UserRole.USER && 
                                  ( (isPending && (Date.now() - req.createdAt < 5 * 60 * 1000)) || isRejected );

                return (
                  <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{req.date}</span>
                          <h3 className="font-bold text-slate-900 leading-tight">{req.plateNumber}</h3>
                        </div>
                        <StatusBadge status={req.status} hasAlert={alerts.length > 0} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 my-4">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Interval</span>
                          <div className="text-sm font-black text-slate-700">{dist} KM</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Amount</span>
                          <div className="text-sm font-black text-slate-700">{req.newRequestLiters} L</div>
                        </div>
                      </div>

                      {alerts.length > 0 && req.status !== RequestStatus.REJECTED && (
                        <div className="mb-4 bg-red-50 text-red-600 text-[9px] font-bold p-2 rounded border border-red-100">
                           {alerts.map((a, i) => <div key={i}>⚠ {a}</div>)}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-2">
                      {isEditable && (
                        <button onClick={() => { setEditingRequest(req); setIsFormOpen(true); }} className="flex-1 text-[11px] font-bold bg-blue-50 text-blue-600 px-3 py-2 rounded-lg border border-blue-100 transition-colors hover:bg-blue-100">
                          {isRejected ? 'Edit & Resubmit' : 'Quick Edit'}
                        </button>
                      )}
                      <button onClick={() => setSelectedRequest(req)} className="flex-1 text-[11px] font-bold bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
                        Track Audit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Forms */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setIsFormOpen(false); setEditingRequest(null); }}></div>
          <div className="bg-white rounded-none sm:rounded-2xl w-full max-w-xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto z-[70] shadow-2xl p-6 sm:p-8">
            <FuelRequestForm initialData={editingRequest} onSubmit={handleSaveRequest} onCancel={() => { setIsFormOpen(false); setEditingRequest(null); }} />
          </div>
        </div>
      )}

      {isUserFormOpen && isManagement && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }}></div>
          <div className="bg-white rounded-xl w-full max-w-md z-[70] shadow-2xl p-8 border border-slate-200">
            <h3 className="text-xl font-bold mb-6 text-slate-900">{editingUser ? 'Edit User' : 'Add New User'}</h3>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <FormInput label="Name" name="name" defaultValue={editingUser?.name} required />
              <FormInput label="Username" name="username" defaultValue={editingUser?.username} required />
              <FormInput label="Password" name="password" type="text" defaultValue={editingUser?.password} required />
              <FormInput label="Email" name="email" type="email" defaultValue={editingUser?.email} required />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 font-bold">Role</label>
                <select name="role" defaultValue={editingUser?.role || UserRole.USER} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm">
                  <option value={UserRole.USER}>Standard User (Driver)</option>
                  <option value={UserRole.PM}>Project Manager</option>
                  <option value={UserRole.ADMIN}>Administrator</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                 <button type="button" onClick={() => { setIsUserFormOpen(false); setEditingUser(null); }} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-lg font-bold">Cancel</button>
                 <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow transition-all uppercase text-xs">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRequest && (
        <RequestDetailsView 
          request={selectedRequest} 
          allRequests={requests}
          currentUser={currentUser}
          onClose={() => setSelectedRequest(null)}
          onUpdateStatus={updateStatus}
          onVerify={handleVerificationUpload}
          onAddNotification={addNotification}
          alerts={getAlertStatus(selectedRequest)}
          onSendMessage={(text?: string, img?: string) => handleAddRequestMessage(selectedRequest.id, text, img)}
        />
      )}
    </Layout>
  );
};

const UserManagementList = ({ users, currentUser, onEditUser, onToggleBlock }: any) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <div className="overflow-x-auto">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-bold text-slate-900">User Directory</h3>
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-6 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">User</th>
            <th className="px-6 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Role</th>
            <th className="px-6 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-right font-semibold text-slate-500 uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u: any) => (
            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4">
                <div className="font-medium text-slate-900">{u.name}</div>
                <div className="text-xs text-slate-500">@{u.username}</div>
              </td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                  {u.role.replace('_', ' ')}
                </span>
              </td>
              <td className="px-6 py-4">
                {u.blocked ? (
                  <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">Blocked</span>
                ) : (
                  <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700 border border-green-200">Active</span>
                )}
              </td>
              <td className="px-6 py-4 text-right flex justify-end gap-3">
                <button 
                  onClick={() => onEditUser(u)} 
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase"
                >
                  Edit
                </button>
                {u.id !== currentUser.id && (
                  <button 
                    onClick={() => onToggleBlock(u.id)} 
                    className={`text-xs font-bold uppercase transition-colors ${u.blocked ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'}`}
                  >
                    {u.blocked ? 'Unblock' : 'Block'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const MonthlySummary = ({ requests }: { requests: FuelRequest[] }) => {
  const [filters, setFilters] = useState({
    month: new Date().toISOString().slice(0, 7),
    vehicle: '',
    project: '',
    region: '',
    startDate: '',
    endDate: '',
  });

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (r.status === RequestStatus.REJECTED) return false;
      
      const inMonth = !filters.startDate && !filters.endDate && r.date.startsWith(filters.month);
      const inRange = (!filters.startDate || r.date >= filters.startDate) && (!filters.endDate || r.date <= filters.endDate);
      const matchVehicle = !filters.vehicle || r.plateNumber.toLowerCase().includes(filters.vehicle.toLowerCase());
      const matchProject = !filters.project || r.projectName.toLowerCase().includes(filters.project.toLowerCase());
      const matchRegion = !filters.region || (r.region || '').toLowerCase().includes(filters.region.toLowerCase());

      return (inMonth || (filters.startDate || filters.endDate ? inRange : false)) && matchVehicle && matchProject && matchRegion;
    });
  }, [requests, filters]);

  const stats = useMemo(() => {
    const byProject: Record<string, number> = {};
    const byVehicle: Record<string, number> = {};
    const byRegion: Record<string, number> = {};

    filtered.forEach(r => {
      const liters = r.newRequestLiters || 0;
      byProject[r.projectName] = (byProject[r.projectName] || 0) + liters;
      byVehicle[r.plateNumber] = (byVehicle[r.plateNumber] || 0) + liters;
      byRegion[r.region || 'Unassigned'] = (byRegion[r.region || 'Unassigned'] || 0) + liters;
    });

    return { byProject, byVehicle, byRegion };
  }, [filtered]);

  const handleExportSummary = () => {
    const headers = ['Category', 'Name', 'Total Liters'];
    const rows: any[] = [];
    
    Object.entries(stats.byProject).forEach(([name, val]) => rows.push(['Project', name, val]));
    Object.entries(stats.byVehicle).forEach(([name, val]) => rows.push(['Vehicle', name, val]));
    Object.entries(stats.byRegion).forEach(([name, val]) => rows.push(['Region', name, val]));

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `FuelSummary_Export_${filters.month || 'Custom'}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-900">Aggregate Performance</h3>
          <div className="flex flex-wrap gap-3">
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase">Analysis Month</label>
               <input type="month" value={filters.month} onChange={(e) => setFilters({...filters, month: e.target.value, startDate: '', endDate: ''})} className="block w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold outline-none" />
             </div>
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase">Date Range</label>
               <div className="flex items-center gap-1">
                 <input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs outline-none" />
                 <input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs outline-none" />
               </div>
             </div>
             <button onClick={handleExportSummary} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 transition-all self-end">
               📥 Export Report
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
           <FormInput label="Filter Vehicle" value={filters.vehicle} onChange={(v:any) => setFilters({...filters, vehicle: v})} />
           <FormInput label="Filter Project" value={filters.project} onChange={(v:any) => setFilters({...filters, project: v})} />
           <FormInput label="Filter Region" value={filters.region} onChange={(v:any) => setFilters({...filters, region: v})} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SummaryTable title="Fuel by Project" data={stats.byProject} label="Project Site" />
        <SummaryTable title="Fuel by Vehicle" data={stats.byVehicle} label="Vehicle Plate" />
        <SummaryTable title="Fuel by Region" data={stats.byRegion} label="Regional Sector" />
      </div>

      <div className="bg-blue-600 p-6 sm:p-8 rounded-3xl text-white shadow-xl shadow-blue-100 flex flex-col sm:flex-row justify-between items-center gap-6 overflow-hidden">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.2em] opacity-80 mb-2">Total Consumed Volume</h4>
          <p className="text-4xl sm:text-6xl font-black tabular-nums tracking-tighter">
            {Object.values(stats.byProject).reduce((a,b) => a+b, 0).toLocaleString()} <span className="text-xl font-medium opacity-60">L</span>
          </p>
        </div>
        <div className="bg-white/10 p-5 rounded-2xl border border-white/20 hidden sm:block">
           <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </div>
      </div>
    </div>
  );
};

const SummaryTable = ({ title, data, label }: { title: string, data: Record<string, number>, label: string }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm h-full">
    <div className="p-4 bg-slate-50 border-b border-slate-200">
      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-widest">{title}</h4>
    </div>
    <div className="overflow-y-auto max-h-[300px] sm:max-h-[400px]">
      <table className="w-full text-xs">
        <thead className="bg-slate-50/50 sticky top-0 shadow-sm">
          <tr>
            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-widest">{label}</th>
            <th className="px-4 py-3 text-right font-bold text-slate-400 uppercase tracking-widest">Liters</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Object.keys(data).length === 0 ? (
            <tr><td colSpan={2} className="p-12 text-center text-slate-400 italic">No records.</td></tr>
          ) : Object.entries(data).sort((a,b) => b[1] - a[1]).map(([key, val]) => (
            <tr key={key} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-700">{key}</td>
              <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{val.toLocaleString()} L</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const StatusBadge = ({ status, hasAlert }: { status: RequestStatus, hasAlert?: boolean }) => {
  const styles = {
    [RequestStatus.PENDING]: "bg-amber-100 text-amber-800 border-amber-200",
    [RequestStatus.PM_APPROVED]: "bg-blue-100 text-blue-800 border-blue-200",
    [RequestStatus.REJECTED]: "bg-red-100 text-red-800 border-red-200",
    [RequestStatus.ADMIN_PROCESSED]: "bg-indigo-100 text-indigo-800 border-indigo-200",
    [RequestStatus.VERIFICATION_SUBMITTED]: "bg-purple-100 text-purple-800 border-purple-200",
    [RequestStatus.COMPLETED]: "bg-green-100 text-green-800 border-green-200",
  };
  
  const labels = {
    [RequestStatus.PENDING]: "Pending",
    [RequestStatus.PM_APPROVED]: "PM Approved",
    [RequestStatus.REJECTED]: "Rejected",
    [RequestStatus.ADMIN_PROCESSED]: "Processing",
    [RequestStatus.VERIFICATION_SUBMITTED]: "Reviewing Photos",
    [RequestStatus.COMPLETED]: "Completed",
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-sm ${styles[status]}`}>
        {labels[status]}
      </span>
      {hasAlert && status !== RequestStatus.REJECTED && (
        <span className="text-[8px] font-bold text-red-600 animate-pulse">
          ⚠ REVIEW NEEDED
        </span>
      )}
    </div>
  );
};

const RequestDetailsView = ({ request, allRequests, currentUser, onClose, onUpdateStatus, onVerify, onAddNotification, onSendMessage, alerts }: any) => {
  const [note, setNote] = useState(request.pmNote || '');
  const [replyData, setReplyData] = useState(request.adminReplyData || '');
  const [replyImage, setReplyImage] = useState(request.adminReplyImage || '');
  const [pmReplyImage, setPmReplyImage] = useState(request.pmReplyImage || '');
  const [verificationImages, setVerificationImages] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const kmDifference = request.newMileage - request.lastMileage;
  const efficiency = request.lastRequestLiters > 0 ? (kmDifference / request.lastRequestLiters).toFixed(2) : '0';
  const isManagement = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PM;
  
  const previousRequest = allRequests
    .filter((r: FuelRequest) => r.plateNumber.toLowerCase() === request.plateNumber.toLowerCase() && r.createdAt < request.createdAt)
    .sort((a: FuelRequest, b: FuelRequest) => b.createdAt - a.createdAt)[0];

  const canUndoPM = currentUser.role === UserRole.PM && 
                   (request.status === RequestStatus.PM_APPROVED || request.status === RequestStatus.REJECTED) &&
                   (Date.now() - request.updatedAt < 5 * 60 * 1000);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [request.chatMessages]);

  const handlePMAction = (status: RequestStatus) => {
    if (status === RequestStatus.REJECTED && !note.trim()) {
      setError('Please provide a note for rejection');
      return;
    }
    onUpdateStatus(request.id, { 
      status, 
      pmNote: note, 
      pmReplyImage: pmReplyImage 
    });
    const msg = status === RequestStatus.REJECTED ? `Request ${request.id} rejected` : `PM approved ${request.id}`;
    onAddNotification(request.userId, UserRole.USER, msg, request.id);
    if (status === RequestStatus.PM_APPROVED) onAddNotification('', UserRole.ADMIN, `PM approved ${request.plateNumber}`, request.id);
  };

  const handlePMUndo = () => {
    onUpdateStatus(request.id, { status: RequestStatus.PENDING, pmNote: '', pmSuggestedLiters: undefined });
    onAddNotification(request.userId, UserRole.USER, `PM undid previous action on ${request.id}`, request.id);
  };

  const handleAdminAction = () => {
    if (!replyData.trim()) {
      setError('Provide dispatch codes');
      return;
    }
    onUpdateStatus(request.id, { status: RequestStatus.ADMIN_PROCESSED, adminReplyData: replyData, adminReplyImage: replyImage });
    onAddNotification(request.userId, UserRole.USER, `Admin Approved ${request.id}`, request.id);
  };

  const handleAdminVerifyCompletion = () => {
    onUpdateStatus(request.id, { status: RequestStatus.COMPLETED });
    onAddNotification(request.userId, UserRole.USER, `Admin verified fueling for ${request.id}`, request.id);
  };

  const handleToggleChat = () => {
    const newState = !request.chatDisabled;
    onUpdateStatus(request.id, { chatDisabled: newState });
    const msg = newState ? "Management disabled chat for this request." : "Management enabled chat for this request.";
    onSendMessage(msg);
  };

  const handleImageCapture = (setter: any) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file instanceof Blob) {
      const r = new FileReader();
      r.onloadend = () => setter(r.result as string);
      r.readAsDataURL(file);
    }
  };

  const handlePostFuelingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (verificationImages.length + files.length > 4) {
      alert("You can only upload a maximum of 4 photos for verification.");
      return;
    }

    files.forEach(file => {
      if (file instanceof Blob) {
        const r = new FileReader();
        r.onloadend = () => setVerificationImages(prev => {
          if (prev.length >= 4) return prev;
          return [...prev, r.result as string];
        });
        r.readAsDataURL(file);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-none sm:rounded-2xl w-full max-w-2xl h-full sm:h-auto sm:max-h-[95vh] overflow-hidden z-[70] shadow-2xl flex flex-col border border-slate-200">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Audit: {request.id}</h3>
            <StatusBadge status={request.status} hasAlert={alerts.length > 0} />
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded transition-all">✕</button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Comparison Panel for Management */}
          {isManagement && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
               <div className="flex justify-between items-center">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   📊 Historical Comparison
                 </h4>
                 <div className="flex items-center gap-2">
                   <span className="text-[9px] font-bold text-slate-400 uppercase">Chat Status:</span>
                   <button 
                    onClick={handleToggleChat}
                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${request.chatDisabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                   >
                     {request.chatDisabled ? 'Disabled' : 'Enabled'}
                   </button>
                 </div>
               </div>
               {previousRequest ? (
                 <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white p-2 rounded border border-slate-100">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">Previous ( {previousRequest.date} )</span>
                      <div className="flex justify-between items-end mt-1">
                        <span className="text-xs text-slate-500">Vol: {previousRequest.newRequestLiters} L</span>
                        <span className="text-xs text-slate-500">Odo: {previousRequest.newMileage}</span>
                      </div>
                   </div>
                   <div className="bg-white p-2 rounded border border-blue-100 ring-1 ring-blue-50">
                      <span className="text-[8px] font-bold text-blue-400 uppercase">Current ( {request.date} )</span>
                      <div className="flex justify-between items-end mt-1">
                        <span className="text-xs font-bold text-slate-900">Vol: {request.newRequestLiters} L</span>
                        <span className="text-xs font-bold text-slate-900">Odo: {request.newMileage}</span>
                      </div>
                   </div>
                 </div>
               ) : (
                 <p className="text-[10px] text-slate-400 italic">No historical records for this asset.</p>
               )}
            </div>
          )}

          {/* Efficiency Details */}
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Asset" value={request.plateNumber} />
            <InfoItem label="Site" value={request.projectName} />
            <div className="col-span-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between">
               <div>
                  <span className="text-[9px] font-bold text-blue-400 block uppercase">Travel Dist.</span>
                  <span className="text-xl font-black text-blue-800 leading-none">{kmDifference} KM</span>
               </div>
               <div className="text-right">
                  <span className="text-[9px] font-bold text-blue-400 block uppercase">Efficiency</span>
                  <span className="text-xl font-black text-indigo-600 leading-none">{efficiency} <span className="text-[10px]">KM/L</span></span>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Start Odo" value={request.lastMileage} />
            <InfoItem label="End Odo" value={request.newMileage} />
            <InfoItem label="Request Vol" value={`${request.newRequestLiters} L`} />
            <InfoItem label="Station" value={request.stationName} />
          </div>

          {/* Discussion */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Discussion Hub</h4>
            <div ref={scrollRef} className="max-h-40 overflow-y-auto space-y-2 mb-3 pr-2 custom-scrollbar">
              {request.chatMessages?.map((m: any) => (
                <div key={m.id} className={`flex flex-col ${m.userId === currentUser.id ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[90%] rounded-xl px-3 py-1.5 shadow-sm text-xs ${m.userId === currentUser.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900 border border-slate-200'}`}>
                    {m.text && <p>{m.text}</p>}
                    {m.image && <img src={m.image} className="mt-1 rounded-lg max-h-32" />}
                  </div>
                </div>
              ))}
            </div>
            {!request.chatDisabled ? (
              <div className="flex gap-2">
                 <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyPress={e => e.key === 'Enter' && (onSendMessage(inputText), setInputText(''))} placeholder="Add a note..." className="flex-grow border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none" />
                 <button onClick={() => { onSendMessage(inputText); setInputText(''); }} className="bg-blue-600 text-white px-4 rounded-lg text-xs font-bold uppercase transition-all active:scale-95">Send</button>
              </div>
            ) : (
              <div className="text-center py-2 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chat is currently disabled</p>
              </div>
            )}
          </div>

          {/* Action Panels */}
          {error && <p className="text-red-600 text-[11px] font-bold bg-red-50 p-2 rounded border border-red-100">{error}</p>}

          {currentUser.role === UserRole.PM && request.status === RequestStatus.PENDING && (
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
              <h4 className="font-bold text-blue-900 text-xs uppercase tracking-widest">PM Review Panel</h4>
              <textarea placeholder="Instruction or reason..." value={note} onChange={e => { setNote(e.target.value); setError(''); }} className="w-full border border-blue-200 rounded-xl p-3 text-xs min-h-[80px] outline-none" />
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">Reference Photo (Optional)</label>
                <input type="file" accept="image/*" onChange={handleImageCapture(setPmReplyImage)} className="text-[10px]" />
                {pmReplyImage && <img src={pmReplyImage} className="h-16 w-16 object-cover rounded border border-blue-200 shadow-sm" />}
              </div>

              <div className="flex gap-2">
                <button onClick={() => handlePMAction(RequestStatus.REJECTED)} className="flex-1 bg-white text-red-600 border border-red-200 font-bold py-2.5 rounded-xl text-xs uppercase transition-all hover:bg-red-50">Reject</button>
                <button onClick={() => handlePMAction(RequestStatus.PM_APPROVED)} className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs uppercase transition-all hover:bg-blue-700 shadow-lg shadow-blue-100">Approve</button>
              </div>
            </div>
          )}

          {currentUser.role === UserRole.ADMIN && request.status === RequestStatus.PM_APPROVED && (
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-4 text-white shadow-xl">
              <h4 className="font-bold text-xs uppercase tracking-widest text-blue-400">Admin Authorization Center</h4>
              <textarea placeholder="Authorization codes..." value={replyData} onChange={e => { setReplyData(e.target.value); setError(''); }} className="w-full border border-slate-700 bg-slate-800 text-white rounded-xl p-3 text-xs min-h-[80px] outline-none" />
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Voucher Scan / Authorization Photo</label>
                <input type="file" accept="image/*" onChange={handleImageCapture(setReplyImage)} className="text-[10px] text-slate-400" />
                {replyImage && <img src={replyImage} className="h-16 w-16 object-cover rounded border border-slate-700" />}
              </div>

              <button onClick={handleAdminAction} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all hover:bg-blue-700 active:scale-[0.98]">Confirm Dispatch</button>
            </div>
          )}

          {currentUser.role === UserRole.USER && request.status === RequestStatus.ADMIN_PROCESSED && (
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100 space-y-4">
               <h4 className="font-bold text-green-900 text-xs uppercase tracking-widest">Final Audit Proof (Max 4 Photos)</h4>
               <label className="flex items-center justify-center w-full p-6 border-2 border-dashed border-green-300 rounded-2xl bg-white cursor-pointer hover:bg-green-50">
                  <span className="text-[11px] font-black text-green-600 uppercase">Upload Verification Photos ({verificationImages.length}/4)</span>
                  <input type="file" multiple accept="image/*" capture="environment" onChange={handlePostFuelingUpload} className="hidden" />
               </label>
               <div className="grid grid-cols-4 gap-2">
                 {verificationImages.map((img, i) => (
                   <div key={i} className="relative group">
                     <img src={img} className="h-16 w-full object-cover rounded border border-green-200" />
                     <button onClick={() => setVerificationImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                   </div>
                 ))}
               </div>
               {verificationImages.length > 0 && (
                 <button onClick={() => onVerify(request.id, verificationImages)} className="w-full bg-slate-950 text-white font-bold py-3 rounded-xl text-xs uppercase transition-all active:scale-95">Submit for Admin Audit</button>
               )}
            </div>
          )}

          {currentUser.role === UserRole.ADMIN && request.status === RequestStatus.VERIFICATION_SUBMITTED && (
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-4">
               <h4 className="font-bold text-purple-900 text-xs uppercase tracking-widest">Final Admin Verification</h4>
               <div className="grid grid-cols-4 gap-2">
                 {request.postFuelingImages?.map((img: string, i: number) => <img key={i} src={img} className="h-16 w-full object-cover rounded border border-purple-200 cursor-pointer shadow-sm hover:scale-105 transition-transform" onClick={() => window.open(img)} />)}
               </div>
               <button onClick={handleAdminVerifyCompletion} className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all hover:bg-purple-700">Verify & Close Audit</button>
            </div>
          )}

          {/* Proof Records Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Initial Audit Evidence</h4>
              {request.imageUrl ? (
                <img src={request.imageUrl} className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-sm cursor-pointer" onClick={() => window.open(request.imageUrl)} />
              ) : <p className="text-[10px] text-slate-400">Not provided.</p>}
            </div>
            {(request.pmReplyImage || request.adminReplyImage) && (
              <div className="p-3 bg-blue-50/30 rounded-xl border border-blue-100">
                <h4 className="text-[10px] font-bold text-blue-400 uppercase mb-2 tracking-widest">Ref. Documents</h4>
                <div className="flex gap-2">
                  {request.pmReplyImage && <img src={request.pmReplyImage} className="w-16 h-16 object-cover rounded-lg border border-blue-100 shadow-sm cursor-pointer" onClick={() => window.open(request.pmReplyImage)} />}
                  {request.adminReplyImage && <img src={request.adminReplyImage} className="w-16 h-16 object-cover rounded-lg border border-blue-100 shadow-sm cursor-pointer" onClick={() => window.open(request.adminReplyImage)} />}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
           <button onClick={onClose} className="w-full sm:w-auto px-8 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase transition-all hover:bg-slate-300">Close Viewer</button>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value }: { label: string, value: any }) => (
  <div className="bg-white/60 p-2.5 rounded-xl border border-slate-100">
    <span className="text-[9px] font-black text-slate-400 uppercase block mb-0.5 tracking-wider">{label}</span>
    <div className="text-[13px] font-bold text-slate-900 truncate leading-none">{value || '-'}</div>
  </div>
);

const FuelRequestForm = ({ initialData, onSubmit, onCancel }: { initialData?: FuelRequest | null, onSubmit: (data: any) => void, onCancel: () => void }) => {
  const [formData, setFormData] = useState({
    date: initialData?.date || new Date().toISOString().split('T')[0],
    plateNumber: initialData?.plateNumber || '', 
    projectName: initialData?.projectName || '', 
    region: initialData?.region || '',
    lastMileage: initialData?.lastMileage || 0, 
    newMileage: initialData?.newMileage || 0, 
    lastRequestLiters: initialData?.lastRequestLiters || 0, 
    newRequestLiters: initialData?.newRequestLiters || 70,
    stationName: initialData?.stationName || '', 
    imageUrl: initialData?.imageUrl || ''
  });
  const [preview, setPreview] = useState<string | null>(initialData?.imageUrl || null);

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file instanceof Blob) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, imageUrl: reader.result as string });
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const isFormValid = formData.plateNumber.trim() !== '' && 
                     formData.projectName.trim() !== '' && 
                     formData.region.trim() !== '' && 
                     formData.newMileage > 0 && 
                     formData.newRequestLiters > 0 && 
                     formData.stationName.trim() !== '' && 
                     formData.imageUrl !== '';

  return (
    <form onSubmit={(e) => { e.preventDefault(); if(isFormValid) onSubmit(formData); else alert("All fields are mandatory. Please provide a photo and fill all blanks."); }} className="space-y-6 flex flex-col h-full">
      <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase text-center">
        {initialData ? 'Update & Resubmit Audit' : 'Initialize Fuel Audit'}
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
        <FormInput label="Audit Date *" type="date" required value={formData.date} onChange={(v:any) => setFormData({...formData, date: v})} />
        <FormInput label="Plate Number *" placeholder="e.g. XYZ-123" required value={formData.plateNumber} onChange={(v:any) => setFormData({...formData, plateNumber: v})} />
        <FormInput label="Site Project *" placeholder="Project Name" required value={formData.projectName} onChange={(v:any) => setFormData({...formData, projectName: v})} />
        <FormInput label="Region Area *" placeholder="Operational District" required value={formData.region} onChange={(v:any) => setFormData({...formData, region: v})} />
        
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 col-span-1 md:col-span-2 space-y-4">
           <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2 w-fit">Mileage Proof *</p>
           <div className="grid grid-cols-2 gap-4">
              <FormInput label="Last Logged KM" type="number" value={formData.lastMileage} onChange={(v:any) => setFormData({...formData, lastMileage: Number(v)})} />
              <FormInput label="Current Odometer *" type="number" required value={formData.newMileage} onChange={(v:any) => setFormData({...formData, newMileage: Number(v)})} />
           </div>
           
           <div className="relative group h-40">
             <div className={`w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center overflow-hidden transition-all ${preview ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400'}`}>
               {preview ? (
                 <img src={preview} className="w-full h-full object-contain" />
               ) : (
                 <div className="text-center">
                    <svg className="w-8 h-8 text-slate-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Capture Dashboard Photo</p>
                 </div>
               )}
               <input type="file" accept="image/*" capture="environment" onChange={handleImageCapture} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
             </div>
             {preview && (
               <button type="button" onClick={() => {setPreview(null); setFormData({...formData, imageUrl: ''})}} className="absolute top-2 right-2 bg-red-600 text-white h-6 w-6 rounded-full flex items-center justify-center text-xs shadow-lg z-20">✕</button>
             )}
           </div>
        </div>

        <FormInput label="Last Log Liter Amount" type="number" value={formData.lastRequestLiters} onChange={(v:any) => setFormData({...formData, lastRequestLiters: Number(v)})} />
        <FormInput label="Target Request Vol * (L)" type="number" required value={formData.newRequestLiters} onChange={(v:any) => setFormData({...formData, newRequestLiters: Number(v)})} />
        <div className="col-span-1 md:col-span-2">
          <FormInput label="Fuel Station Name *" placeholder="Authorized Station" required value={formData.stationName} onChange={(v:any) => setFormData({...formData, stationName: v})} />
        </div>
      </div>

      <div className="flex gap-4 pt-6 mt-auto">
        <button type="button" onClick={onCancel} className="flex-1 py-4 text-xs font-black text-slate-500 hover:bg-slate-100 rounded-2xl uppercase tracking-widest transition-colors">Cancel</button>
        <button type="submit" disabled={!isFormValid} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 disabled:opacity-50 text-xs uppercase tracking-widest transition-all active:scale-95">
          {initialData ? 'Re-send Audit' : 'Submit Audit'}
        </button>
      </div>
    </form>
  );
};

const FormInput = ({ label, onChange, ...props }: any) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input 
      {...props} 
      onChange={e => onChange ? onChange(e.target.value) : undefined} 
      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm bg-white transition-all shadow-sm" 
    />
  </div>
);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
