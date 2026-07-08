package com.pollwave.app.model

data class ChatMessage(
    val id: String = "",
    val sender: String = "",
    val role: String = "", // "teacher" | "student" | "system"
    val text: String = "",
    val timestamp: Long = 0L
)

data class Poll(
    val id: String = "",
    val type: String = "mcq", // "mcq" | "thumbs"
    val question: String = "",
    val options: Map<String, String>? = null, // key is A, B, C, D
    val correctAnswer: String? = null, // e.g. "A", "B", "C", "D"
    val duration: Int = 30,
    val timeRemaining: Int = 30,
    val state: String = "idle", // "idle" | "active" | "paused" | "completed"
    val answerRevealed: Boolean = false,
    val startTime: Long? = null
)

data class Student(
    val name: String = "",
    val score: Int = 0,
    val correctAnswersCount: Int = 0,
    val totalAnsweredCount: Int = 0,
    val totalResponseTimeMs: Long = 0L,
    val lastActive: Long = 0L
)

data class StudentResponse(
    val studentName: String = "",
    val answer: String = "",
    val responseTimeMs: Long = 0L,
    val pointsEarned: Int = 0,
    val isCorrect: Boolean = false
)

data class ClassroomSession(
    val id: String = "",
    val teacherName: String = "",
    val currentPoll: Poll? = null,
    val polls: List<Poll> = emptyList(),
    val students: Map<String, Student> = emptyMap(),
    // responses is map of pollId -> map of studentName -> StudentResponse
    val responses: Map<String, Map<String, StudentResponse>> = emptyMap(),
    val chat: List<ChatMessage> = emptyList(),
    val createdAt: Long = 0L
)
