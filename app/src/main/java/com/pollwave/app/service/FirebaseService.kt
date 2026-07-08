package com.pollwave.app.service

import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import com.pollwave.app.model.*
import java.util.UUID

object FirebaseService {
    private val db: FirebaseFirestore by lazy { FirebaseFirestore.getInstance() }

    // Hardcoded accounts for sandbox fallback
    private val TEACHER_ACCOUNTS = mapOf(
        "teacher" to "password123",
        "admin" to "admin123",
        "professor" to "pollwave2026"
    )

    fun loginTeacher(username: String, password: String, onComplete: (Boolean, String?) -> Unit) {
        val normalized = username.lowercase().trim()
        val trimmedPassword = password.trim()
        val defaultPassword = TEACHER_ACCOUNTS[normalized]

        if (defaultPassword != null) {
            if (defaultPassword == trimmedPassword) {
                onComplete(true, null)
            } else {
                onComplete(false, "Incorrect password for this sandbox account.")
            }
            return
        }

        // On-the-fly registration using Firestore to keep it server-like!
        val teacherRef = db.collection("teachers").document(normalized)
        teacherRef.get()
            .addOnSuccessListener { doc ->
                if (doc.exists()) {
                    val savedPassword = doc.getString("password")
                    if (savedPassword == trimmedPassword) {
                        onComplete(true, null)
                    } else {
                        onComplete(false, "Incorrect password for this custom account.")
                    }
                } else {
                    // Register on the fly
                    teacherRef.set(mapOf("username" to normalized, "password" to trimmedPassword))
                        .addOnSuccessListener {
                            onComplete(true, null)
                        }
                        .addOnFailureListener { e ->
                            onComplete(false, "Registration error: ${e.message}")
                        }
                }
            }
            .addOnFailureListener { e ->
                onComplete(false, "Network error: ${e.message}")
            }
    }

    fun createSession(teacherName: String, onComplete: (ClassroomSession?, Exception?) -> Unit) {
        val sessionId = (100000..999999).random().toString()
        val docRef = db.collection("sessions").document(sessionId)

        val welcomeMsg = ChatMessage(
            id = "welcome",
            sender = "System",
            role = "system",
            text = "Classroom session created! Share Session ID $sessionId with your students to join.",
            timestamp = System.currentTimeMillis()
        )

        val session = ClassroomSession(
            id = sessionId,
            teacherName = teacherName,
            createdAt = System.currentTimeMillis(),
            chat = listOf(welcomeMsg)
        )

        docRef.set(session)
            .addOnSuccessListener {
                onComplete(session, null)
            }
            .addOnFailureListener { e ->
                onComplete(null, e)
            }
    }

    fun joinSession(sessionId: String, studentName: String, onComplete: (ClassroomSession?, Exception?) -> Unit) {
        val docRef = db.collection("sessions").document(sessionId)

        db.runTransaction { transaction ->
            val snapshot = transaction.get(docRef)
            if (!snapshot.exists()) {
                throw Exception("Session $sessionId not found. Verify the ID.")
            }

            val session = snapshot.toObject(ClassroomSession::class.java)!!
            val normalizedStudent = studentName.trim()

            // If student already exists, update heartbeat and return
            val studentsMap = session.students.toMutableMap()
            val chatList = session.chat.toMutableList()

            if (!studentsMap.containsKey(normalizedStudent)) {
                val newStudent = Student(
                    name = normalizedStudent,
                    score = 0,
                    correctAnswersCount = 0,
                    totalAnsweredCount = 0,
                    totalResponseTimeMs = 0L,
                    lastActive = System.currentTimeMillis()
                )
                studentsMap[normalizedStudent] = newStudent

                // Join notification message
                val joinMsg = ChatMessage(
                    id = "join-$normalizedStudent-${System.currentTimeMillis()}",
                    sender = "System",
                    role = "system",
                    text = "$normalizedStudent has joined the room.",
                    timestamp = System.currentTimeMillis()
                )
                chatList.add(joinMsg)
            } else {
                val student = studentsMap[normalizedStudent]!!
                studentsMap[normalizedStudent] = student.copy(lastActive = System.currentTimeMillis())
            }

            val updatedSession = session.copy(students = studentsMap, chat = chatList)
            transaction.set(docRef, updatedSession)
            updatedSession
        }.addOnSuccessListener { updatedSession ->
            onComplete(updatedSession, null)
        }.addOnFailureListener { e ->
            onComplete(null, Exception(e.message))
        }
    }

    fun listenToSession(sessionId: String, onUpdate: (ClassroomSession?) -> Unit): ListenerRegistration {
        val docRef = db.collection("sessions").document(sessionId)
        return docRef.addSnapshotListener { snapshot, e ->
            if (e != null) {
                onUpdate(null)
                return@addSnapshotListener
            }
            if (snapshot != null && snapshot.exists()) {
                val session = snapshot.toObject(ClassroomSession::class.java)
                onUpdate(session)
            } else {
                onUpdate(null)
            }
        }
    }

    fun createPoll(sessionId: String, poll: Poll, onComplete: (Exception?) -> Unit) {
        val docRef = db.collection("sessions").document(sessionId)
        
        db.runTransaction { transaction ->
            val snapshot = transaction.get(docRef)
            val session = snapshot.toObject(ClassroomSession::class.java) ?: throw Exception("Session not found")
            
            // Clear current poll responses
            val updatedResponses = session.responses.toMutableMap()
            updatedResponses[poll.id] = emptyMap()

            val updatedSession = session.copy(
                currentPoll = poll,
                responses = updatedResponses
            )
            transaction.set(docRef, updatedSession)
        }.addOnSuccessListener {
            onComplete(null)
        }.addOnFailureListener { e ->
            onComplete(e)
        }
    }

    fun controlPoll(sessionId: String, action: String, onComplete: (Exception?) -> Unit) {
        val docRef = db.collection("sessions").document(sessionId)

        db.runTransaction { transaction ->
            val snapshot = transaction.get(docRef)
            val session = snapshot.toObject(ClassroomSession::class.java) ?: throw Exception("Session not found")
            val currentPoll = session.currentPoll ?: throw Exception("No active poll to control")

            val updatedPoll = when (action) {
                "start" -> currentPoll.copy(state = "active", startTime = System.currentTimeMillis())
                "pause" -> currentPoll.copy(state = "paused")
                "stop" -> currentPoll.copy(state = "completed")
                "reveal" -> currentPoll.copy(answerRevealed = true)
                "end" -> null
                else -> throw Exception("Invalid control action")
            }

            val pollsList = session.polls.toMutableList()
            if (action == "end") {
                pollsList.add(currentPoll.copy(state = "completed"))
            }

            val updatedSession = session.copy(
                currentPoll = updatedPoll,
                polls = pollsList
            )
            transaction.set(docRef, updatedSession)
        }.addOnSuccessListener {
            onComplete(null)
        }.addOnFailureListener { e ->
            onComplete(e)
        }
    }

    fun submitResponse(
        sessionId: String,
        studentName: String,
        answer: String,
        onComplete: (Exception?) -> Unit
    ) {
        val docRef = db.collection("sessions").document(sessionId)

        db.runTransaction { transaction ->
            val snapshot = transaction.get(docRef)
            val session = snapshot.toObject(ClassroomSession::class.java) ?: throw Exception("Session not found")
            val poll = session.currentPoll ?: throw Exception("No active poll running")

            if (poll.state != "active") {
                throw Exception("Poll is not accepting answers right now.")
            }

            // Check if student responded already
            val pollId = poll.id
            val responsesMap = session.responses.toMutableMap()
            val pollResponses = (responsesMap[pollId] ?: emptyMap()).toMutableMap()

            if (pollResponses.containsKey(studentName)) {
                throw Exception("You have already voted.")
            }

            val responseTimeMs = if (poll.startTime != null) System.currentTimeMillis() - poll.startTime else 2000L

            var isCorrect = false
            var points = 0
            if (poll.type == "mcq") {
                isCorrect = (answer == poll.correctAnswer)
                if (isCorrect) {
                    val remainingRatio = if (poll.duration > 0) poll.timeRemaining.toFloat() / poll.duration else 1f
                    val speedBonus = (50f * remainingRatio).toInt().coerceIn(0, 50)
                    points = 100 + speedBonus
                }
            } else {
                // Thumbs Up / Thumbs Down survey style
                points = 50 // participation points
            }

            // Record response
            val studentResponse = StudentResponse(
                studentName = studentName,
                answer = answer,
                responseTimeMs = responseTimeMs,
                pointsEarned = points,
                isCorrect = isCorrect
            )
            pollResponses[studentName] = studentResponse
            responsesMap[pollId] = pollResponses

            // Update student scores/analytics
            val studentsMap = session.students.toMutableMap()
            val student = studentsMap[studentName] ?: throw Exception("Student registration not found")

            val updatedStudent = student.copy(
                score = student.score + points,
                correctAnswersCount = student.correctAnswersCount + (if (isCorrect) 1 else 0),
                totalAnsweredCount = student.totalAnsweredCount + 1,
                totalResponseTimeMs = student.totalResponseTimeMs + responseTimeMs
            )
            studentsMap[studentName] = updatedStudent

            val updatedSession = session.copy(
                responses = responsesMap,
                students = studentsMap
            )
            transaction.set(docRef, updatedSession)
        }.addOnSuccessListener {
            onComplete(null)
        }.addOnFailureListener { e ->
            onComplete(e)
        }
    }

    fun sendChatMessage(sessionId: String, sender: String, role: String, text: String, onComplete: (Exception?) -> Unit) {
        val docRef = db.collection("sessions").document(sessionId)

        db.runTransaction { transaction ->
            val snapshot = transaction.get(docRef)
            val session = snapshot.toObject(ClassroomSession::class.java) ?: throw Exception("Session not found")

            val newMessage = ChatMessage(
                id = UUID.randomUUID().toString(),
                sender = sender,
                role = role,
                text = text,
                timestamp = System.currentTimeMillis()
            )

            val updatedChat = session.chat.toMutableList()
            updatedChat.add(newMessage)

            // Keep chat from growing infinitely to save Firestore storage
            if (updatedChat.size > 100) {
                updatedChat.removeAt(0)
            }

            val updatedSession = session.copy(chat = updatedChat)
            transaction.set(docRef, updatedSession)
        }.addOnSuccessListener {
            onComplete(null)
        }.addOnFailureListener { e ->
            onComplete(e)
        }
    }

    fun sendHeartbeat(sessionId: String, studentName: String) {
        val docRef = db.collection("sessions").document(sessionId)
        docRef.get().addOnSuccessListener { snapshot ->
            if (snapshot.exists()) {
                val session = snapshot.toObject(ClassroomSession::class.java) ?: return@addOnSuccessListener
                val studentsMap = session.students.toMutableMap()
                val student = studentsMap[studentName] ?: return@addOnSuccessListener

                studentsMap[studentName] = student.copy(lastActive = System.currentTimeMillis())
                docRef.update("students", studentsMap)
            }
        }
    }
}
