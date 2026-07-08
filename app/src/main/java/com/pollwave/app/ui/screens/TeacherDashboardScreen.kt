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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.firestore.ListenerRegistration
import com.pollwave.app.model.ClassroomSession
import com.pollwave.app.model.Poll
import com.pollwave.app.model.Student
import com.pollwave.app.model.ChatMessage
import com.pollwave.app.service.FirebaseService
import kotlinx.coroutines.delay

@Composable
fun TeacherDashboardScreen(
    teacherName: String,
    onLogout: () -> Unit
) {
    var session by remember { mutableStateOf<ClassroomSession?>(null) }
    var selectedTab by remember { mutableStateOf("live") } // "live" | "create" | "leaderboard" | "chat"
    var isCreatingSession by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var listenerRegistration by remember { mutableStateOf<ListenerRegistration?>(null) }

    // On start, if session is null, listen for changes if we have a sessionId
    DisposableEffect(session?.id) {
        val currentId = session?.id
        if (currentId != null) {
            val listener = FirebaseService.listenToSession(currentId) { updated ->
                if (updated != null) {
                    session = updated
                } else {
                    session = null
                }
            }
            listenerRegistration = listener
        }
        onDispose {
            listenerRegistration?.remove()
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
            // Initial create session state
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .background(Color(0xFF6366F1), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Wave",
                        tint = Color.White,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "Welcome, Host!",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Logged in as: $teacherName",
                    fontSize = 14.sp,
                    color = Color(0xFF94A3B8)
                )

                Spacer(modifier = Modifier.height(32.dp))

                Button(
                    onClick = {
                        isCreatingSession = true
                        errorMsg = null
                        FirebaseService.createSession(teacherName) { newSess, exc ->
                            isCreatingSession = false
                            if (exc != null) {
                                errorMsg = exc.message
                            } else if (newSess != null) {
                                session = newSess
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6366F1)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isCreatingSession
                ) {
                    if (isCreatingSession) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                    } else {
                        Text("Create Live Session", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }

                errorMsg?.let { err ->
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(err, color = Color(0xFFEF4444), fontSize = 13.sp)
                }

                Spacer(modifier = Modifier.height(16.dp))

                TextButton(onClick = onLogout) {
                    Text("Exit Dashboard", color = Color(0xFFEF4444))
                }
            }
        } else {
            // Main Dashboard Container
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
                            text = "PollWave Host",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .background(Color(0xFF10B981), CircleShape)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Session ID: ${activeSession.id}",
                                fontSize = 14.sp,
                                color = Color(0xFF10B981),
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF334155), RoundedCornerShape(8.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Person,
                                    contentDescription = "Students count",
                                    tint = Color(0xFF94A3B8),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "${activeSession.students.size}",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        IconButton(
                            onClick = {
                                listenerRegistration?.remove()
                                session = null
                            },
                            modifier = Modifier
                                .background(Color(0xFFEF4444).copy(alpha = 0.2f), CircleShape)
                                .size(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.ExitToApp,
                                contentDescription = "End session",
                                tint = Color(0xFFEF4444),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Custom Tab Row
                TabSelector(
                    selectedTab = selectedTab,
                    onTabSelected = { selectedTab = it },
                    chatNotificationCount = 0
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Tab Contents
                Box(modifier = Modifier.weight(1f)) {
                    when (selectedTab) {
                        "live" -> LivePollTab(session = activeSession)
                        "create" -> CreatePollTab(
                            sessionId = activeSession.id,
                            onPollLaunched = { selectedTab = "live" }
                        )
                        "leaderboard" -> LeaderboardTab(students = activeSession.students.values.toList())
                        "chat" -> ChatTab(
                            sessionId = activeSession.id,
                            senderName = teacherName,
                            role = "teacher",
                            messages = activeSession.chat
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TabSelector(
    selectedTab: String,
    onTabSelected: (String) -> Unit,
    chatNotificationCount: Int
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1E293B), RoundedCornerShape(12.dp))
            .padding(4.dp)
    ) {
        val tabs = listOf(
            Triple("live", "Live Poll", Icons.Default.PlayArrow),
            Triple("create", "Create", Icons.Default.Add),
            Triple("leaderboard", "Standings", Icons.Default.Star),
            Triple("chat", "Chat", Icons.Default.Send)
        )

        tabs.forEach { (tabId, label, icon) ->
            val isSelected = selectedTab == tabId
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (isSelected) Color(0xFF6366F1) else Color.Transparent)
                    .clickable { onTabSelected(tabId) }
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
}

@Composable
fun LivePollTab(session: ClassroomSession) {
    val poll = session.currentPoll

    if (poll == null) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = "No Active Poll",
                    tint = Color(0xFF475569),
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "No poll has been set up yet",
                    color = Color(0xFF94A3B8),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Switch to the 'Create' tab to set one up!",
                    color = Color(0xFF64748B),
                    fontSize = 13.sp
                )
            }
        }
    } else {
        // We have an active poll!
        var countdownRemaining by remember { mutableStateOf(poll.timeRemaining) }

        // Local ticker loop
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
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .background(
                                        when (poll.state) {
                                            "active" -> Color(0xFF10B981).copy(alpha = 0.2f)
                                            "paused" -> Color(0xFFF59E0B).copy(alpha = 0.2f)
                                            else -> Color(0xFF64748B).copy(alpha = 0.2f)
                                        },
                                        RoundedCornerShape(8.dp)
                                    )
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = poll.state.uppercase(),
                                    color = when (poll.state) {
                                        "active" -> Color(0xFF10B981)
                                        "paused" -> Color(0xFFF59E0B)
                                        else -> Color(0xFF94A3B8)
                                    },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Info,
                                    contentDescription = "Timer",
                                    tint = Color(0xFF818CF8),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "${countdownRemaining}s left",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = poll.question,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            lineHeight = 24.sp
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // Controls Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (poll.state == "idle" || poll.state == "paused") {
                                Button(
                                    onClick = { FirebaseService.controlPoll(session.id, "start") {} },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Start", color = Color.White)
                                }
                            } else if (poll.state == "active") {
                                Button(
                                    onClick = { FirebaseService.controlPoll(session.id, "pause") {} },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B)),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Pause", color = Color.White)
                                }
                            }

                            if (poll.state == "active" || poll.state == "paused") {
                                Button(
                                    onClick = { FirebaseService.controlPoll(session.id, "stop") {} },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Stop", color = Color.White)
                                }
                            }

                            if (poll.type == "mcq" && !poll.answerRevealed && poll.state == "completed") {
                                Button(
                                    onClick = { FirebaseService.controlPoll(session.id, "reveal") {} },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6366F1)),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Reveal Ans", color = Color.White)
                                }
                            }
                        }

                        if (poll.state == "completed") {
                            Spacer(modifier = Modifier.height(10.dp))
                            Button(
                                onClick = { FirebaseService.controlPoll(session.id, "end") {} },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF475569)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("End Poll & Save", color = Color.White)
                            }
                        }
                    }
                }
            }

            // Real-time responses listing & analysis
            item {
                val responsesMap = session.responses[poll.id] ?: emptyMap()
                val totalResponses = responsesMap.size

                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Live Feedback ($totalResponses Responses)",
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 15.sp
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        if (poll.type == "mcq") {
                            val options = poll.options ?: emptyMap()
                            options.keys.sorted().forEach { optionKey ->
                                val count = responsesMap.values.count { it.answer == optionKey }
                                val percent = if (totalResponses > 0) (count.toFloat() / totalResponses * 100).toInt() else 0
                                val label = options[optionKey] ?: ""
                                val isCorrect = poll.answerRevealed && optionKey == poll.correctAnswer

                                Column(modifier = Modifier.padding(vertical = 6.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = "$optionKey: $label",
                                            color = if (isCorrect) Color(0xFF10B981) else Color.White,
                                            fontWeight = if (isCorrect) FontWeight.Bold else FontWeight.Normal,
                                            fontSize = 13.sp
                                        )
                                        Text(
                                            text = "$count ($percent%)",
                                            color = if (isCorrect) Color(0xFF10B981) else Color(0xFF94A3B8),
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    LinearProgressIndicator(
                                        progress = { percent / 100f },
                                        color = if (isCorrect) Color(0xFF10B981) else Color(0xFF6366F1),
                                        trackColor = Color(0xFF334155),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(8.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                    )
                                }
                            }
                        } else {
                            // Thumbs
                            val thumbsUpCount = responsesMap.values.count { it.answer == "ThumbsUp" }
                            val thumbsDownCount = responsesMap.values.count { it.answer == "ThumbsDown" }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(
                                        imageVector = Icons.Default.ThumbUp,
                                        contentDescription = "Thumbs Up",
                                        tint = Color(0xFF10B981),
                                        modifier = Modifier.size(32.dp)
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("$thumbsUpCount Votes", color = Color.White, fontWeight = FontWeight.Bold)
                                }

                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(
                                        imageVector = Icons.Default.ThumbDown,
                                        contentDescription = "Thumbs Down",
                                        tint = Color(0xFFEF4444),
                                        modifier = Modifier.size(32.dp)
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("$thumbsDownCount Votes", color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CreatePollTab(
    sessionId: String,
    onPollLaunched: () -> Unit
) {
    var pollType by remember { mutableStateOf("mcq") } // "mcq" | "thumbs"
    var question by remember { mutableStateOf("") }
    var optionA by remember { mutableStateOf("") }
    var optionB by remember { mutableStateOf("") }
    var optionC by remember { mutableStateOf("") }
    var optionD by remember { mutableStateOf("") }
    var correctAnswer by remember { mutableStateOf("A") }
    var duration by remember { mutableStateOf(30f) }
    var isLaunching by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Poll Configuration",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Segmented Button for Poll Type
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF0F172A), RoundedCornerShape(8.dp))
                            .padding(4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (pollType == "mcq") Color(0xFF6366F1) else Color.Transparent)
                                .clickable { pollType = "mcq" }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Multiple Choice", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (pollType == "thumbs") Color(0xFF6366F1) else Color.Transparent)
                                .clickable { pollType = "thumbs" }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Thumbs Up / Down", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = question,
                        onValueChange = { question = it },
                        label = { Text("Poll Question / Statement") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF6366F1),
                            unfocusedBorderColor = Color(0xFF475569),
                            focusedLabelColor = Color(0xFF6366F1),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (pollType == "mcq") {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Options & Answers", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Spacer(modifier = Modifier.height(8.dp))

                        // A & B
                        OutlinedTextField(
                            value = optionA,
                            onValueChange = { optionA = it },
                            label = { Text("Option A") },
                            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = optionB,
                            onValueChange = { optionB = it },
                            label = { Text("Option B") },
                            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = optionC,
                            onValueChange = { optionC = it },
                            label = { Text("Option C") },
                            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = optionD,
                            onValueChange = { optionD = it },
                            label = { Text("Option D") },
                            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Select Correct Answer", color = Color(0xFF94A3B8), fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(6.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            listOf("A", "B", "C", "D").forEach { choice ->
                                val isSelected = correctAnswer == choice
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (isSelected) Color(0xFF6366F1) else Color(0xFF334155))
                                        .clickable { correctAnswer = choice }
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(choice, color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    Text("Duration: ${duration.toInt()} seconds", color = Color.White, fontSize = 13.sp)
                    Slider(
                        value = duration,
                        onValueChange = { duration = it },
                        valueRange = 10f..120f,
                        colors = SliderDefaults.colors(
                            thumbColor = Color(0xFF6366F1),
                            activeTrackColor = Color(0xFF6366F1)
                        )
                    )

                    errorMsg?.let { err ->
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(err, color = Color(0xFFEF4444), fontSize = 12.sp)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            if (question.trim().isEmpty()) {
                                errorMsg = "Question cannot be empty"
                                return@Button
                            }
                            if (pollType == "mcq" && (optionA.trim().isEmpty() || optionB.trim().isEmpty() || optionC.trim().isEmpty() || optionD.trim().isEmpty())) {
                                errorMsg = "All MCQ options must be specified"
                                return@Button
                            }

                            isLaunching = true
                            errorMsg = null

                            val newPoll = Poll(
                                id = "poll-${System.currentTimeMillis()}",
                                type = pollType,
                                question = question.trim(),
                                options = if (pollType == "mcq") mapOf("A" to optionA.trim(), "B" to optionB.trim(), "C" to optionC.trim(), "D" to optionD.trim()) else null,
                                correctAnswer = if (pollType == "mcq") correctAnswer else null,
                                duration = duration.toInt(),
                                timeRemaining = duration.toInt(),
                                state = "idle"
                            )

                            FirebaseService.createPoll(sessionId, newPoll) { exc ->
                                isLaunching = false
                                if (exc != null) {
                                    errorMsg = exc.message
                                } else {
                                    onPollLaunched()
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6366F1)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Setup Poll & Broadcast", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun LeaderboardTab(students: List<Student>) {
    val sortedStudents = students.sortedByDescending { it.score }

    if (sortedStudents.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No students in the classroom yet.", color = Color(0xFF94A3B8))
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(sortedStudents.zip(1..sortedStudents.size)) { (student, rank) ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .background(
                                        when (rank) {
                                            1 -> Color(0xFFF59E0B) // Gold
                                            2 -> Color(0xFF94A3B8) // Silver
                                            3 -> Color(0xFFB45309) // Bronze
                                            else -> Color(0xFF334155)
                                        },
                                        CircleShape
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "$rank",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }

                            Spacer(modifier = Modifier.width(12.dp))

                            Column {
                                Text(
                                    text = student.name,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                    fontSize = 15.sp
                                )
                                Text(
                                    text = "${student.correctAnswersCount}/${student.totalAnsweredCount} Correct answers",
                                    fontSize = 11.sp,
                                    color = Color(0xFF94A3B8)
                                )
                            }
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = "${student.score} pts",
                                color = Color(0xFF818CF8),
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            val avgSpeed = if (student.totalAnsweredCount > 0) student.totalResponseTimeMs / student.totalAnsweredCount else 0L
                            Text(
                                text = "Avg: ${String.format("%.1fs", avgSpeed / 1000f)}",
                                color = Color(0xFF64748B),
                                fontSize = 10.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ChatTab(
    sessionId: String,
    senderName: String,
    role: String,
    messages: List<ChatMessage>
) {
    var messageText by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            reverseLayout = true,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Display most recent chat messages first
            items(messages.sortedByDescending { it.timestamp }) { msg ->
                val isMe = msg.sender == senderName
                val bubbleColor = when {
                    msg.role == "system" -> Color(0xFF334155).copy(alpha = 0.4f)
                    isMe -> Color(0xFF6366F1)
                    else -> Color(0xFF334155)
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 4.dp),
                    contentAlignment = if (isMe) Alignment.CenterEnd else Alignment.CenterStart
                ) {
                    Column(
                        horizontalAlignment = if (isMe) Alignment.End else Alignment.Start,
                        modifier = Modifier.widthIn(max = 280.dp)
                    ) {
                        if (msg.role != "system") {
                            Text(
                                text = if (isMe) "You" else msg.sender,
                                color = Color(0xFF94A3B8),
                                fontSize = 11.sp,
                                modifier = Modifier.padding(bottom = 2.dp)
                            )
                        }

                        Box(
                            modifier = Modifier
                                .background(bubbleColor, RoundedCornerShape(12.dp))
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text(
                                text = msg.text,
                                color = Color.White,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Input Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = messageText,
                onValueChange = { messageText = it },
                placeholder = { Text("Send a message...") },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFF6366F1),
                    unfocusedBorderColor = Color(0xFF334155),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    placeholderColor = Color(0xFF64748B)
                ),
                singleLine = true,
                modifier = Modifier.weight(1f)
            )

            Spacer(modifier = Modifier.width(8.dp))

            IconButton(
                onClick = {
                    if (messageText.trim().isNotEmpty()) {
                        val txt = messageText.trim()
                        messageText = ""
                        FirebaseService.sendChatMessage(sessionId, senderName, role, txt) {}
                    }
                },
                modifier = Modifier
                    .background(Color(0xFF6366F1), CircleShape)
                    .size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Send,
                    contentDescription = "Send",
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}
