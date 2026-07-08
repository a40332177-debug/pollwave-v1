package com.pollwave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.firestore.ListenerRegistration
import com.pollwave.app.model.ClassroomSession
import com.pollwave.app.model.Poll
import com.pollwave.app.model.Student
import com.pollwave.app.model.StudentResponse
import com.pollwave.app.service.FirebaseService
import kotlinx.coroutines.delay

@Composable
fun StudentDashboardScreen(
    sessionId: String,
    studentName: String,
    onLeave: () -> Unit
) {
    var session by remember { mutableStateOf<ClassroomSession?>(null) }
    var selectedTab by remember { mutableStateOf("poll") } // "poll" | "leaderboard" | "chat"
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var listenerRegistration by remember { mutableStateOf<ListenerRegistration?>(null) }

    // Start Session Listener
    DisposableEffect(sessionId) {
        val listener = FirebaseService.listenToSession(sessionId) { updated ->
            if (updated != null) {
                session = updated
            } else {
                // Session deleted or ended
                onLeave()
            }
        }
        listenerRegistration = listener
        onDispose {
            listenerRegistration?.remove()
        }
    }

    // Start heartbeat pinger to keep student active
    LaunchedEffect(sessionId, studentName) {
        while (true) {
            FirebaseService.sendHeartbeat(sessionId, studentName)
            delay(5000)
        }
    }

    val backgroundGradient = Brush.verticalGradient(
        colors = listOf(Color(0xFF0F172A), Color(0xFF1E293B))
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundGradient)
            .padding(16.dp)
    ) {
        if (session == null) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFF6366F1))
            }
        } else {
            val activeSession = session!!
            Column(modifier = Modifier.fillMaxSize()) {
                // Header Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "PollWave Classroom",
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 18.sp
                        )
                        Text(
                            text = "Host: ${activeSession.teacherName}",
                            fontSize = 13.sp,
                            color = Color(0xFF94A3B8)
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF334155), RoundedCornerShape(8.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = "ID: ${activeSession.id}",
                                color = Color(0xFF818CF8),
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        IconButton(
                            onClick = onLeave,
                            modifier = Modifier
                                .background(Color(0xFFEF4444).copy(alpha = 0.2f), CircleShape)
                                .size(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.ExitToApp,
                                contentDescription = "Leave Session",
                                tint = Color(0xFFEF4444),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Student Tabs Selector
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1E293B), RoundedCornerShape(12.dp))
                        .padding(4.dp)
                ) {
                    val tabs = listOf(
                        Triple("poll", "Live Poll", Icons.Default.PlayArrow),
                        Triple("leaderboard", "Standings", Icons.Default.Star),
                        Triple("chat", "Chat Room", Icons.Default.Send)
                    )

                    tabs.forEach { (tabId, label, icon) ->
                        val isSelected = selectedTab == tabId
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) Color(0xFF6366F1) else Color.Transparent)
                                .clickable { selectedTab = tabId }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    imageVector = icon,
                                    contentDescription = label,
                                    tint = if (isSelected) Color.White else Color(0xFF94A3B8),
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = label,
                                    color = if (isSelected) Color.White else Color(0xFF94A3B8),
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Screen Tab Switcher
                Box(modifier = Modifier.weight(1f)) {
                    when (selectedTab) {
                        "poll" -> StudentPollTab(
                            session = activeSession,
                            studentName = studentName,
                            sessionId = sessionId
                        )
                        "leaderboard" -> LeaderboardTab(students = activeSession.students.values.toList())
                        "chat" -> ChatTab(
                            sessionId = activeSession.id,
                            senderName = studentName,
                            role = "student",
                            messages = activeSession.chat
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StudentPollTab(
    session: ClassroomSession,
    studentName: String,
    sessionId: String
) {
    val poll = session.currentPoll
    val responsesMap = poll?.let { session.responses[it.id] } ?: emptyMap()
    val myResponse = responsesMap[studentName]
    var submittingAnswer by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    if (poll == null) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(24.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .background(Color(0xFF334155), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = "Waiting",
                        tint = Color(0xFF6366F1),
                        modifier = Modifier.size(32.dp)
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Waiting for the next poll...",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "The teacher will broadcast a question shortly.",
                    color = Color(0xFF94A3B8),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    } else {
        // Ticker for poll duration
        var countdownRemaining by remember { mutableStateOf(poll.timeRemaining) }

        LaunchedEffect(poll.id, poll.state) {
            countdownRemaining = poll.timeRemaining
            while (poll.state == "active" && countdownRemaining > 0) {
                delay(1000)
                countdownRemaining--
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .background(Color(0xFF6366F1).copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = if (poll.type == "mcq") "MULTIPLE CHOICE" else "SURVEY VOTE",
                                    color = Color(0xFF818CF8),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Info,
                                    contentDescription = "Timer",
                                    tint = Color(0xFFF59E0B),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "${countdownRemaining}s left",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = poll.question,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp,
                            lineHeight = 28.sp
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        // Answer Options / Survey buttons
                        if (myResponse == null) {
                            if (poll.state != "active") {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFF334155).copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                                        .padding(16.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "This poll is not currently accepting votes.",
                                        color = Color(0xFF94A3B8),
                                        fontSize = 13.sp,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            } else {
                                // Accepting responses
                                if (poll.type == "mcq") {
                                    val options = poll.options ?: emptyMap()
                                    options.keys.sorted().forEach { optionKey ->
                                        val label = options[optionKey] ?: ""

                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 6.dp)
                                                .clip(RoundedCornerShape(12.dp))
                                                .background(Color(0xFF334155))
                                                .clickable {
                                                    submittingAnswer = true
                                                    errorMsg = null
                                                    FirebaseService.submitResponse(sessionId, studentName, optionKey) { exc ->
                                                        submittingAnswer = false
                                                        if (exc != null) {
                                                            errorMsg = exc.message
                                                        }
                                                    }
                                                }
                                                .padding(16.dp)
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(24.dp)
                                                        .background(Color(0xFF6366F1), CircleShape),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text(optionKey, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                                }
                                                Spacer(modifier = Modifier.width(12.dp))
                                                Text(label, color = Color.White, fontSize = 14.sp)
                                            }
                                        }
                                    }
                                } else {
                                    // Thumbs Up / Down
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                                    ) {
                                        Button(
                                            onClick = {
                                                FirebaseService.submitResponse(sessionId, studentName, "ThumbsUp") {}
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                            shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Icon(imageVector = Icons.Default.ThumbUp, contentDescription = "Thumbs Up", tint = Color.White)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text("Yes", color = Color.White, fontWeight = FontWeight.Bold)
                                        }

                                        Button(
                                            onClick = {
                                                FirebaseService.submitResponse(sessionId, studentName, "ThumbsDown") {}
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                                            shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Icon(imageVector = Icons.Default.ThumbDown, contentDescription = "Thumbs Down", tint = Color.White)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text("No", color = Color.White, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        } else {
                            // Student HAS submitted an answer
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF111827).copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                                    .padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = "Success",
                                        tint = Color(0xFF10B981),
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Your response has been submitted!",
                                        color = Color(0xFF10B981),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                }

                                Spacer(modifier = Modifier.height(12.dp))

                                Text(
                                    text = "Submitted choice: ${myResponse.answer}",
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.SemiBold
                                )

                                if (poll.state == "completed") {
                                    Spacer(modifier = Modifier.height(16.dp))

                                    if (poll.type == "mcq" && poll.answerRevealed) {
                                        val correct = myResponse.isCorrect
                                        Box(
                                            modifier = Modifier
                                                .background(
                                                    if (correct) Color(0xFF10B981).copy(alpha = 0.15f) else Color(0xFFEF4444).copy(alpha = 0.15f),
                                                    RoundedCornerShape(8.dp)
                                                )
                                                .padding(horizontal = 12.dp, vertical = 8.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(
                                                    text = if (correct) "CORRECT! 🎉" else "INCORRECT ❌",
                                                    color = if (correct) Color(0xFF10B981) else Color(0xFFEF4444),
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 15.sp
                                                )
                                                Text(
                                                    text = "Correct answer: ${poll.correctAnswer}",
                                                    color = Color.White,
                                                    fontSize = 12.sp
                                                )
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(
                                                    text = "+${myResponse.pointsEarned} Points earned!",
                                                    color = Color(0xFF818CF8),
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 13.sp
                                                )
                                            }
                                        }
                                    } else {
                                        Text(
                                            text = "Waiting for the host to reveal the correct option...",
                                            color = Color(0xFF94A3B8),
                                            fontSize = 12.sp,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                } else {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "Results will be shown when the timer ends.",
                                        color = Color(0xFF64748B),
                                        fontSize = 12.sp,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }

                        errorMsg?.let { err ->
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(err, color = Color(0xFFEF4444), fontSize = 12.sp, textAlign = TextAlign.Center)
                        }
                    }
                }
            }
        }
    }
}
