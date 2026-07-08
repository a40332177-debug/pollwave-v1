package com.pollwave.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.google.firebase.FirebaseApp
import com.pollwave.app.ui.screens.LandingScreen
import com.pollwave.app.ui.screens.StudentDashboardScreen
import com.pollwave.app.ui.screens.TeacherDashboardScreen
import com.pollwave.app.ui.screens.TeacherLoginScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Ensure Firebase is initialized
        try {
            FirebaseApp.initializeApp(this)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    NavHost(navController = navController, startDestination = "landing") {
                        composable("landing") {
                            LandingScreen(
                                onNavigateToTeacherLogin = {
                                    navController.navigate("teacher_login")
                                },
                                onNavigateToStudentDashboard = { sessionId, studentName ->
                                    navController.navigate("student_dashboard/$sessionId/$studentName")
                                }
                            )
                        }
                        composable("teacher_login") {
                            TeacherLoginScreen(
                                onLoginSuccess = { teacherName ->
                                    navController.navigate("teacher_dashboard/$teacherName") {
                                        popUpTo("landing") { inclusive = false }
                                    }
                                },
                                onBack = {
                                    navController.popBackStack()
                                }
                            )
                        }
                        composable("teacher_dashboard/{teacherName}") { backStackEntry ->
                            val teacherName = backStackEntry.arguments?.getString("teacherName") ?: "Teacher"
                            TeacherDashboardScreen(
                                teacherName = teacherName,
                                onLogout = {
                                    navController.navigate("landing") {
                                        popUpTo(0) { inclusive = true }
                                    }
                                }
                            )
                        }
                        composable("student_dashboard/{sessionId}/{studentName}") { backStackEntry ->
                            val sessionId = backStackEntry.arguments?.getString("sessionId") ?: ""
                            val studentName = backStackEntry.arguments?.getString("studentName") ?: ""
                            StudentDashboardScreen(
                                sessionId = sessionId,
                                studentName = studentName,
                                onLeave = {
                                    navController.navigate("landing") {
                                        popUpTo(0) { inclusive = true }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
