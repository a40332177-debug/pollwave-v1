import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { ClassroomSession, Poll, StudentResponse, Student, ChatMessage } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory database of active sessions
const sessions: { [id: string]: ClassroomSession } = {};

// Hardcoded teacher credentials for the mock database (simple & clean)
const TEACHER_ACCOUNTS: { [username: string]: string } = {
  "admin": "admin123",
  "teacher": "password123",
  "professor": "pollwave2026",
};

// Generate a random 6-digit session ID
function generateSessionId(): string {
  let id = '';
  do {
    id = Math.floor(100000 + Math.random() * 900000).toString();
  } while (sessions[id]);
  return id;
}

// Background task to handle poll countdowns & student active/inactive pings
setInterval(() => {
  const now = Date.now();
  Object.keys(sessions).forEach((sessionId) => {
    const session = sessions[sessionId];

    // 1. Timer Tick
    if (session.currentPoll && session.currentPoll.state === 'active') {
      if (session.currentPoll.timeRemaining > 0) {
        session.currentPoll.timeRemaining -= 1;
      } else {
        session.currentPoll.state = 'completed';
      }
    }

    // 2. Student activity sweep (prune students inactive for >12 seconds)
    Object.keys(session.students).forEach((studentName) => {
      const student = session.students[studentName];
      if (now - student.lastActive > 12000) {
        delete session.students[studentName];
      }
    });
  });
}, 1000);

// API Routes

// 1. Teacher Auth Login
app.post('/api/teacher/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const normalizedUsername = username.toLowerCase().trim();
  const trimmedPassword = password.trim();

  // If the username doesn't exist, dynamically register them instantly!
  if (!TEACHER_ACCOUNTS[normalizedUsername]) {
    TEACHER_ACCOUNTS[normalizedUsername] = password; // store the original password
    res.json({ success: true, teacherName: username, message: 'New teacher account created and logged in!' });
    return;
  }

  const validPassword = TEACHER_ACCOUNTS[normalizedUsername];
  const isPasswordCorrect = (validPassword === password) || 
                            (validPassword.trim() === trimmedPassword) || 
                            (validPassword === trimmedPassword);

  if (isPasswordCorrect) {
    res.json({ success: true, teacherName: username });
  } else {
    res.status(401).json({ error: 'Incorrect password for this teacher name.' });
  }
});

// 2. Create Classroom Session (Teacher)
app.post('/api/sessions', (req, res) => {
  const { teacherName } = req.body;
  if (!teacherName) {
    res.status(400).json({ error: 'Teacher name is required' });
    return;
  }

  const sessionId = generateSessionId();
  const newSession: ClassroomSession = {
    id: sessionId,
    teacherName,
    students: {},
    currentPoll: null,
    polls: [],
    responses: {},
    chat: [
      {
        id: 'welcome',
        sender: 'System',
        role: 'teacher',
        text: `Classroom session created! Share Session ID ${sessionId} with your students to join.`,
        timestamp: Date.now(),
      }
    ],
    createdAt: Date.now(),
  };

  sessions[sessionId] = newSession;
  res.json(newSession);
});

// 3. Join Session (Student)
app.post('/api/sessions/:sessionId/join', (req, res) => {
  const { sessionId } = req.params;
  const { studentName } = req.body;

  if (!studentName || !studentName.trim()) {
    res.status(400).json({ error: 'Student name is required' });
    return;
  }

  const session = sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found. Please verify the 6-digit ID.' });
    return;
  }

  const normalizedStudentName = studentName.trim();
  
  // If student doesn't exist yet, create one
  if (!session.students[normalizedStudentName]) {
    const newStudent: Student = {
      name: normalizedStudentName,
      score: 0,
      correctAnswersCount: 0,
      totalAnsweredCount: 0,
      totalResponseTimeMs: 0,
      lastActive: Date.now(),
    };
    session.students[normalizedStudentName] = newStudent;

    // Post join chat notification
    session.chat.push({
      id: `join-${normalizedStudentName}-${Date.now()}`,
      sender: 'System',
      role: 'teacher',
      text: `${normalizedStudentName} has joined the room.`,
      timestamp: Date.now(),
    });
  } else {
    // If student already exists, just update their heartbeat
    session.students[normalizedStudentName].lastActive = Date.now();
  }

  res.json(session);
});

// 4. Get Classroom Session State (Teacher/Student polling)
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions[sessionId];

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json(session);
});

// 5. Create Poll (Teacher)
app.post('/api/sessions/:sessionId/polls', (req, res) => {
  const { sessionId } = req.params;
  const { type, question, options, correctAnswer, duration } = req.body;

  const session = sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const pollId = `poll-${Date.now()}`;
  const newPoll: Poll = {
    id: pollId,
    type,
    question,
    options: type === 'mcq' ? options : undefined,
    correctAnswer: type === 'mcq' ? correctAnswer : undefined,
    duration: duration || 30,
    timeRemaining: duration || 30,
    state: 'idle',
    answerRevealed: false,
  };

  session.currentPoll = newPoll;
  session.responses[pollId] = {};
  res.json(session);
});

// 6. Control Poll (Teacher Action)
app.post('/api/sessions/:sessionId/polls/control', (req, res) => {
  const { sessionId } = req.params;
  const { action } = req.body; // 'start' | 'pause' | 'stop' | 'reveal' | 'end'

  const session = sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const poll = session.currentPoll;
  if (!poll) {
    res.status(400).json({ error: 'No active poll to control' });
    return;
  }

  switch (action) {
    case 'start':
      poll.state = 'active';
      poll.startTime = Date.now();
      break;
    case 'pause':
      poll.state = 'paused';
      break;
    case 'stop':
      poll.state = 'completed';
      break;
    case 'reveal':
      if (poll.type === 'mcq') {
        poll.answerRevealed = true;
      }
      break;
    case 'end':
      // Move current poll to historical list
      poll.state = 'completed';
      session.polls.push(poll);
      session.currentPoll = null;
      break;
    default:
      res.status(400).json({ error: 'Invalid action' });
      return;
  }

  res.json(session);
});

// 7. Student Submit Answer
app.post('/api/sessions/:sessionId/polls/submit', (req, res) => {
  const { sessionId } = req.params;
  const { studentName, answer } = req.body;

  const session = sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const poll = session.currentPoll;
  if (!poll) {
    res.status(400).json({ error: 'No active poll is running' });
    return;
  }

  if (poll.state !== 'active') {
    res.status(400).json({ error: 'Poll is not accepting responses' });
    return;
  }

  const student = session.students[studentName];
  if (!student) {
    res.status(403).json({ error: 'You are not registered in this session' });
    return;
  }

  // Calculate speed / response time
  const responseTimeMs = poll.startTime ? (Date.now() - poll.startTime) : 2000;

  // Prevent multiple votes for the same poll
  const pollResponses = session.responses[poll.id] || {};
  if (pollResponses[studentName]) {
    res.status(400).json({ error: 'You have already voted' });
    return;
  }

  let isCorrect = false;
  let points = 0;

  if (poll.type === 'mcq') {
    isCorrect = answer === poll.correctAnswer;
    if (isCorrect) {
      // Base 100 points, up to +50 speed bonus
      const speedBonus = Math.max(0, Math.round(50 * (poll.timeRemaining / poll.duration)));
      points = 100 + speedBonus;
      student.correctAnswersCount += 1;
    }
  } else if (poll.type === 'vote') {
    // Voting always gives a flat participation of 10 points
    points = 10;
  }

  student.totalAnsweredCount += 1;
  student.totalResponseTimeMs += responseTimeMs;
  student.score += points;
  student.lastActive = Date.now();

  const studentResponse: StudentResponse = {
    studentName,
    answer,
    responseTimeMs,
    isCorrect: poll.type === 'mcq' ? isCorrect : undefined,
    score: points,
  };

  pollResponses[studentName] = studentResponse;
  session.responses[poll.id] = pollResponses;

  res.json({ success: true, response: studentResponse });
});

// 8. Send Chat Message
app.post('/api/sessions/:sessionId/chat', (req, res) => {
  const { sessionId } = req.params;
  const { sender, role, text } = req.body;

  const session = sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (!text || !text.trim()) {
    res.status(400).json({ error: 'Message cannot be empty' });
    return;
  }

  const newMessage: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    sender,
    role,
    text: text.trim(),
    timestamp: Date.now(),
  };

  session.chat.push(newMessage);
  res.json(session);
});

// 9. Student Heartbeat Ping (keeps connection count updated)
app.post('/api/sessions/:sessionId/heartbeat', (req, res) => {
  const { sessionId } = req.params;
  const { studentName } = req.body;

  const session = sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const student = session.students[studentName];
  if (student) {
    student.lastActive = Date.now();
  }

  res.json({ success: true });
});

// 10. End Session (Teacher Action)
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (sessions[sessionId]) {
    delete sessions[sessionId];
    res.json({ success: true, message: 'Classroom session ended successfully' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});


// Full-stack Vite development middleware vs Static Production bundle
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PollWave server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
