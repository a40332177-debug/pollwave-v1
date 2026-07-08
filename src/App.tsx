import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Play, Pause, Square, Eye, LogOut, Share2, Users, User, MessageSquare,
  ThumbsUp, ThumbsDown, Clock, BarChart3, HelpCircle, 
  ListOrdered, ChevronRight, Award, Zap, CheckCircle, Flame, LogIn
} from 'lucide-react';
import { ClassroomSession, Poll, PollType, ChatMessage, Student, StudentResponse } from './types.js';
import LeaderboardView from './components/LeaderboardView.jsx';
import ChatView from './components/ChatView.jsx';

export default function App() {
  // Navigation & Role State
  const [currentView, setCurrentView] = useState<'landing' | 'teacher_login' | 'teacher_dashboard' | 'student_dashboard'>('landing');
  const [currentUserRole, setCurrentUserRole] = useState<'teacher' | 'student' | null>(null);
  const [currentSession, setCurrentSession] = useState<ClassroomSession | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [sessionIdInput, setSessionIdInput] = useState('');

  // Login inputs
  const [teacherLoginName, setTeacherLoginName] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  // Create Poll Form inputs
  const [pollType, setPollType] = useState<PollType>('mcq');
  const [pollQuestion, setPollQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [pollDuration, setPollDuration] = useState<number>(30);

  // Student answer state
  const [selectedStudentAnswer, setSelectedStudentAnswer] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);

  // Active student tab
  const [activeStudentTab, setActiveStudentTab] = useState<'poll' | 'leaderboard' | 'chat'>('poll');
  const [activeTeacherTab, setActiveTeacherTab] = useState<'live' | 'create' | 'leaderboard' | 'chat'>('live');

  // Error/Success Notification State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Poll intervals
  const sessionPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Show status popups temporarily
  const showNotification = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Start polling session state
  const startSessionPolling = (sessionId: string) => {
    // Clear any existing poll intervals
    if (sessionPollIntervalRef.current) clearInterval(sessionPollIntervalRef.current);

    let consecutiveErrors = 0;

    sessionPollIntervalRef.current = setInterval(() => {
      fetch(`/api/sessions/${sessionId}`)
        .then((res) => {
          if (res.status === 404) {
            // Session genuinely deleted or ended
            throw { status: 404, message: 'Session disconnected or ended' };
          }
          if (!res.ok) {
            throw { status: res.status, message: 'Server returned an error' };
          }
          return res.json();
        })
        .then((data: ClassroomSession) => {
          consecutiveErrors = 0; // reset on successful poll
          setCurrentSession(data);
          
          // Reset student submitted state if current poll changed or ended
          const currentPollId = data.currentPoll?.id;
          if (!currentPollId) {
            setIsAnswerSubmitted(false);
            setSelectedStudentAnswer(null);
          }
        })
        .catch((err) => {
          console.error('Polling error:', err);
          
          if (err && err.status === 404) {
            // Immediate kick out for 404
            handleLogoutOrLeave('Classroom session was ended by the teacher.');
          } else {
            // Generic network/server error - retry up to 10 times (10 seconds) before kicking out
            consecutiveErrors++;
            if (consecutiveErrors >= 10) {
              handleLogoutOrLeave('Connection lost. Classroom session ended or unreachable.');
            } else {
              console.warn(`Polling failed. Retrying... (${consecutiveErrors}/10)`);
            }
          }
        });
    }, 1000);
  };

  // Start student heartbeat ping to keep them alive in list
  const startStudentHeartbeat = (sessionId: string, name: string) => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

    heartbeatIntervalRef.current = setInterval(() => {
      fetch(`/api/sessions/${sessionId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: name }),
      }).catch((err) => console.error('Heartbeat error:', err));
    }, 5000);
  };

  // Stop all timers
  const stopAllTimers = () => {
    if (sessionPollIntervalRef.current) clearInterval(sessionPollIntervalRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAllTimers();
  }, []);

  // Handlers

  // Teacher Login
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: teacherLoginName, password: teacherPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Login failed', 'error');
        return;
      }
      setTeacherName(data.teacherName);
      setCurrentUserRole('teacher');
      setCurrentView('teacher_dashboard');
      showNotification('Successfully authenticated!', 'success');
    } catch (err) {
      showNotification('Connection failure during login', 'error');
    }
  };

  // Create Session
  const handleCreateSession = async () => {
    setErrorMessage(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherName }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Failed to create classroom session', 'error');
        return;
      }
      setCurrentSession(data);
      startSessionPolling(data.id);
      showNotification(`Session created successfully! ID: ${data.id}`, 'success');
    } catch (err) {
      showNotification('Failed to communicate with server', 'error');
    }
  };

  // Student Join
  const handleStudentJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!studentName.trim() || !sessionIdInput.trim()) {
      showNotification('Please fill in your name and a valid Session ID.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/sessions/${sessionIdInput.trim()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: studentName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Failed to join session', 'error');
        return;
      }
      setCurrentSession(data);
      setCurrentUserRole('student');
      setCurrentView('student_dashboard');
      startSessionPolling(data.id);
      startStudentHeartbeat(data.id, studentName.trim());
      showNotification(`Successfully joined session ${data.id}!`, 'success');
    } catch (err) {
      showNotification('Failed to join classroom session. Verify your connection.', 'error');
    }
  };

  // Create Poll (Teacher)
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    if (!pollQuestion.trim()) {
      showNotification('Please enter a poll question or statement.', 'error');
      return;
    }

    if (pollType === 'mcq' && (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim())) {
      showNotification('Please fill in all options (A, B, C, D) for Multiple Choice Poll.', 'error');
      return;
    }

    const payload = {
      type: pollType,
      question: pollQuestion.trim(),
      options: pollType === 'mcq' ? {
        A: optionA.trim(),
        B: optionB.trim(),
        C: optionC.trim(),
        D: optionD.trim()
      } : undefined,
      correctAnswer: pollType === 'mcq' ? correctAnswer : undefined,
      duration: pollDuration
    };

    try {
      const res = await fetch(`/api/sessions/${currentSession.id}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Failed to create poll', 'error');
        return;
      }
      setCurrentSession(data);
      // Reset form states
      setPollQuestion('');
      setOptionA('');
      setOptionB('');
      setOptionC('');
      setOptionD('');
      setActiveTeacherTab('live');
      showNotification('Poll is set up and ready!', 'success');
    } catch (err) {
      showNotification('Error creating poll', 'error');
    }
  };

  // Control Poll (Teacher Action)
  const handleControlPoll = async (action: 'start' | 'pause' | 'stop' | 'reveal' | 'end') => {
    if (!currentSession || !currentSession.currentPoll) return;
    try {
      const res = await fetch(`/api/sessions/${currentSession.id}/polls/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Action failed', 'error');
        return;
      }
      setCurrentSession(data);
      showNotification(`Poll status updated: ${action}`, 'success');
    } catch (err) {
      showNotification('Error controlling poll', 'error');
    }
  };

  // Submit Answer (Student)
  const handleStudentSubmitAnswer = async (answer: string) => {
    if (!currentSession || !currentSession.currentPoll) return;
    if (isAnswerSubmitted) return;

    setSelectedStudentAnswer(answer);

    try {
      const res = await fetch(`/api/sessions/${currentSession.id}/polls/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, answer }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Failed to submit response', 'error');
        return;
      }
      setIsAnswerSubmitted(true);
      showNotification('Response submitted successfully!', 'success');
    } catch (err) {
      showNotification('Error submitting your response', 'error');
    }
  };

  // Send Chat Message
  const handleSendChatMessage = async (text: string) => {
    if (!currentSession) return;
    const sender = currentUserRole === 'teacher' ? teacherName : studentName;
    try {
      const res = await fetch(`/api/sessions/${currentSession.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, role: currentUserRole, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Failed to send message', 'error');
        return;
      }
      setCurrentSession(data);
    } catch (err) {
      showNotification('Error sending message', 'error');
    }
  };

  // End classroom session (Teacher deletes, students are kicked)
  const handleEndSession = async () => {
    if (!currentSession) return;
    if (!window.confirm('Are you sure you want to end this session? All active students will be disconnected.')) return;
    try {
      await fetch(`/api/sessions/${currentSession.id}`, { method: 'DELETE' });
      handleLogoutOrLeave('Classroom session ended successfully.');
    } catch (err) {
      showNotification('Error closing room', 'error');
    }
  };

  // Logout or exit the session cleanly
  const handleLogoutOrLeave = (message: string) => {
    stopAllTimers();
    setCurrentSession(null);
    setCurrentUserRole(null);
    setSelectedStudentAnswer(null);
    setIsAnswerSubmitted(false);
    setCurrentView('landing');
    if (message) showNotification(message, 'success');
  };

  // Computed Values

  // Live responses for the current poll
  const activePollResponses: { [studentName: string]: StudentResponse } = currentSession && currentSession.currentPoll 
    ? (currentSession.responses[currentSession.currentPoll.id] || {}) 
    : {};
  const responseCount = Object.keys(activePollResponses).length;
  const connectedStudentsCount = currentSession ? Object.keys(currentSession.students).length : 0;

  // Percentage calculation helper
  const getResponsePercentages = () => {
    const defaultStats = {
      A: 0, B: 0, C: 0, D: 0,
      ThumbsUp: 0, ThumbsDown: 0,
      counts: { A: 0, B: 0, C: 0, D: 0, ThumbsUp: 0, ThumbsDown: 0 }
    };
    if (!currentSession?.currentPoll) return defaultStats;
    const responses = activePollResponses;
    const total = Object.keys(responses).length || 1;

    const counts = { A: 0, B: 0, C: 0, D: 0, ThumbsUp: 0, ThumbsDown: 0 };
    Object.values(responses).forEach((r) => {
      if (r.answer === 'A' || r.answer === 'B' || r.answer === 'C' || r.answer === 'D') {
        counts[r.answer as 'A'|'B'|'C'|'D']++;
      } else if (r.answer === 'ThumbsUp' || r.answer === 'ThumbsDown') {
        counts[r.answer as 'ThumbsUp'|'ThumbsDown']++;
      }
    });

    return {
      A: Math.round((counts.A / total) * 100),
      B: Math.round((counts.B / total) * 100),
      C: Math.round((counts.C / total) * 100),
      D: Math.round((counts.D / total) * 100),
      ThumbsUp: Math.round((counts.ThumbsUp / total) * 100),
      ThumbsDown: Math.round((counts.ThumbsDown / total) * 100),
      counts
    };
  };

  const percentages = getResponsePercentages();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* Sleek Gradient Overlay Header background */}
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-blue-900/10 via-purple-900/5 to-transparent pointer-events-none" />

      {/* Persistent Toast Notifications */}
      {errorMessage && (
        <div id="error-toast" className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-red-950/80 border border-red-800/80 backdrop-blur-md text-red-200 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 max-w-md text-sm animate-bounce">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <p className="font-medium">{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div id="success-toast" className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 border border-emerald-500/40 backdrop-blur-md text-emerald-300 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 max-w-md text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {/* Header bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md py-4 px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleLogoutOrLeave('')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Flame className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-wider flex items-center gap-1.5 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                PollWave
              </h1>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block">Live Classroom Polling</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentSession && (
              <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-1.5 rounded-full border border-slate-800 text-xs text-slate-300 font-medium">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Share2 className="w-3.5 h-3.5" />
                  Code: <strong className="text-white text-sm font-mono tracking-wider">{currentSession.id}</strong>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  {connectedStudentsCount} Connected
                </span>
              </div>
            )}

            {currentView !== 'landing' && currentView !== 'teacher_login' && (
              <button
                id="header-logout-btn"
                onClick={() => handleLogoutOrLeave('Left classroom successfully.')}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-800 hover:border-slate-700 transition-all"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                Leave
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 z-10 flex flex-col items-center justify-center">

        {/* 1. LANDING PAGE */}
        {currentView === 'landing' && (
          <div id="landing-screen" className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center py-8">
            
            {/* Visual Callout */}
            <div className="space-y-6 text-center md:text-left pr-0 md:pr-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-semibold text-blue-400">
                <span>⚡ Reimagined Student Interactivity</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
                Transform any lesson with <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Live Polling</span>
              </h2>
              <p className="text-slate-400 text-base md:text-lg leading-relaxed">
                Connect teachers and students instantly without bloated apps. Host dual-mode question-and-answer games, gauge consensus with smart votes, and track speeds on gold podiums.
              </p>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-900">
                <div>
                  <h4 className="text-xl font-bold text-white font-mono">0s</h4>
                  <p className="text-xs text-slate-500">Account Setup for Students</p>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white font-mono">MCQ / Vote</h4>
                  <p className="text-xs text-slate-500">Flexible Poll Types</p>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white font-mono">🥇🥈🥉</h4>
                  <p className="text-xs text-slate-500">Leaderboard Podium</p>
                </div>
              </div>
            </div>

            {/* Quick-Access Forms (Student join card and Teacher trigger) */}
            <div className="flex flex-col gap-6">
              
              {/* Student Join Form Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 p-6 md:p-8 rounded-3xl shadow-xl backdrop-blur-md">
                <h3 className="text-lg font-bold text-white mb-1">Join as Student</h3>
                <p className="text-xs text-slate-400 mb-6">Enter details provided by your instructor to connect.</p>

                <form onSubmit={handleStudentJoin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">Your Name</label>
                    <input
                      id="student-name-input"
                      type="text"
                      placeholder="e.g. Alex Rivera"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      required
                      maxLength={25}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">6-Digit Session ID</label>
                    <input
                      id="student-session-id-input"
                      type="text"
                      placeholder="e.g. 128490"
                      value={sessionIdInput}
                      onChange={(e) => setSessionIdInput(e.target.value)}
                      required
                      maxLength={6}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all font-mono tracking-widest text-center text-lg"
                    />
                  </div>

                  <button
                    id="student-join-btn"
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl py-3 text-sm shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all border border-blue-400/20 flex items-center justify-center gap-2"
                  >
                    <span>Connect to Classroom</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* Quick Teacher Portal link */}
              <div className="flex items-center justify-between p-4 bg-slate-900/30 border border-slate-800/60 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <User className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Are you a Teacher?</h5>
                    <p className="text-[11px] text-slate-400">Launch a session for your class.</p>
                  </div>
                </div>

                <button
                  id="go-to-teacher-login-btn"
                  onClick={() => setCurrentView('teacher_login')}
                  className="bg-purple-950/40 hover:bg-purple-900/30 text-purple-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-purple-900/60 transition-all flex items-center gap-1"
                >
                  <LogIn className="w-3 h-3" />
                  Host Session
                </button>
              </div>

            </div>
          </div>
        )}

        {/* 2. TEACHER LOGIN SCREEN */}
        {currentView === 'teacher_login' && (
          <div id="teacher-login-screen" className="w-full max-w-md py-12">
            <div className="bg-slate-900/60 border border-slate-800/80 p-8 rounded-3xl shadow-xl backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
              
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/50 border border-purple-500/20 flex items-center justify-center mx-auto mb-3">
                  <User className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Teacher Portal</h3>
                <p className="text-xs text-slate-400 mt-1">Access dashboard to create classrooms.</p>
              </div>

              <form onSubmit={handleTeacherLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">Teacher Name / Username</label>
                  <input
                    id="teacher-username-input"
                    type="text"
                    placeholder="e.g. teacher"
                    value={teacherLoginName}
                    onChange={(e) => setTeacherLoginName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">Password</label>
                  <input
                    id="teacher-password-input"
                    type="password"
                    placeholder="e.g. password123"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all font-medium"
                  />
                </div>

                <button
                  id="teacher-auth-submit-btn"
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl py-3 text-sm shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 transition-all border border-purple-500/20"
                >
                  Authenticate & Enter
                </button>
              </form>

              {/* Informative Guidance details for credentials */}
              <div className="mt-6 pt-5 border-t border-slate-800/80 text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Sandbox Accounts</span>
                <div className="space-y-1.5 text-xs text-slate-400 font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-900/80 mb-3">
                  <div>• <span className="text-purple-400">teacher</span> / password123</div>
                  <div>• <span className="text-purple-400">admin</span> / admin123</div>
                  <div>• <span className="text-purple-400">professor</span> / pollwave2026</div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed bg-blue-950/20 border border-blue-900/30 p-2.5 rounded-xl">
                  💡 <strong className="text-blue-400">On-the-Fly Registration:</strong> You can also enter <strong>any custom name and password</strong> to automatically register a new host account instantly!
                </p>
              </div>

              <div className="mt-4 text-center">
                <button
                  id="back-to-landing-btn"
                  onClick={() => setCurrentView('landing')}
                  className="text-slate-400 hover:text-white text-xs font-semibold transition-all"
                >
                  ← Back to Student Login
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. TEACHER DASHBOARD PORTAL */}
        {currentView === 'teacher_dashboard' && (
          <div id="teacher-dashboard-screen" className="w-full max-w-6xl py-4 space-y-6">
            
            {/* NO SESSION CREATED STATE */}
            {!currentSession ? (
              <div id="create-session-prompt" className="w-full max-w-xl mx-auto text-center bg-slate-900/60 border border-slate-800 p-8 rounded-3xl shadow-xl backdrop-blur-md space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center mx-auto">
                  <Flame className="w-7 h-7 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Create a New Classroom</h3>
                  <p className="text-slate-400 text-sm mt-1.5">Initialize a dynamic room with an interactive session code for your students.</p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="text-left">
                    <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">Teacher Display Name</label>
                    <input
                      id="teacher-display-name-input"
                      type="text"
                      placeholder="e.g. Dr. Rivera"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all"
                    />
                  </div>

                  <button
                    id="init-session-btn"
                    onClick={handleCreateSession}
                    disabled={!teacherName.trim()}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 text-sm shadow-xl shadow-blue-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Initialize Session Code</span>
                  </button>
                </div>
              </div>
            ) : (
              
              /* ACTIVE CLASSROOM SESSION INTERFACE */
              <div className="space-y-6">
                {/* Info banner / Share bar */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Room Hosted by {currentSession.teacherName}</h3>
                      <p className="text-xs text-slate-400">Manage real-time questions, start/stop timers, and view active leaderboards.</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                    {/* Shareable ID box */}
                    <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-3 font-mono">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Session ID:</span>
                      <span className="text-xl font-extrabold text-blue-400 tracking-widest">{currentSession.id}</span>
                    </div>

                    <button
                      id="close-session-btn"
                      onClick={handleEndSession}
                      className="bg-red-950/40 hover:bg-red-950/60 border border-red-800/50 text-red-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      End Session
                    </button>
                  </div>
                </div>

                {/* Dashboard Tabs */}
                <div className="flex border-b border-slate-800 gap-1 overflow-x-auto">
                  <button
                    id="teacher-tab-live"
                    onClick={() => setActiveTeacherTab('live')}
                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                      activeTeacherTab === 'live' 
                        ? 'border-blue-500 text-blue-400 bg-blue-500/5' 
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Live Dashboard {currentSession.currentPoll && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
                  </button>

                  <button
                    id="teacher-tab-create"
                    onClick={() => setActiveTeacherTab('create')}
                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                      activeTeacherTab === 'create' 
                        ? 'border-purple-500 text-purple-400 bg-purple-500/5' 
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Create Poll
                  </button>

                  <button
                    id="teacher-tab-leaderboard"
                    onClick={() => setActiveTeacherTab('leaderboard')}
                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                      activeTeacherTab === 'leaderboard' 
                        ? 'border-yellow-500 text-yellow-400 bg-yellow-500/5' 
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    Leaderboard
                  </button>

                  <button
                    id="teacher-tab-chat"
                    onClick={() => setActiveTeacherTab('chat')}
                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                      activeTeacherTab === 'chat' 
                        ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' 
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Classroom Chat ({currentSession.chat.length})
                  </button>
                </div>

                {/* Tab Layout Grids */}
                <div className="grid lg:grid-cols-12 gap-6 items-start">
                  
                  {/* LEFT / CENTER VIEW MODULES (9 cols) */}
                  <div className="lg:col-span-8 space-y-6">

                    {/* LIVE VIEW TAB */}
                    {activeTeacherTab === 'live' && (
                      <div id="live-polling-view" className="space-y-6">
                        
                        {!currentSession.currentPoll ? (
                          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-10 text-center space-y-4">
                            <HelpCircle className="w-12 h-12 text-slate-500 mx-auto" />
                            <div>
                              <h4 className="text-lg font-bold text-white">No Active Poll Running</h4>
                              <p className="text-slate-400 text-sm max-w-md mx-auto mt-1">Ready to engage your class? Toggle the "Create Poll" tab to configure and prepare an MCQ or a consensus vote.</p>
                            </div>
                            <button
                              id="quick-goto-create-btn"
                              onClick={() => setActiveTeacherTab('create')}
                              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                            >
                              Configure New Poll
                            </button>
                          </div>
                        ) : (
                          
                          /* CORE POLL CONTROLLER & CHART DASHBOARD */
                          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl backdrop-blur-md">
                            
                            {/* Poll status banner */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-800/80">
                              <div className="flex items-center gap-2.5">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  currentSession.currentPoll.state === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  currentSession.currentPoll.state === 'paused' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                  'bg-slate-800 text-slate-400'
                                }`}>
                                  Status: {currentSession.currentPoll.state}
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                  Type: <strong className="text-white uppercase">{currentSession.currentPoll.type}</strong>
                                </span>
                              </div>

                              {/* Live response / total count */}
                              <div className="text-xs font-semibold text-slate-400 flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-full border border-slate-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                Responses: <strong className="text-white font-mono">{responseCount}</strong> / {connectedStudentsCount} students
                              </div>
                            </div>

                            {/* Question & Options block */}
                            <div>
                              <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Question Statement</h4>
                              <p className="text-xl font-bold text-white leading-relaxed">{currentSession.currentPoll.question}</p>
                            </div>

                            {/* TIMER & PROGRESS DISPLAY */}
                            <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400">
                                  <Clock className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Time Left</span>
                                  <span className="text-lg font-mono font-extrabold text-white">
                                    {currentSession.currentPoll.timeRemaining}s
                                  </span>
                                </div>
                              </div>

                              {/* Progress bar representing remaining percentage */}
                              <div className="flex-1 max-w-xs h-2 bg-slate-900 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                                  style={{ width: `${Math.max(0, Math.min(100, (currentSession.currentPoll.timeRemaining / currentSession.currentPoll.duration) * 100))}%` }}
                                />
                              </div>
                            </div>

                            {/* ACTION CONTROL BUTTONS */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                              
                              {/* 1. Start / Resume Poll */}
                              <button
                                id="teacher-action-start"
                                onClick={() => handleControlPoll('start')}
                                disabled={currentSession.currentPoll.state === 'active' || currentSession.currentPoll.state === 'completed'}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white rounded-xl py-2.5 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                <Play className="w-3.5 h-3.5" />
                                Start Poll
                              </button>

                              {/* 2. Pause Poll */}
                              <button
                                id="teacher-action-pause"
                                onClick={() => handleControlPoll('pause')}
                                disabled={currentSession.currentPoll.state !== 'active'}
                                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-white rounded-xl py-2.5 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                <Pause className="w-3.5 h-3.5" />
                                Pause
                              </button>

                              {/* 3. Stop Poll (Prevents answers instantly) */}
                              <button
                                id="teacher-action-stop"
                                onClick={() => handleControlPoll('stop')}
                                disabled={currentSession.currentPoll.state === 'completed' || currentSession.currentPoll.state === 'idle'}
                                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white rounded-xl py-2.5 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                <Square className="w-3.5 h-3.5" />
                                Stop Poll
                              </button>

                              {/* 4. Reveal Correct Answer (MCQ only) */}
                              {currentSession.currentPoll.type === 'mcq' && (
                                <button
                                  id="teacher-action-reveal"
                                  onClick={() => handleControlPoll('reveal')}
                                  disabled={currentSession.currentPoll.answerRevealed}
                                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-xl py-2.5 px-3 text-xs font-bold transition-all col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Reveal Ans
                                </button>
                              )}

                              {/* 5. End & Clear Poll */}
                              <button
                                id="teacher-action-end"
                                onClick={() => handleControlPoll('end')}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl py-2.5 px-3 text-xs font-bold transition-all col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 border border-slate-700"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                Close Poll
                              </button>

                            </div>

                            {/* LIVE CHART & PERCENTAGES DISPLAY */}
                            <div className="pt-4 border-t border-slate-800/80 space-y-4">
                              <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-blue-400" />
                                Live Response Distribution
                              </h5>

                              {currentSession.currentPoll.type === 'mcq' ? (
                                <div className="space-y-3.5">
                                  {['A', 'B', 'C', 'D'].map((opt) => {
                                    const percent = percentages[opt as 'A'|'B'|'C'|'D'] || 0;
                                    const count = percentages.counts ? percentages.counts[opt as 'A'|'B'|'C'|'D'] : 0;
                                    const isCorrectOpt = currentSession.currentPoll?.correctAnswer === opt;
                                    const isRevealed = currentSession.currentPoll?.answerRevealed;

                                    return (
                                      <div key={opt} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                          <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 rounded-md font-mono font-extrabold flex items-center justify-center text-xs ${
                                              isRevealed && isCorrectOpt 
                                                ? 'bg-emerald-500 text-slate-950 border border-emerald-400' 
                                                : 'bg-slate-800 text-slate-300'
                                            }`}>
                                              {opt}
                                            </span>
                                            <span className="text-slate-300 truncate max-w-sm">
                                              {currentSession.currentPoll?.options?.[opt as 'A'|'B'|'C'|'D']}
                                            </span>
                                            {isRevealed && isCorrectOpt && (
                                              <span className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider">✔ Correct Answer</span>
                                            )}
                                          </div>
                                          <span className="font-mono text-slate-400 font-bold">{percent}% ({count})</span>
                                        </div>

                                        {/* Visual progress track bar */}
                                        <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900/60 relative">
                                          <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                              isRevealed && isCorrectOpt
                                                ? 'bg-emerald-500'
                                                : 'bg-gradient-to-r from-blue-500/80 to-purple-500/80'
                                            }`}
                                            style={{ width: `${percent}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-4">
                                  {/* Thumbs Up bar */}
                                  <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2">
                                    <ThumbsUp className="w-8 h-8 text-emerald-400" />
                                    <span className="text-sm font-bold text-white font-mono">{percentages.ThumbsUp || 0}%</span>
                                    <span className="text-xs text-slate-400">({percentages.counts?.ThumbsUp || 0} votes)</span>
                                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-emerald-500" 
                                        style={{ width: `${percentages.ThumbsUp || 0}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Thumbs Down bar */}
                                  <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2">
                                    <ThumbsDown className="w-8 h-8 text-rose-400" />
                                    <span className="text-sm font-bold text-white font-mono">{percentages.ThumbsDown || 0}%</span>
                                    <span className="text-xs text-slate-400">({percentages.counts?.ThumbsDown || 0} votes)</span>
                                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-rose-500" 
                                        style={{ width: `${percentages.ThumbsDown || 0}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                            </div>

                          </div>
                        )}
                      </div>
                    )}

                    {/* CREATE POLL FORM TAB */}
                    {activeTeacherTab === 'create' && (
                      <div id="create-poll-form" className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl backdrop-blur-md relative">
                        <div className="flex items-center gap-2 mb-2">
                          <Plus className="w-5 h-5 text-purple-400" />
                          <h4 className="text-lg font-bold text-white">Create Classroom Poll</h4>
                        </div>

                        {/* Poll Type Toggler */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                          <button
                            id="type-toggle-mcq"
                            type="button"
                            onClick={() => setPollType('mcq')}
                            className={`py-2 rounded-lg text-xs font-bold transition-all ${
                              pollType === 'mcq'
                                ? 'bg-purple-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Multiple Choice (MCQ)
                          </button>
                          <button
                            id="type-toggle-vote"
                            type="button"
                            onClick={() => setPollType('vote')}
                            className={`py-2 rounded-lg text-xs font-bold transition-all ${
                              pollType === 'vote'
                                ? 'bg-purple-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Consensus Vote (👍/👎)
                          </button>
                        </div>

                        <form onSubmit={handleCreatePoll} className="space-y-4">
                          {/* Question */}
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">
                              {pollType === 'mcq' ? 'Question Prompt' : 'Vote Statement'}
                            </label>
                            <input
                              id="poll-question-input"
                              type="text"
                              required
                              placeholder={pollType === 'mcq' ? "e.g. Which keyword is used to declare a block-scope variable in JS?" : "e.g. Tailwind CSS is superior to raw CSS. Do you agree?"}
                              value={pollQuestion}
                              onChange={(e) => setPollQuestion(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
                            />
                          </div>

                          {/* MCQ Specific Option Inputs */}
                          {pollType === 'mcq' && (
                            <div className="space-y-3 pt-2">
                              <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider">MCQ Options & Select Correct Option</label>
                              
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div className="flex items-center gap-2.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                                  <input 
                                    id="option-correct-a"
                                    type="radio" 
                                    name="correct-opt" 
                                    checked={correctAnswer === 'A'} 
                                    onChange={() => setCorrectAnswer('A')} 
                                    className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-slate-700 bg-slate-900"
                                  />
                                  <span className="text-xs font-bold text-slate-400">A</span>
                                  <input
                                    id="option-a-text"
                                    type="text"
                                    required
                                    placeholder="Option A"
                                    value={optionA}
                                    onChange={(e) => setOptionA(e.target.value)}
                                    className="flex-1 bg-transparent border-0 p-1 text-xs text-white focus:outline-none placeholder-slate-600"
                                  />
                                </div>

                                <div className="flex items-center gap-2.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                                  <input 
                                    id="option-correct-b"
                                    type="radio" 
                                    name="correct-opt" 
                                    checked={correctAnswer === 'B'} 
                                    onChange={() => setCorrectAnswer('B')} 
                                    className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-slate-700 bg-slate-900"
                                  />
                                  <span className="text-xs font-bold text-slate-400">B</span>
                                  <input
                                    id="option-b-text"
                                    type="text"
                                    required
                                    placeholder="Option B"
                                    value={optionB}
                                    onChange={(e) => setOptionB(e.target.value)}
                                    className="flex-1 bg-transparent border-0 p-1 text-xs text-white focus:outline-none placeholder-slate-600"
                                  />
                                </div>

                                <div className="flex items-center gap-2.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                                  <input 
                                    id="option-correct-c"
                                    type="radio" 
                                    name="correct-opt" 
                                    checked={correctAnswer === 'C'} 
                                    onChange={() => setCorrectAnswer('C')} 
                                    className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-slate-700 bg-slate-900"
                                  />
                                  <span className="text-xs font-bold text-slate-400">C</span>
                                  <input
                                    id="option-c-text"
                                    type="text"
                                    required
                                    placeholder="Option C"
                                    value={optionC}
                                    onChange={(e) => setOptionC(e.target.value)}
                                    className="flex-1 bg-transparent border-0 p-1 text-xs text-white focus:outline-none placeholder-slate-600"
                                  />
                                </div>

                                <div className="flex items-center gap-2.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                                  <input 
                                    id="option-correct-d"
                                    type="radio" 
                                    name="correct-opt" 
                                    checked={correctAnswer === 'D'} 
                                    onChange={() => setCorrectAnswer('D')} 
                                    className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-slate-700 bg-slate-900"
                                  />
                                  <span className="text-xs font-bold text-slate-400">D</span>
                                  <input
                                    id="option-d-text"
                                    type="text"
                                    required
                                    placeholder="Option D"
                                    value={optionD}
                                    onChange={(e) => setOptionD(e.target.value)}
                                    className="flex-1 bg-transparent border-0 p-1 text-xs text-white focus:outline-none placeholder-slate-600"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Timer & Submit button */}
                          <div className="grid sm:grid-cols-2 gap-4 items-end pt-2">
                            <div>
                              <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">Timer Duration (Seconds)</label>
                              <select
                                id="poll-duration-select"
                                value={pollDuration}
                                onChange={(e) => setPollDuration(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all font-mono"
                              >
                                <option value={10}>10 Seconds (Speed poll)</option>
                                <option value={20}>20 Seconds</option>
                                <option value={30}>30 Seconds (Default)</option>
                                <option value={45}>45 Seconds</option>
                                <option value={60}>60 Seconds (1 Minute)</option>
                                <option value={120}>120 Seconds (2 Minutes)</option>
                              </select>
                            </div>

                            <button
                              id="submit-create-poll-btn"
                              type="submit"
                              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl py-3 text-sm transition-all shadow-lg shadow-purple-500/15"
                            >
                              Initialize Poll wave
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* LEADERBOARD VIEW TAB */}
                    {activeTeacherTab === 'leaderboard' && (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl backdrop-blur-md">
                        <LeaderboardView students={currentSession.students} />
                      </div>
                    )}

                    {/* CLASSROOM CHAT VIEW TAB */}
                    {activeTeacherTab === 'chat' && (
                      <ChatView
                        chat={currentSession.chat}
                        currentUserName={teacherName}
                        currentUserRole="teacher"
                        onSendMessage={handleSendChatMessage}
                      />
                    )}

                  </div>

                  {/* RIGHT SIDEBAR MODULE (4 cols) - Connected list & metadata */}
                  <div className="lg:col-span-4 space-y-6">
                    
                    {/* Active Student List Tracker */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-lg backdrop-blur-md">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-blue-400" />
                          Online Students
                        </h4>
                        <span className="font-mono text-xs text-blue-400 font-extrabold px-2 py-0.5 rounded-full bg-blue-950 border border-blue-900">
                          {connectedStudentsCount}
                        </span>
                      </div>

                      {connectedStudentsCount === 0 ? (
                        <div className="text-center py-6 text-slate-500 space-y-1.5">
                          <p className="text-xs">No students connected yet.</p>
                          <p className="text-[10px] text-slate-600">Share 6-digit Session ID above to begin.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-slate-800/40">
                          {(Object.values(currentSession.students) as Student[]).map((std) => {
                            // Check if this student responded to active poll
                            const responded = currentSession.currentPoll && activePollResponses[std.name];

                            return (
                              <div key={std.name} className="flex items-center justify-between py-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="font-medium text-slate-200 truncate max-w-[120px]">{std.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {responded ? (
                                    <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                      Responded
                                    </span>
                                  ) : currentSession.currentPoll ? (
                                    <span className="text-[9px] bg-slate-800 text-slate-500 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                      Waiting
                                    </span>
                                  ) : null}
                                  <span className="font-mono text-xs text-purple-400 font-bold">{std.score} pts</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Historical Polls card */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-lg backdrop-blur-md">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider pb-3 border-b border-slate-800/80 mb-3">
                        Session History
                      </h4>

                      {currentSession.polls.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">No completed polls in this session yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto">
                          {currentSession.polls.map((p, idx) => (
                            <div key={p.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs flex flex-col gap-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500">
                                <span>POLL #{idx + 1}</span>
                                <span className="uppercase font-bold text-purple-400">{p.type}</span>
                              </div>
                              <p className="font-semibold text-slate-200 truncate">{p.question}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              </div>
            )}

          </div>
        )}

        {/* 4. STUDENT DASHBOARD PORTAL */}
        {currentView === 'student_dashboard' && currentSession && (
          <div id="student-dashboard-screen" className="w-full max-w-4xl py-4 space-y-6">
            
            {/* Student Hub Header */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Logged in as {studentName}</h3>
                  <p className="text-xs text-slate-400">Your score: <strong className="text-purple-400 font-mono text-sm">{currentSession.students[studentName]?.score || 0} pts</strong></p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-slate-400">Joined session:</span>
                  <strong className="text-white font-mono">{currentSession.id}</strong>
                </div>
              </div>
            </div>

            {/* Student Navigation tabs */}
            <div className="flex border-b border-slate-800 gap-1">
              <button
                id="student-tab-poll"
                onClick={() => setActiveStudentTab('poll')}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeStudentTab === 'poll' 
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5' 
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                Active Poll
                {currentSession.currentPoll && currentSession.currentPoll.state === 'active' && !isAnswerSubmitted && (
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                )}
              </button>

              <button
                id="student-tab-leaderboard"
                onClick={() => setActiveStudentTab('leaderboard')}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeStudentTab === 'leaderboard' 
                    ? 'border-purple-500 text-purple-400 bg-purple-500/5' 
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-4 h-4" />
                Standings
              </button>

              <button
                id="student-tab-chat"
                onClick={() => setActiveStudentTab('chat')}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeStudentTab === 'chat' 
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' 
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Classroom Chat ({currentSession.chat.length})
              </button>
            </div>

            {/* Student active views */}
            <div>
              
              {/* POLL TAB */}
              {activeStudentTab === 'poll' && (
                <div id="student-active-poll-section" className="space-y-6">
                  
                  {!currentSession.currentPoll ? (
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-10 text-center space-y-4">
                      <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center mx-auto text-slate-600">
                        <Clock className="w-6 h-6 animate-spin" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white">Waiting for the Instructor</h4>
                        <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">There is no active poll running right now. Relax! As soon as the teacher launches a poll, it will appear here immediately.</p>
                      </div>
                    </div>
                  ) : (
                    
                    /* WE HAVE A POLL VIEW FOR STUDENT */
                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl backdrop-blur-md">
                      
                      {/* Timer section */}
                      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Live Classroom Poll</span>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full text-xs text-white font-mono font-bold">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          {currentSession.currentPoll.timeRemaining}s left
                        </div>
                      </div>

                      {/* Question Text */}
                      <div>
                        <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Question Prompt</h4>
                        <p className="text-lg md:text-xl font-bold text-white leading-relaxed">{currentSession.currentPoll.question}</p>
                      </div>

                      {/* Interactive Choices Zone */}
                      {currentSession.currentPoll.state === 'active' && !isAnswerSubmitted ? (
                        
                        /* POLL IS ACTIVE AND STUDENT HAS NOT ANSWERED YET */
                        <div className="space-y-4 pt-2">
                          
                          {currentSession.currentPoll.type === 'mcq' ? (
                            <div className="grid md:grid-cols-2 gap-4">
                              {['A', 'B', 'C', 'D'].map((opt) => (
                                <button
                                  key={opt}
                                  id={`student-submit-opt-${opt}`}
                                  onClick={() => handleStudentSubmitAnswer(opt)}
                                  className="group bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 p-4 rounded-2xl text-left transition-all duration-200 shadow-md flex items-center gap-4 active:scale-95"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-slate-900 group-hover:bg-blue-950 font-mono font-extrabold flex items-center justify-center text-sm text-slate-300 group-hover:text-blue-400 border border-slate-800 group-hover:border-blue-500/30 transition-all shrink-0">
                                    {opt}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-all truncate">
                                    {currentSession.currentPoll?.options?.[opt as 'A'|'B'|'C'|'D']}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-6 pt-4">
                              <button
                                id="student-vote-thumbs-up"
                                onClick={() => handleStudentSubmitAnswer('ThumbsUp')}
                                className="bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-800/40 hover:border-emerald-500 p-8 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200 shadow-md group active:scale-95"
                              >
                                <ThumbsUp className="w-12 h-12 text-emerald-400 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-bold text-emerald-300">👍 Thumbs Up</span>
                              </button>

                              <button
                                id="student-vote-thumbs-down"
                                onClick={() => handleStudentSubmitAnswer('ThumbsDown')}
                                className="bg-rose-950/20 hover:bg-rose-950/40 border border-rose-800/40 hover:border-rose-500 p-8 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200 shadow-md group active:scale-95"
                              >
                                <ThumbsDown className="w-12 h-12 text-rose-400 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-bold text-rose-300">👎 Thumbs Down</span>
                              </button>
                            </div>
                          )}

                        </div>
                      ) : (
                        
                        /* SUBMITTED OR COMPLETED / WAITING REVEAL STATE */
                        <div className="pt-4 border-t border-slate-800/80 space-y-6">
                          
                          {/* 1. If user submitted and waiting for poll to finish or reveal */}
                          {isAnswerSubmitted && currentSession.currentPoll.state === 'active' && (
                            <div className="bg-blue-950/10 border border-blue-900/40 rounded-2xl p-6 text-center space-y-2">
                              <CheckCircle className="w-8 h-8 text-blue-400 mx-auto" />
                              <h5 className="font-bold text-white text-base">Your response is recorded!</h5>
                              <p className="text-xs text-slate-400">Waiting for other classmates to respond and for the instructor to conclude and reveal results.</p>
                            </div>
                          )}

                          {/* 2. Poll is stopped/completed, but teacher has NOT yet revealed the answer (for MCQ) */}
                          {currentSession.currentPoll.state === 'completed' && currentSession.currentPoll.type === 'mcq' && !currentSession.currentPoll.answerRevealed && (
                            <div className="bg-purple-950/10 border border-purple-900/40 rounded-2xl p-6 text-center space-y-2">
                              <Clock className="w-8 h-8 text-purple-400 mx-auto animate-pulse" />
                              <h5 className="font-bold text-white text-base">Poll Wave Concluded!</h5>
                              <p className="text-xs text-slate-400">Waiting for the teacher to press "Reveal Answer" to see the correct solution.</p>
                            </div>
                          )}

                          {/* 3. Correct answer revealed (MCQ only) */}
                          {currentSession.currentPoll.type === 'mcq' && currentSession.currentPoll.answerRevealed && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <BarChart3 className="w-4 h-4 text-blue-400" />
                                Results & Correct Answer
                              </div>

                              <div className="space-y-3.5">
                                {['A', 'B', 'C', 'D'].map((opt) => {
                                  const percent = percentages[opt as 'A'|'B'|'C'|'D'] || 0;
                                  const count = percentages.counts ? percentages.counts[opt as 'A'|'B'|'C'|'D'] : 0;
                                  const isCorrectOpt = currentSession.currentPoll?.correctAnswer === opt;
                                  const selectedByMe = selectedStudentAnswer === opt;

                                  return (
                                    <div key={opt} className="space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className={`w-6 h-6 rounded-md font-mono font-extrabold flex items-center justify-center text-xs ${
                                            isCorrectOpt 
                                              ? 'bg-emerald-500 text-slate-950 border border-emerald-400' 
                                              : selectedByMe 
                                              ? 'bg-red-500 text-white' 
                                              : 'bg-slate-800 text-slate-300'
                                          }`}>
                                            {opt}
                                          </span>
                                          <span className="text-slate-300">
                                            {currentSession.currentPoll?.options?.[opt as 'A'|'B'|'C'|'D']}
                                          </span>
                                          {isCorrectOpt && (
                                            <span className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider">✔ Correct Solution</span>
                                          )}
                                          {selectedByMe && (
                                            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">(Your Response)</span>
                                          )}
                                        </div>
                                        <span className="font-mono text-slate-400 font-bold">{percent}% ({count})</span>
                                      </div>

                                      {/* Progress Bar */}
                                      <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full rounded-full ${
                                            isCorrectOpt
                                              ? 'bg-emerald-500'
                                              : selectedByMe
                                              ? 'bg-red-500'
                                              : 'bg-slate-800'
                                          }`}
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Student performance badge */}
                              {selectedStudentAnswer && (
                                <div className={`p-4 rounded-xl text-center border ${
                                  selectedStudentAnswer === currentSession.currentPoll.correctAnswer
                                    ? 'bg-emerald-950/20 border-emerald-800 text-emerald-300'
                                    : 'bg-red-950/20 border-red-900 text-red-300'
                                }`}>
                                  <p className="text-sm font-bold flex items-center justify-center gap-1.5">
                                    {selectedStudentAnswer === currentSession.currentPoll.correctAnswer ? (
                                      <>
                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                        Awesome! Your response was correct!
                                      </>
                                    ) : (
                                      <>
                                        <Square className="w-4 h-4 text-red-400" />
                                        Incorrect answer. Keep studying!
                                      </>
                                    )}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 4. Consensus Vote completed / stopped */}
                          {currentSession.currentPoll.type === 'vote' && (currentSession.currentPoll.state === 'completed' || isAnswerSubmitted) && (
                            <div className="space-y-4">
                              <h5 className="text-xs font-bold text-white uppercase tracking-wider">Consensus Consensus Stats</h5>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2">
                                  <ThumbsUp className="w-8 h-8 text-emerald-400" />
                                  <span className="text-sm font-bold text-white font-mono">{percentages.ThumbsUp || 0}%</span>
                                  <span className="text-xs text-slate-400">({percentages.counts?.ThumbsUp || 0} votes)</span>
                                </div>

                                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2">
                                  <ThumbsDown className="w-8 h-8 text-rose-400" />
                                  <span className="text-sm font-bold text-white font-mono">{percentages.ThumbsDown || 0}%</span>
                                  <span className="text-xs text-slate-400">({percentages.counts?.ThumbsDown || 0} votes)</span>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      )}

                    </div>
                  )}

                </div>
              )}

              {/* STANDINGS TAB */}
              {activeStudentTab === 'leaderboard' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl backdrop-blur-md">
                  <LeaderboardView students={currentSession.students} />
                </div>
              )}

              {/* CHAT TAB */}
              {activeStudentTab === 'chat' && (
                <ChatView
                  chat={currentSession.chat}
                  currentUserName={studentName}
                  currentUserRole="student"
                  onSendMessage={handleSendChatMessage}
                />
              )}

            </div>

          </div>
        )}

      </main>

      {/* Footer copyright */}
      <footer className="border-t border-slate-900 py-6 px-6 text-center text-xs text-slate-600 bg-slate-950/90 z-20 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PollWave Inc. All systems normal.</p>
          <div className="flex gap-4 text-slate-500 font-medium">
            <span className="hover:text-slate-400 cursor-pointer">Security Sandbox</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Classroom Standards</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
