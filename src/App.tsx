/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, 
  Calendar, 
  BookOpen, 
  Gift, 
  MessageSquare, 
  Settings, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Clock, 
  ChevronRight,
  ExternalLink,
  User,
  LogOut,
  LogIn,
  AlertCircle,
  Home,
  ShieldCheck,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  Timestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { format, differenceInDays, parseISO, isAfter, startOfDay } from 'date-fns';
import { db, auth } from './firebase';

// --- Types ---
interface Notice {
  id: string;
  title: string;
  content: string;
  link?: string;
  createdAt: any;
}

interface Assessment {
  id: string;
  subject: string;
  title: string;
  dueDate: string;
  description: string;
}

interface ExamScope {
  id: string;
  subject: string;
  scope: string;
  examType: '1-mid' | '1-final' | '2-mid' | '2-final';
}

interface ExamDate {
  id: string;
  eventName: string;
  date: string;
}

interface Birthday {
  id: string;
  name: string;
  date: string;
  type: 'student' | 'teacher';
}

interface UserRequest {
  id: string;
  content: string;
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: any;
  uid?: string;
  userName?: string;
}

interface QuickLink {
  id: string;
  title: string;
  url: string;
  color?: string;
}

interface SchoolEvent {
  id: string;
  title: string;
  date: string;
  description?: string;
}

interface PeUniformDay {
  id: string;
  dayOfWeek: '월' | '화' | '수' | '목' | '금';
  note?: string;
}

interface Settings {
  timetableLink?: string;
  schoolLink?: string;
}

interface UserProfile {
  role: 'admin' | 'user';
}

// --- Components ---

const Card = ({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-2xl shadow-sm border border-black/5 p-5 selectable ${className} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "info" }) => {
  const styles = {
    default: "bg-stone-100 text-stone-600",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    info: "bg-indigo-100 text-indigo-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${styles[variant]}`}>
      {children}
    </span>
  );
};

const Modal = ({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
      >
        <h3 className="text-xl font-black mb-2">{title}</h3>
        <p className="text-stone-500 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-stone-100 font-bold text-stone-600 active:scale-95 transition-transform">취소</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-500 font-bold text-white active:scale-95 transition-transform">삭제</button>
        </div>
      </motion.div>
    </div>
  );
};

const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  const icons = {
    success: <CheckCircle size={18} />,
    error: <AlertCircle size={18} />,
    info: <Bell size={18} />,
  };
  const colors = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    info: "bg-stone-800",
  };

  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] ${colors[type]} text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 min-w-[280px] justify-center`}
    >
      {icons[type]}
      <span className="text-sm font-bold">{message}</span>
    </motion.div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data States
  const [notices, setNotices] = useState<Notice[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [examScopes, setExamScopes] = useState<ExamScope[]>([]);
  const [examDates, setExamDates] = useState<ExamDate[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [schoolEvents, setSchoolEvents] = useState<SchoolEvent[]>([]);
  const [peUniformDays, setPeUniformDays] = useState<PeUniformDay[]>([]);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  // UI States
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setProfile(data);
          setIsAdmin(data.role === 'admin' || u.email === 'joeunchan1228@gmail.com');
        } else {
          // Create profile for new user
          const isDefaultAdmin = u.email === 'joeunchan1228@gmail.com';
          const newProfile: UserProfile = { role: isDefaultAdmin ? 'admin' : 'user' };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
          setIsAdmin(isDefaultAdmin);
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Fetching Effects
  useEffect(() => {
    const qNotices = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const qRequests = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));

    const unsubNotices = onSnapshot(qNotices, (s) => setNotices(s.docs.map(d => ({ id: d.id, ...d.data() } as Notice))));
    const unsubAssessments = onSnapshot(collection(db, 'assessments'), (s) => setAssessments(s.docs.map(d => ({ id: d.id, ...d.data() } as Assessment))));
    const unsubExamScopes = onSnapshot(collection(db, 'examScopes'), (s) => setExamScopes(s.docs.map(d => ({ id: d.id, ...d.data() } as ExamScope))));
    const unsubExamDates = onSnapshot(collection(db, 'examDates'), (s) => setExamDates(s.docs.map(d => ({ id: d.id, ...d.data() } as ExamDate))));
    const unsubBirthdays = onSnapshot(collection(db, 'birthdays'), (s) => setBirthdays(s.docs.map(d => ({ id: d.id, ...d.data() } as Birthday))));
    const unsubQuickLinks = onSnapshot(collection(db, 'quickLinks'), (s) => setQuickLinks(s.docs.map(d => ({ id: d.id, ...d.data() } as QuickLink))));
    const unsubRequests = onSnapshot(qRequests, (s) => setRequests(s.docs.map(d => ({ id: d.id, ...d.data() } as UserRequest))));
    const unsubSchoolEvents = onSnapshot(collection(db, 'schoolEvents'), (s) => setSchoolEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as SchoolEvent))));
    const unsubPeUniformDays = onSnapshot(collection(db, 'peUniformDays'), (s) => setPeUniformDays(s.docs.map(d => ({ id: d.id, ...d.data() } as PeUniformDay))));
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (d) => {
      if (d.exists()) setSettings(d.data() as Settings);
    });

    return () => {
      unsubNotices(); unsubAssessments(); unsubExamScopes(); unsubExamDates(); unsubBirthdays(); unsubRequests(); unsubSchoolEvents(); unsubPeUniformDays(); unsubSettings();
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        showToast('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.', 'error');
      } else if (error.code === 'auth/unauthorized-domain') {
        showToast('승인되지 않은 도메인입니다. Firebase 설정을 확인해주세요.', 'error');
      } else {
        showToast('로그인에 실패했습니다: ' + error.message, 'error');
      }
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Admin Actions ---
  const updateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await setDoc(doc(db, 'settings', 'global'), {
      timetableLink: formData.get('timetableLink'),
      schoolLink: formData.get('schoolLink')
    }, { merge: true });
    showToast('설정이 업데이트되었습니다!', 'success');
  };

  const addSchoolEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await addDoc(collection(db, 'schoolEvents'), {
      title: formData.get('title'),
      date: formData.get('date'),
      description: formData.get('description')
    });
    form.reset();
  };

  const addNotice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await addDoc(collection(db, 'notices'), {
      title: formData.get('title'),
      content: formData.get('content'),
      link: formData.get('link'),
      createdAt: Timestamp.now()
    });
    form.reset();
  };

  const addAssessment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await addDoc(collection(db, 'assessments'), {
      subject: formData.get('subject'),
      title: formData.get('title'),
      dueDate: formData.get('dueDate'),
      description: formData.get('description')
    });
    form.reset();
  };

  const addExamScope = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await addDoc(collection(db, 'examScopes'), {
      subject: formData.get('subject'),
      scope: formData.get('scope'),
      examType: formData.get('examType')
    });
    form.reset();
  };

  const addExamDate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await addDoc(collection(db, 'examDates'), {
      eventName: formData.get('eventName'),
      date: formData.get('date')
    });
    form.reset();
  };

  const addBirthday = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await addDoc(collection(db, 'birthdays'), {
      name: formData.get('name'),
      date: formData.get('date'),
      type: formData.get('type')
    });
    form.reset();
  };

  const addPeUniformDay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await addDoc(collection(db, 'peUniformDays'), {
      dayOfWeek: formData.get('dayOfWeek'),
      note: formData.get('note')
    });
    form.reset();
  };

  const submitRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }
    const form = e.currentTarget;
    const formData = new FormData(form);
    await addDoc(collection(db, 'requests'), {
      content: formData.get('content'),
      status: 'pending',
      createdAt: Timestamp.now(),
      uid: user.uid,
      userName: user.displayName || '익명'
    });
    form.reset();
    showToast('요청이 제출되었습니다!', 'success');
  };

  const addQuickLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await addDoc(collection(db, 'quickLinks'), {
      title: formData.get('title'),
      url: formData.get('url'),
      color: formData.get('color') || 'indigo'
    });
    form.reset();
  };

  const updateRequestStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, 'requests', id), { status });
  };

  const deleteItem = async (col: string, id: string) => {
    setConfirmModal({
      message: '정말 삭제하시겠습니까?',
      onConfirm: async () => {
        await deleteDoc(doc(db, col, id));
        showToast('삭제되었습니다.', 'success');
        setConfirmModal(null);
      }
    });
  };

  // --- Render Helpers ---

  const renderDDay = () => {
    const upcoming = examDates
      .filter(ed => isAfter(parseISO(ed.date), startOfDay(new Date())))
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())[0];

    if (!upcoming) return <div className="text-stone-400 text-sm italic">등록된 시험 일정이 없습니다.</div>;

    const days = differenceInDays(parseISO(upcoming.date), startOfDay(new Date()));
    return (
      <div className="flex flex-col items-center justify-center py-4">
        <span className="text-stone-500 text-sm font-medium mb-1">{upcoming.eventName}까지</span>
        <div className="text-5xl font-black text-emerald-500 tracking-tighter">D-{days}</div>
        <span className="text-stone-400 text-xs mt-2">{format(parseISO(upcoming.date), 'yyyy년 MM월 dd일')}</span>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"
      />
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] text-stone-900 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-black/5 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">G</div>
          <h1 className="text-xl font-bold tracking-tight">GOAT 3-3</h1>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-stone-600 transition-colors active:scale-90">
              <LogOut size={20} />
            </button>
          ) : (
            <button onClick={handleLogin} className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-emerald-600 active:scale-95 transition-all shadow-sm">
              <LogIn size={16} />
              <span>로그인</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 scroll-container max-w-md mx-auto w-full px-6 pt-8 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* D-Day Card */}
              <Card className="bg-emerald-50/50 border-emerald-100">
                {renderDDay()}
              </Card>

              {/* Latest Notice */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                    <Bell size={14} /> 최근 공지
                  </h2>
                </div>
                {notices.length > 0 ? (
                  <Card className="hover:border-emerald-200 transition-colors cursor-pointer" onClick={() => setActiveTab('notices')}>
                    <h3 className="font-bold text-lg mb-1">{notices[0].title}</h3>
                    <p className="text-stone-500 text-sm line-clamp-2 mb-3">{notices[0].content}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 text-xs">{format(notices[0].createdAt.toDate(), 'MM/dd HH:mm')}</span>
                      <ChevronRight size={16} className="text-stone-300" />
                    </div>
                  </Card>
                ) : (
                  <div className="text-center py-8 text-stone-400 text-sm italic">새로운 공지가 없습니다.</div>
                )}
              </section>

              {/* Quick Links */}
              <section>
                <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ExternalLink size={14} /> 바로가기
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <a 
                    href={settings?.schoolLink || "#"} 
                    target={settings?.schoolLink ? "_blank" : "_self"}
                    rel="noreferrer" 
                    onClick={(e) => { if(!settings?.schoolLink) { e.preventDefault(); showToast('학교 홈페이지 링크가 아직 등록되지 않았습니다.', 'info'); } }}
                    className="bg-white p-4 rounded-2xl border border-black/5 flex flex-col items-center gap-2 hover:bg-stone-50 transition-colors relative group"
                  >
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                      <BookOpen size={20} />
                    </div>
                    <span className="text-xs font-bold">학교 홈페이지</span>
                  </a>
                  <a 
                    href={settings?.timetableLink || "#"} 
                    target={settings?.timetableLink ? "_blank" : "_self"}
                    rel="noreferrer"
                    onClick={(e) => { if(!settings?.timetableLink) { e.preventDefault(); showToast('시간표 링크가 아직 등록되지 않았습니다.', 'info'); } }}
                    className="bg-white p-4 rounded-2xl border border-black/5 flex flex-col items-center gap-2 hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
                      <Calendar size={20} />
                    </div>
                    <span className="text-xs font-bold">우리반 시간표</span>
                  </a>

                  {quickLinks.map(link => (
                    <div key={link.id} className="relative group">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="bg-white p-4 rounded-2xl border border-black/5 flex flex-col items-center gap-2 hover:bg-stone-50 transition-colors w-full h-full"
                      >
                        <div className={`w-10 h-10 bg-${link.color || 'indigo'}-50 text-${link.color || 'indigo'}-500 rounded-full flex items-center justify-center`}>
                          <ExternalLink size={20} />
                        </div>
                        <span className="text-xs font-bold">{link.title}</span>
                      </a>
                      {isAdmin && (
                        <button 
                          onClick={(e) => { e.preventDefault(); deleteItem('quickLinks', link.id); }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'notices' && (
            <motion.div 
              key="notices"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-black tracking-tight mb-6">공지사항</h2>
              
              {/* PE Uniform Section */}
              <section className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-500" /> 체육복 챙기는 날
                  </h3>
                  {isAdmin && (
                    <button onClick={() => setActiveTab('admin')} className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                      <Plus size={12} /> 추가/수정
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {['월', '화', '수', '목', '금'].map(day => {
                    const peDay = peUniformDays.find(d => d.dayOfWeek === day);
                    return (
                      <div 
                        key={day} 
                        className={`flex-1 min-w-[60px] p-3 rounded-2xl border text-center transition-all ${peDay ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-black/5 text-stone-300'}`}
                      >
                        <div className="text-xs font-black mb-1">{day}</div>
                        {peDay ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            {peDay.note && <div className="text-[8px] leading-tight opacity-70">{peDay.note}</div>}
                            {isAdmin && (
                              <button onClick={() => deleteItem('peUniformDays', peDay.id)} className="mt-1 text-emerald-300 hover:text-red-500">
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px]">-</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {notices.map(notice => (
                <Card key={notice.id}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{notice.title}</h3>
                    {isAdmin && (
                      <button onClick={() => deleteItem('notices', notice.id)} className="text-stone-400 hover:text-red-500 bg-stone-50 p-2 rounded-full transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <p className="text-stone-600 text-sm whitespace-pre-wrap mb-4">{notice.content}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-black/5">
                    <span className="text-stone-400 text-xs">{format(notice.createdAt.toDate(), 'yyyy.MM.dd HH:mm')}</span>
                    {notice.link && (
                      <a href={notice.link} target="_blank" rel="noreferrer" className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                        링크 이동 <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </motion.div>
          )}

          {(activeTab === 'academic' || activeTab === 'schedule') && (
            <motion.div 
              key="academic-combined"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <h2 className="text-2xl font-black tracking-tight mb-6">학업 및 일정</h2>
              
              {/* Exam D-Day (if any) */}
              <Card className="bg-emerald-50/50 border-emerald-100">
                {renderDDay()}
              </Card>

              {/* PE Uniform Section */}
              <section className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-500" /> 체육복 챙기는 날
                  </h3>
                  {isAdmin && (
                    <button onClick={() => setActiveTab('admin')} className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                      <Plus size={12} /> 추가/수정
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {['월', '화', '수', '목', '금'].map(day => {
                    const peDay = peUniformDays.find(d => d.dayOfWeek === day);
                    return (
                      <div 
                        key={day} 
                        className={`flex-1 min-w-[60px] p-3 rounded-2xl border text-center transition-all ${peDay ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-black/5 text-stone-300'}`}
                      >
                        <div className="text-xs font-black mb-1">{day}</div>
                        {peDay ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            {peDay.note && <div className="text-[8px] leading-tight opacity-70">{peDay.note}</div>}
                            {isAdmin && (
                              <button onClick={() => deleteItem('peUniformDays', peDay.id)} className="mt-1 text-emerald-300 hover:text-red-500">
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px]">-</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen size={14} /> 수행평가
                  </h3>
                  {isAdmin && (
                    <button onClick={() => setActiveTab('admin')} className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                      <Plus size={12} /> 추가
                    </button>
                  )}
                </div>
                {assessments.length > 0 ? assessments.map(item => (
                  <Card key={item.id}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col gap-1">
                        <Badge variant="info">{item.subject}</Badge>
                        <h3 className="font-bold text-lg">{item.title}</h3>
                      </div>
                      {isAdmin && (
                        <button onClick={() => deleteItem('assessments', item.id)} className="text-stone-300 hover:text-red-500 bg-stone-50 p-2 rounded-full">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <p className="text-stone-600 text-sm mb-4">{item.description}</p>
                    <div className="flex items-center gap-2 text-stone-400 text-xs font-medium">
                      <Clock size={12} />
                      <span>마감일: {item.dueDate}</span>
                    </div>
                  </Card>
                )) : (
                  <p className="text-center py-8 text-stone-400 text-sm italic">등록된 수행평가가 없습니다.</p>
                )}
              </section>

              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle size={14} /> 시험 범위
                  </h3>
                  {isAdmin && (
                    <button onClick={() => setActiveTab('admin')} className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                      <Plus size={12} /> 추가
                    </button>
                  )}
                </div>
                
                {['1-mid', '1-final', '2-mid', '2-final'].map(type => {
                  const filtered = examScopes.filter(item => item.examType === type);
                  if (filtered.length === 0) return null;
                  
                  const typeLabel = {
                    '1-mid': '1학기 중간고사',
                    '1-final': '1학기 기말고사',
                    '2-mid': '2학기 중간고사',
                    '2-final': '2학기 기말고사'
                  }[type as '1-mid' | '1-final' | '2-mid' | '2-final'];

                  return (
                    <div key={type} className="space-y-3">
                      <h4 className="text-xs font-black text-stone-400 border-b border-black/5 pb-1">{typeLabel}</h4>
                      <div className="space-y-3">
                        {filtered.map(item => (
                          <Card key={item.id} className="border-l-4 border-l-emerald-500">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <span className="text-xs font-bold text-emerald-600">{item.subject}</span>
                                <p className="text-sm text-stone-700 whitespace-pre-wrap">{item.scope}</p>
                              </div>
                              {isAdmin && (
                                <button onClick={() => deleteItem('examScopes', item.id)} className="text-stone-300 hover:text-red-500 bg-stone-50 p-2 rounded-full">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {examScopes.length === 0 && (
                  <p className="text-center py-8 text-stone-400 text-sm italic">등록된 시험 범위가 없습니다.</p>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle size={14} /> 시험 일정
                  </h3>
                  {isAdmin && (
                    <button onClick={() => setActiveTab('admin')} className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                      <Plus size={12} /> 추가
                    </button>
                  )}
                </div>
                {examDates.length > 0 ? examDates.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-black/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-sm">{item.eventName}</div>
                        <div className="text-xs text-stone-400">{item.date}</div>
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deleteItem('examDates', item.id)} className="text-stone-300 hover:text-red-500 bg-stone-50 p-2 rounded-full">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )) : (
                  <p className="text-center py-8 text-stone-400 text-sm italic">등록된 시험 일정이 없습니다.</p>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} /> 행사 일정
                  </h3>
                  {isAdmin && (
                    <button onClick={() => setActiveTab('admin')} className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                      <Plus size={12} /> 추가
                    </button>
                  )}
                </div>
                {schoolEvents.length > 0 ? schoolEvents.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-black/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                        <Clock size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-sm">{item.title}</div>
                        <div className="text-xs text-stone-400">{item.date}</div>
                        {item.description && <p className="text-[10px] text-stone-500 mt-1">{item.description}</p>}
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deleteItem('schoolEvents', item.id)} className="text-stone-300 hover:text-red-500 bg-stone-50 p-2 rounded-full">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )) : (
                  <p className="text-center py-8 text-stone-400 text-sm italic">등록된 행사 일정이 없습니다.</p>
                )}
              </section>
            </motion.div>
          )}

          {activeTab === 'birthdays' && (
            <motion.div 
              key="birthdays"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black tracking-tight">생일 축하해! 🎂</h2>
                {isAdmin && (
                  <button onClick={() => setActiveTab('admin')} className="text-xs font-bold text-emerald-500 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-full">
                    <Plus size={14} /> 생일 추가
                  </button>
                )}
              </div>
              {birthdays.sort((a,b) => a.date.localeCompare(b.date)).map(item => (
                <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-black/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.type === 'teacher' ? 'bg-indigo-50 text-indigo-500' : 'bg-pink-50 text-pink-500'}`}>
                      <Gift size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{item.name}</span>
                        <Badge variant={item.type === 'teacher' ? 'info' : 'default'}>
                          {item.type === 'teacher' ? '선생님' : '친구'}
                        </Badge>
                      </div>
                      <div className="text-xs text-stone-400">{item.date}</div>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteItem('birthdays', item.id)} className="text-stone-400 hover:text-red-500 bg-stone-50 p-2 rounded-full transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'requests' && (
            <motion.div 
              key="requests"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-black tracking-tight mb-6">내용추가 요청</h2>
              
              <Card className="bg-emerald-600 text-white border-none shadow-xl">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <MessageSquare size={18} /> 무엇이든 말해주세요!
                </h3>
                <p className="text-emerald-100 text-xs mb-4">앱에 추가하고 싶은 내용이나 수정사항을 요청해주세요.</p>
                <form onSubmit={submitRequest} className="space-y-3">
                  <textarea 
                    name="content" 
                    required 
                    placeholder="추가하고 싶은 내용을 입력하세요..." 
                    className="w-full bg-white text-stone-900 rounded-xl p-4 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-white/20 min-h-[120px] shadow-inner"
                  />
                  {!user ? (
                    <button 
                      type="button" 
                      onClick={handleLogin}
                      className="w-full bg-amber-400 text-amber-900 font-black py-3 rounded-xl text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <LogIn size={16} />
                      로그인 후 제출하기
                    </button>
                  ) : (
                    <button type="submit" className="w-full bg-white text-emerald-600 font-black py-3 rounded-xl text-sm shadow-lg active:scale-95 transition-all">
                      제출하기
                    </button>
                  )}
                </form>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">요청 목록</h3>
                  {user && (
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">
                      내 요청 확인 가능
                    </span>
                  )}
                </div>
                {requests.length > 0 ? requests.map(req => {
                  const isMyRequest = user && req.uid === user.uid;
                  if (!isAdmin && !isMyRequest) return null;

                  return (
                    <Card key={req.id} className={isMyRequest ? "border-emerald-200 bg-emerald-50/30" : ""}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          {req.status === 'completed' ? (
                            <Badge variant="success">완료</Badge>
                          ) : req.status === 'in-progress' ? (
                            <Badge variant="info">진행중</Badge>
                          ) : (
                            <Badge variant="warning">대기중</Badge>
                          )}
                          <span className="text-[10px] text-stone-400 font-medium">
                            {format(req.createdAt.toDate(), 'MM/dd')}
                          </span>
                          {isMyRequest && <Badge variant="info">내 요청</Badge>}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <select 
                              value={req.status} 
                              onChange={(e) => updateRequestStatus(req.id, e.target.value)}
                              className="text-[10px] bg-stone-50 border border-black/5 rounded p-1"
                            >
                              <option value="pending">대기중</option>
                              <option value="in-progress">진행중</option>
                              <option value="completed">완료</option>
                            </select>
                            <button onClick={() => deleteItem('requests', req.id)} className="text-stone-300 hover:text-red-500 bg-stone-50 p-1.5 rounded-full">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-stone-700 font-medium">{req.content}</p>
                      {isAdmin && req.userName && (
                        <div className="text-[10px] text-stone-400 mt-1">작성자: {req.userName}</div>
                      )}
                    </Card>
                  );
                }) : (
                  <p className="text-center py-8 text-stone-400 text-sm italic">아직 요청이 없습니다.</p>
                )}
                {!isAdmin && requests.filter(r => user && r.uid === user.uid).length === 0 && requests.length > 0 && (
                  <p className="text-center py-4 text-stone-400 text-xs italic">내가 보낸 요청이 여기에 표시됩니다.</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <h2 className="text-2xl font-black tracking-tight mb-6">관리자 패널</h2>
              
              <Card className="bg-stone-900 text-white border-none">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <Trash2 size={18} className="text-red-400" /> 일정 삭제 방법
                </h3>
                <p className="text-stone-400 text-xs leading-relaxed">
                  각 탭(홈, 공지, 학업/일정 등)에서 항목 옆에 있는 <span className="text-red-400 font-bold">빨간색 쓰레기통 아이콘</span>을 누르면 해당 일정을 즉시 삭제할 수 있습니다.
                </p>
              </Card>

              <section className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Settings size={18} /> 기본 설정</h3>
                <form onSubmit={updateSettings} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">학교 홈페이지 링크</label>
                    <input 
                      name="schoolLink" 
                      defaultValue={settings?.schoolLink} 
                      placeholder="https://..." 
                      className="w-full p-3 rounded-xl border border-black/5 text-sm" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">시간표 링크</label>
                    <input 
                      name="timetableLink" 
                      defaultValue={settings?.timetableLink} 
                      placeholder="https://..." 
                      className="w-full p-3 rounded-xl border border-black/5 text-sm" 
                    />
                  </div>
                  <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm">설정 저장</button>
                </form>
              </section>

              <section className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><ExternalLink size={18} /> 바로가기 추가</h3>
                <form onSubmit={addQuickLink} className="space-y-3">
                  <input name="title" required placeholder="사이트 이름 (예: 급식표)" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <input name="url" required placeholder="https://..." className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <select name="color" className="w-full p-3 rounded-xl border border-black/5 text-sm">
                    <option value="indigo">인디고 (기본)</option>
                    <option value="emerald">에메랄드</option>
                    <option value="amber">앰버</option>
                    <option value="rose">로즈</option>
                    <option value="sky">스카이</option>
                    <option value="violet">바이올렛</option>
                  </select>
                  <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl text-sm">바로가기 등록</button>
                </form>
              </section>

              <section className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> 공지 추가</h3>
                <form onSubmit={addNotice} className="space-y-3">
                  <input name="title" required placeholder="제목" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <textarea name="content" required placeholder="내용" className="w-full p-3 rounded-xl border border-black/5 text-sm min-h-[100px]" />
                  <input name="link" placeholder="링크 (선택)" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl text-sm">등록</button>
                </form>
              </section>

              <section className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> 수행평가 추가</h3>
                <form onSubmit={addAssessment} className="space-y-3">
                  <input name="subject" required placeholder="과목 (예: 국어)" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <input name="title" required placeholder="평가 제목" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <input name="dueDate" type="date" required className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <textarea name="description" placeholder="상세 내용" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl text-sm">등록</button>
                </form>
              </section>

              <section className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> 시험 범위 추가</h3>
                <form onSubmit={addExamScope} className="space-y-3">
                  <select name="examType" required className="w-full p-3 rounded-xl border border-black/5 text-sm">
                    <option value="1-mid">1학기 중간고사</option>
                    <option value="1-final">1학기 기말고사</option>
                    <option value="2-mid">2학기 중간고사</option>
                    <option value="2-final">2학기 기말고사</option>
                  </select>
                  <input name="subject" required placeholder="과목" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <textarea name="scope" required placeholder="범위" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl text-sm">등록</button>
                </form>
              </section>

              <section className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> 시험 일정 추가</h3>
                <form onSubmit={addExamDate} className="space-y-3">
                  <input name="eventName" required placeholder="일정 이름 (예: 중간고사)" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <input name="date" type="date" required className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl text-sm">등록</button>
                </form>
              </section>

              <section className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> 행사 일정 추가</h3>
                <form onSubmit={addSchoolEvent} className="space-y-3">
                  <input name="title" required placeholder="행사 이름" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <input name="date" type="date" required className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <textarea name="description" placeholder="상세 내용" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl text-sm">등록</button>
                </form>
              </section>

              <section className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> 체육복 날 추가</h3>
                <form onSubmit={addPeUniformDay} className="space-y-3">
                  <select name="dayOfWeek" required className="w-full p-3 rounded-xl border border-black/5 text-sm">
                    <option value="월">월요일</option>
                    <option value="화">화요일</option>
                    <option value="수">수요일</option>
                    <option value="목">목요일</option>
                    <option value="금">금요일</option>
                  </select>
                  <input name="note" placeholder="참고사항 (예: 5교시)" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl text-sm">등록</button>
                </form>
              </section>

              <section className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> 생일 추가</h3>
                <form onSubmit={addBirthday} className="space-y-3">
                  <input name="name" required placeholder="이름" className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <input name="date" type="date" required className="w-full p-3 rounded-xl border border-black/5 text-sm" />
                  <select name="type" className="w-full p-3 rounded-xl border border-black/5 text-sm">
                    <option value="student">학생</option>
                    <option value="teacher">선생님</option>
                  </select>
                  <button type="submit" className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl text-sm">등록</button>
                </form>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-black/5 px-4 pt-3 pb-[calc(0.75rem+var(--safe-area-inset-bottom))] flex items-center justify-around z-40">
        <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={20} />} label="홈" />
        <NavButton active={activeTab === 'notices'} onClick={() => setActiveTab('notices')} icon={<Bell size={20} />} label="공지" />
        <NavButton active={activeTab === 'academic'} onClick={() => setActiveTab('academic')} icon={<BookOpen size={20} />} label="학업/일정" />
        <NavButton active={activeTab === 'birthdays'} onClick={() => setActiveTab('birthdays')} icon={<Gift size={20} />} label="생일" />
        <NavButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} icon={<MessageSquare size={20} />} label="요청" />
        {isAdmin && (
          <NavButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<ShieldCheck size={20} />} label="관리" />
        )}
      </nav>

      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>

      <Modal 
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        title="삭제 확인"
        message={confirmModal?.message || ""}
      />
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${active ? 'text-emerald-500' : 'text-stone-400'}`}
    >
      <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-emerald-50' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold tracking-tight">{label}</span>
    </button>
  );
}
