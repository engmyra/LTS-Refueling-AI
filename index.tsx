
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';
import { 
  Bell, 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download, 
  FileText, 
  Image, 
  MessageSquare, 
  TrendingUp, 
  Filter, 
  Edit2, 
  MessageCircle, 
  Lock, 
  Unlock, 
  ChevronDown, 
  ChevronUp, 
  Camera,
  LogOut,
  Plus
} from 'lucide-react';
import { 
  UserRole, 
  FuelRequest, 
  RequestStatus, 
  Notification, 
  AppUser,
  ChatMessage,
  AuditLog
} from './types';
import { 
  INITIAL_USERS, 
  STORAGE_KEYS
} from './constants';

const SUPABASE_URL = 'https://phwkoywnupycstlogopx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBod2tveXdudXB5Y3N0bG9nb3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzg3MjQsImV4cCI6MjA4MjkxNDcyNH0.RDyOPr8104bP5wqgJnCxj6pzdt81yliSsoFAVNH17pw';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const App = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [requests, setRequests] = useState<FuelRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'submit' | 'requests'>('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  // Filters for Requests Tab
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: 'All',
    vehicle: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) setCurrentUser(JSON.parse(saved));
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      let query = supabase.from('fuel_requests').select('*').order('createdAt', { ascending: false });
      if (currentUser.role === UserRole.USER) query = query.eq('userId', currentUser.id);
      const { data } = await query;
      if (data) setRequests(data);

      const { data: notifs } = await supabase.from('notifications')
        .select('*')
        .or(`toUserId.eq.${currentUser.id},toRole.eq.${currentUser.role}`)
        .order('timestamp', { ascending: false });
      if (notifs) setNotifications(notifs);
    };
    fetchData();

    const channel = supabase.channel('app_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fuel_requests' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchData)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  };

  const markNotifRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  if (isInitializing) return (
    <div className="h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!currentUser) return <Login onLogin={(u) => { setCurrentUser(u); localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(u)); }} />;

  return (
    <div className="min-h-screen bg-indigo-50/30 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-2xl font-black text-indigo-600 tracking-tight leading-none">Fuel Request System</h1>
          <p className="text-sm text-slate-500 mt-1">Welcome, {currentUser.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <select 
              value={currentUser.role} 
              onChange={(e) => {
                const updated = { ...currentUser, role: e.target.value as UserRole };
                setCurrentUser(updated);
                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updated));
              }}
              className="px-3 py-2 border rounded-xl text-sm bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value={UserRole.USER}>User</option>
              <option value={UserRole.PM}>Project Manager</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)} 
              className="p-2.5 hover:bg-slate-100 rounded-full transition-colors relative"
            >
              <Bell className="w-6 h-6 text-slate-700" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold border-2 border-white">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[60] overflow-hidden">
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-900">Notifications</h3>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-10 text-center">
                      <Clock className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">No new alerts</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        onClick={() => markNotifRead(notif.id)}
                        className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${!notif.read ? 'bg-indigo-50/50' : ''}`}
                      >
                        <p className="text-xs text-slate-800 leading-relaxed">{notif.message}</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">{new Date(notif.timestamp).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleLogout} className="p-2.5 hover:bg-red-50 hover:text-red-600 rounded-full text-slate-700 transition-all">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full px-4 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
          <NavTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} label="Dashboard" />
          <NavTab active={activeTab === 'submit'} onClick={() => setActiveTab('submit')} label="Submit" />
          <NavTab active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} label="Requests" />
        </div>

        {activeTab === 'dashboard' && <Dashboard requests={requests} currentUser={currentUser} />}
        {activeTab === 'submit' && (
          <SubmitForm 
            requests={requests} 
            currentUser={currentUser} 
            onSuccess={() => setActiveTab('requests')} 
          />
        )}
        {activeTab === 'requests' && (
          <RequestsList 
            requests={requests} 
            filters={filters} 
            setFilters={setFilters} 
            expandedRequest={expandedRequest}
            setExpandedRequest={setExpandedRequest}
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
};

const NavTab = ({ active, onClick, label }: any) => (
  <button 
    onClick={onClick}
    className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
      active 
        ? 'bg-indigo-600 text-white shadow-indigo-200' 
        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'
    }`}
  >
    {label}
  </button>
);

const Dashboard = ({ requests, currentUser }: any) => {
  const stats = useMemo(() => {
    const relevant = currentUser.role === UserRole.USER 
      ? requests.filter((r: any) => r.userId === currentUser.id)
      : requests;
    
    return {
      total: relevant.length,
      pending: relevant.filter((r: any) => r.status === RequestStatus.PENDING).length,
      completed: relevant.filter((r: any) => r.status === RequestStatus.COMPLETED || r.status === RequestStatus.ADMIN_PROCESSED).length,
      totalFuel: relevant.reduce((sum: number, r: any) => sum + Number(r.newRequestLiters || 0), 0)
    };
  }, [requests, currentUser]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
      <DashboardCard label="Total" value={stats.total} color="indigo" />
      <DashboardCard label="Pending" value={stats.pending} color="amber" />
      <DashboardCard label="Completed" value={stats.completed} color="green" />
      <DashboardCard label="Total Fuel (L)" value={stats.totalFuel} color="blue" />
    </div>
  );
};

const DashboardCard = ({ label, value, color }: any) => {
  const colorMap: any = {
    indigo: 'text-indigo-600',
    amber: 'text-amber-500',
    green: 'text-green-600',
    blue: 'text-blue-600'
  };
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50">
      <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">{label}</p>
      <p className={`text-4xl font-black ${colorMap[color]}`}>{value}</p>
    </div>
  );
};

const SubmitForm = ({ requests, currentUser, onSuccess }: any) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    plateNumber: '',
    projectName: '',
    stationName: '',
    newMileage: '',
    newRequestLiters: '70',
    imageUrl: '',
    date: new Date().toISOString().split('T')[0]
  });

  const lastRequest = useMemo(() => {
    if (!data.plateNumber) return null;
    return requests
      .filter((r: any) => r.plateNumber.toUpperCase() === data.plateNumber.toUpperCase())
      .sort((a: any, b: any) => b.createdAt - a.createdAt)[0] || null;
  }, [data.plateNumber, requests]);

  const lastEfficiency = useMemo(() => {
    if (!lastRequest) return 0;
    const distance = Number(lastRequest.newMileage || 0) - Number(lastRequest.lastMileage || 0);
    return lastRequest.newRequestLiters > 0 ? (distance / Number(lastRequest.newRequestLiters)).toFixed(2) : 0;
  }, [lastRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.plateNumber || !data.newMileage) return alert('Plate and Mileage are required');
    
    setLoading(true);
    const id = `F-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const payload: Partial<FuelRequest> = {
      ...data,
      id,
      userId: currentUser.id,
      userName: currentUser.name,
      status: RequestStatus.PENDING,
      lastMileage: Number(lastRequest?.newMileage || 0),
      lastRequestLiters: Number(lastRequest?.newRequestLiters || 0),
      newMileage: Number(data.newMileage),
      newRequestLiters: Number(data.newRequestLiters),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatMessages: []
    };

    const { error } = await supabase.from('fuel_requests').insert(payload);
    if (error) alert('Error: ' + error.message);
    else {
      // Create notification for PMs
      await supabase.from('notifications').insert({
        id: Math.random().toString(36).substr(2, 9),
        toRole: UserRole.PM,
        message: `New fueling request for ${data.plateNumber} from ${currentUser.name}`,
        requestId: id,
        read: false,
        timestamp: Date.now()
      });
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-500">
      <h2 className="text-3xl font-black text-slate-900 mb-8 text-center uppercase tracking-tight">Fueling Entry</h2>
      
      {/* Historical Context Table */}
      {lastRequest && (
        <div className="mb-10 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/20">
          <div className="bg-indigo-600 px-4 py-2">
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] text-center">Last Baseline</p>
          </div>
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="border-b border-indigo-100 bg-white/50">
                <th className="py-3 px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-r border-indigo-100">Mileage</th>
                <th className="py-3 px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-r border-indigo-100">Fuel Vol</th>
                <th className="py-3 px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-4 px-2 border-r border-indigo-100 font-bold text-slate-900 text-sm">
                  {lastRequest.newMileage.toLocaleString()} KM
                </td>
                <td className="py-4 px-2 border-r border-indigo-100 font-bold text-slate-900 text-sm">
                  {lastRequest.newRequestLiters} L
                </td>
                <td className="py-4 px-2 font-bold text-green-600 text-sm bg-white/30">
                  {lastEfficiency} KM/L
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Date" type="date" value={data.date} onChange={(v) => setData({...data, date: v})} />
          <Input label="Plate Number" placeholder="LTS-XXXX" value={data.plateNumber} onChange={(v) => setData({...data, plateNumber: v.toUpperCase()})} />
          <Input label="Project Name" placeholder="Client / Operation" value={data.projectName} onChange={(v) => setData({...data, projectName: v})} />
          <Input label="Station Name" placeholder="PUMA / MERU" value={data.stationName} onChange={(v) => setData({...data, stationName: v})} />
        </div>

        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="New Odometer (KM)" type="number" value={data.newMileage} onChange={(v) => setData({...data, newMileage: v})} />
            <Input label="New Fuel Request (L)" type="number" value={data.newRequestLiters} onChange={(v) => setData({...data, newRequestLiters: v})} />
          </div>
        </div>

        <button 
          disabled={loading}
          className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[11px] shadow-xl hover:bg-indigo-700 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Processing Ledger...' : <><Send className="w-4 h-4" /> Authorize Submission</>}
        </button>
      </form>
    </div>
  );
};

const RequestsList = ({ requests, filters, setFilters, expandedRequest, setExpandedRequest, currentUser }: any) => {
  const filtered = useMemo(() => {
    return requests.filter((r: any) => {
      const d = new Date(r.createdAt);
      const fromMatch = !filters.dateFrom || d >= new Date(filters.dateFrom);
      const toMatch = !filters.dateTo || d <= new Date(filters.dateTo);
      const statusMatch = filters.status === 'All' || r.status === filters.status;
      const vehicleMatch = !filters.vehicle || r.plateNumber.toLowerCase().includes(filters.vehicle.toLowerCase());
      return fromMatch && toMatch && statusMatch && vehicleMatch;
    });
  }, [requests, filters]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Filters Box */}
      <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="flex items-center gap-2 mb-6 text-indigo-600 font-black uppercase text-xs tracking-[0.2em]">
          <Filter className="w-4 h-4" /> Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Input label="From Date" type="date" value={filters.dateFrom} onChange={v => setFilters({...filters, dateFrom: v})} />
          <Input label="To Date" type="date" value={filters.dateTo} onChange={v => setFilters({...filters, dateTo: v})} />
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status</label>
            <select 
              value={filters.status} 
              onChange={e => setFilters({...filters, status: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 font-bold text-slate-700"
            >
              <option value="All">All Statuses</option>
              {Object.values(RequestStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Input label="Vehicle" placeholder="Plate number" value={filters.vehicle} onChange={v => setFilters({...filters, vehicle: v})} />
        </div>
      </div>

      {/* Requests Cards */}
      <div className="space-y-4">
        {filtered.map((req: any) => (
          <RequestCard 
            key={req.id} 
            request={req} 
            expanded={expandedRequest === req.id}
            onToggle={() => setExpandedRequest(expandedRequest === req.id ? null : req.id)}
            currentUser={currentUser}
          />
        ))}
        {filtered.length === 0 && (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
             <FileText className="w-16 h-16 text-slate-100 mx-auto mb-4" />
             <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No matching records</p>
          </div>
        )}
      </div>
    </div>
  );
};

const RequestCard = ({ request, expanded, onToggle, currentUser }: any) => {
  const distance = Number(request.newMileage || 0) - Number(request.lastMileage || 0);
  const efficiency = request.newRequestLiters > 0 ? (distance / Number(request.newRequestLiters)).toFixed(2) : 0;
  
  const [chatMsg, setChatMsg] = useState('');

  const sendChat = async () => {
    if (!chatMsg.trim()) return;
    const msg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      text: chatMsg,
      timestamp: Date.now()
    };
    const updated = [...(request.chatMessages || []), msg];
    await supabase.from('fuel_requests').update({ chatMessages: updated }).eq('id', request.id);
    setChatMsg('');
  };

  const handleAction = async (status: RequestStatus, note: string = '') => {
    const update: any = { status, updatedAt: Date.now() };
    if (currentUser.role === UserRole.PM) update.pmNote = note || 'Processed';
    if (currentUser.role === UserRole.ADMIN) update.adminNote = note || 'ok';
    
    await supabase.from('fuel_requests').update(update).eq('id', request.id);
    
    // Notify User
    await supabase.from('notifications').insert({
      id: Math.random().toString(36).substr(2, 9),
      toUserId: request.userId,
      message: `Your fueling request for ${request.plateNumber} is now ${status}`,
      requestId: request.id,
      read: false,
      timestamp: Date.now()
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden transition-all duration-300">
      <div 
        className="p-6 cursor-pointer flex justify-between items-center hover:bg-slate-50/50"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">{request.plateNumber}</h3>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
              request.status === RequestStatus.COMPLETED ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {request.status === RequestStatus.COMPLETED ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {request.status.toLowerCase()}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{request.projectName} — {request.region || 'HQ'}</p>
          <div className="flex gap-6 mt-4 text-[11px] font-bold">
            <span className="text-slate-400 uppercase tracking-widest">Distance: <span className="text-blue-600">{distance} KM</span></span>
            <span className="text-slate-400 uppercase tracking-widest">Fuel: <span className="text-indigo-600">{request.newRequestLiters} L</span></span>
            <span className="text-slate-400 uppercase tracking-widest">Efficiency: <span className="text-green-600">{efficiency} KM/L</span></span>
          </div>
        </div>
        <div className="ml-4">
          {expanded ? <ChevronUp className="w-6 h-6 text-slate-300" /> : <ChevronDown className="w-6 h-6 text-slate-300" />}
        </div>
      </div>

      {request.adminReplyData && (
        <div className="mx-6 mb-4 bg-amber-100 border-l-4 border-amber-500 p-4 rounded-r-xl">
           <p className="font-black text-amber-900 text-xs uppercase tracking-widest">Voucher: <span className="ml-2 font-black">{request.adminReplyData}</span></p>
        </div>
      )}

      {expanded && (
        <div className="px-6 pb-8 pt-4 border-t border-slate-50 animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10 text-[11px]">
            <Detail label="Date" value={request.date} />
            <Detail label="Station" value={request.stationName} />
            <Detail label="Last Mileage" value={`${request.lastMileage.toLocaleString()} KM`} />
            <Detail label="New Mileage" value={`${request.newMileage.toLocaleString()} KM`} />
            <Detail label="Submitted" value={new Date(request.createdAt).toLocaleString()} />
            <Detail label="Submitted By" value={request.userName} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
             {request.pmNote && (
               <div className="bg-blue-50/50 border-l-4 border-blue-400 p-5 rounded-r-2xl">
                 <div className="flex items-center gap-2 text-blue-800 font-black text-[10px] uppercase mb-2 tracking-widest">
                    <MessageSquare className="w-4 h-4" /> PM Message
                 </div>
                 <p className="text-sm font-medium text-slate-700 leading-relaxed">{request.pmNote}</p>
               </div>
             )}
             {request.adminNote && (
               <div className="bg-green-50/50 border-l-4 border-green-400 p-5 rounded-r-2xl">
                 <div className="flex items-center gap-2 text-green-800 font-black text-[10px] uppercase mb-2 tracking-widest">
                    <MessageSquare className="w-4 h-4" /> Admin Message
                 </div>
                 <p className="text-sm font-medium text-slate-700 leading-relaxed">{request.adminNote || 'ok'}</p>
               </div>
             )}
          </div>

          {/* Action Center */}
          {(currentUser.role === UserRole.PM && request.status === RequestStatus.PENDING) && (
            <div className="mb-10 bg-slate-900 p-8 rounded-3xl text-white">
              <h4 className="font-black text-[11px] uppercase tracking-[0.3em] mb-6 opacity-60">Operations Control</h4>
              <div className="flex gap-4">
                <button onClick={() => handleAction(RequestStatus.PM_APPROVED)} className="flex-1 py-4 bg-indigo-600 rounded-2xl font-black text-[11px] uppercase hover:bg-indigo-700 transition shadow-xl">Approve Filing</button>
                <button onClick={() => handleAction(RequestStatus.REJECTED)} className="flex-1 py-4 bg-red-600/20 text-red-400 border border-red-900 rounded-2xl font-black text-[11px] uppercase hover:bg-red-600/30 transition">Reject</button>
              </div>
            </div>
          )}

          {/* Chat Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 font-black text-slate-800 text-xs uppercase tracking-widest border-b border-slate-100 pb-3">
               <MessageCircle className="w-4 h-4 text-indigo-600" /> Communications Thread
            </div>
            <div className="bg-slate-50/50 rounded-3xl p-6 space-y-4 max-h-80 overflow-y-auto border border-slate-100/50">
              {request.chatMessages?.map((msg: any) => (
                <div key={msg.id} className={`flex flex-col ${msg.userId === currentUser.id ? 'items-end' : 'items-start'}`}>
                  <div className={`p-4 rounded-2xl shadow-sm text-xs font-medium max-w-[85%] ${
                    msg.userId === currentUser.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                  }`}>
                    <p className="font-black mb-1 opacity-80 uppercase text-[9px] tracking-widest">{msg.userName}</p>
                    {msg.text}
                    <p className={`text-[8px] mt-2 font-black uppercase opacity-50 ${msg.userId === currentUser.id ? 'text-white' : 'text-slate-400'}`}>
                      {new Date(msg.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {(!request.chatMessages || request.chatMessages.length === 0) && (
                <div className="py-6 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Start a communication thread</div>
              )}
            </div>
            <div className="flex gap-3">
              <input 
                type="text" 
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendChat()}
                placeholder="Type your secure message..." 
                className="flex-grow px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all shadow-sm"
              />
              <button 
                onClick={sendChat}
                className="bg-indigo-600 text-white px-6 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Input = ({ label, value, onChange, type = 'text', placeholder = '', readOnly = false }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">{label}</label>
    <input 
      type={type} 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder}
      readOnly={readOnly}
      className={`w-full px-5 py-4 border border-slate-200 rounded-2xl text-sm font-bold outline-none transition-all shadow-sm ${
        readOnly ? 'bg-indigo-50/50 text-indigo-400 cursor-not-allowed border-indigo-100' : 'bg-white text-slate-900 focus:ring-4 focus:ring-indigo-600/5'
      }`} 
    />
  </div>
);

const Detail = ({ label, value }: any) => (
  <div className="space-y-1">
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-80">{label}</p>
    <p className="text-sm font-black text-slate-800 tracking-tight">{value}</p>
  </div>
);

const Login = ({ onLogin }: { onLogin: (u: AppUser) => void }) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handle = () => {
    const found = INITIAL_USERS.find(u => u.username === user && u.password === pass);
    if (found) onLogin(found);
    else setError('Authentication Failed: Invalid Credentials');
  };

  return (
    <div className="h-screen bg-indigo-600 flex items-center justify-center p-4">
      <div className="bg-white p-12 md:p-16 rounded-[3rem] shadow-2xl w-full max-w-md border border-white/20">
        <div className="text-center mb-12">
           <h2 className="text-4xl font-black text-indigo-900 uppercase tracking-tighter leading-none">Fleet Hub</h2>
           <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Operations Terminal</p>
        </div>
        <div className="space-y-6">
          <Input label="Identity Handle" value={user} onChange={setUser} placeholder="operator_id" />
          <Input label="Access Passphrase" type="password" value={pass} onChange={setPass} />
          {error && <p className="text-red-500 text-[10px] font-black uppercase text-center bg-red-50 p-3 rounded-2xl">{error}</p>}
          <button 
            onClick={handle} 
            className="w-full py-5 bg-indigo-600 text-white font-black rounded-[2rem] uppercase text-[11px] shadow-2xl shadow-indigo-600/40 hover:bg-indigo-700 transition-all transform active:scale-[0.98]"
          >
            Authenticate Session
          </button>
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
