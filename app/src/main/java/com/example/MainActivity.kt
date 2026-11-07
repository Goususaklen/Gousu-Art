package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.MyApplicationTheme
import kotlinx.coroutines.delay
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

enum class SwarmTeam(val label: String, val role: String, val color: Color) {
  LAYOUT("BLUE TEAM", "Layout Engineers", Color(0xFF3B82F6)),
  TYPOGRAPHY("PURPLE TEAM", "Typography Engineers", Color(0xFFA855F7)),
  VISUAL("CYAN TEAM", "Visual Engineers", Color(0xFF06B6D4)),
  QC("GREEN TEAM", "Quality Control", Color(0xFF22C55E)),
  ERROR_CORRECTION("YELLOW TEAM", "Error Correction", Color(0xFFFACC15))
}

enum class NodeStatus {
  QUEUED, IN_PROGRESS, BUILT_UNVERIFIED, INSPECTING, FLAGGED_ERROR, REPAIRING, VERIFIED
}

data class BlueprintNode(
  val id: String,
  val label: String,
  val primaryTeam: SwarmTeam,
  val x: Float,
  val y: Float,
  val w: Float,
  val h: Float,
  var status: NodeStatus = NodeStatus.QUEUED,
  var buildProgress: Float = 0f,
  var inspectProgress: Float = 0f,
  var repairProgress: Float = 0f,
  var hasDefect: Boolean = false,
  var handoffPulse: Float = 0f
)

data class AgentCursor(
  val id: Int,
  val team: SwarmTeam,
  var x: Float,
  var y: Float,
  var targetX: Float,
  var targetY: Float,
  var targetNodeId: String? = null,
  var completedTasks: Int = 0
)

data class HandoffSignal(
  val fromX: Float,
  val fromY: Float,
  val toX: Float,
  val toY: Float,
  val color: Color,
  var progress: Float = 0f
)

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      MyApplicationTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF09090B)) {
          GousuSwarmApp()
        }
      }
    }
  }
}

@Composable
fun GousuSwarmApp() {
  var urlInput by remember { mutableStateOf("https://linear.app/features") }
  var isRunning by remember { mutableStateOf(true) }
  var swarmMode by remember { mutableStateOf(true) }
  var showCoordination by remember { mutableStateOf(true) }
  var speed by remember { mutableFloatStateOf(1.4f) }
  var tick by remember { mutableIntStateOf(0) }

  val enabledTeams = remember {
    mutableStateMapOf(
      SwarmTeam.LAYOUT to true,
      SwarmTeam.TYPOGRAPHY to true,
      SwarmTeam.VISUAL to true,
      SwarmTeam.QC to true,
      SwarmTeam.ERROR_CORRECTION to true
    )
  }

  val nodes = remember {
    mutableStateListOf(
      BlueprintNode("nav", "Header Navigation Frame", SwarmTeam.LAYOUT, 0.04f, 0.04f, 0.92f, 0.10f),
      BlueprintNode("hero-box", "Hero Section Container", SwarmTeam.LAYOUT, 0.04f, 0.17f, 0.92f, 0.34f),
      BlueprintNode("hero-h1", "Hero Display Headline", SwarmTeam.TYPOGRAPHY, 0.07f, 0.21f, 0.48f, 0.12f, hasDefect = true),
      BlueprintNode("hero-cta", "Primary Action Button", SwarmTeam.TYPOGRAPHY, 0.07f, 0.37f, 0.26f, 0.10f),
      BlueprintNode("hero-img", "3D Wireframe Viewport", SwarmTeam.VISUAL, 0.58f, 0.20f, 0.35f, 0.28f, hasDefect = true),
      BlueprintNode("grid-1", "Feature Card 01", SwarmTeam.LAYOUT, 0.04f, 0.55f, 0.29f, 0.28f),
      BlueprintNode("grid-2", "Feature Card 02", SwarmTeam.VISUAL, 0.35f, 0.55f, 0.29f, 0.28f, hasDefect = true),
      BlueprintNode("grid-3", "Feature Card 03", SwarmTeam.TYPOGRAPHY, 0.67f, 0.55f, 0.29f, 0.28f),
      BlueprintNode("footer", "Telemetry Footer Bar", SwarmTeam.LAYOUT, 0.04f, 0.86f, 0.92f, 0.10f)
    )
  }

  val cursors = remember {
    mutableStateListOf<AgentCursor>().apply {
      val teams = SwarmTeam.entries
      for (i in 0 until 35) {
        val t = teams[i % teams.size]
        add(
          AgentCursor(
            id = i + 1,
            team = t,
            x = (0.1f + (i * 0.07f) % 0.8f),
            y = (0.1f + (i * 0.09f) % 0.8f),
            targetX = 0.5f,
            targetY = 0.5f
          )
        )
      }
    }
  }

  val signals = remember { mutableStateListOf<HandoffSignal>() }

  LaunchedEffect(isRunning, speed, swarmMode) {
    while (true) {
      delay(24)
      if (!isRunning) continue
      tick++

      nodes.forEach { n ->
        if (n.handoffPulse > 0f) {
          n.handoffPulse = max(0f, n.handoffPulse - 0.04f * speed)
        }
      }

      val iter = signals.listIterator()
      while (iter.hasNext()) {
        val s = iter.next()
        s.progress += 0.05f * speed
        if (s.progress >= 1f) iter.remove()
      }

      cursors.forEach { c ->
        if (swarmMode && enabledTeams[c.team] != true) return@forEach

        val target = nodes.firstOrNull { n ->
          if (!swarmMode) n.status != NodeStatus.VERIFIED
          else when (c.team) {
            SwarmTeam.QC -> n.status == NodeStatus.BUILT_UNVERIFIED || n.status == NodeStatus.INSPECTING
            SwarmTeam.ERROR_CORRECTION -> n.status == NodeStatus.FLAGGED_ERROR || n.status == NodeStatus.REPAIRING
            else -> n.primaryTeam == c.team && (n.status == NodeStatus.QUEUED || n.status == NodeStatus.IN_PROGRESS)
          }
        }

        if (target != null) {
          c.targetX = target.x + target.w * 0.5f
          c.targetY = target.y + target.h * 0.5f
          val dx = c.targetX - c.x
          val dy = c.targetY - c.y
          val d = hypot(dx, dy)
          val step = 0.018f * speed
          if (d > step) {
            c.x += (dx / d) * step
            c.y += (dy / d) * step
          } else {
            c.x = c.targetX
            c.y = c.targetY
            val inc = 2.8f * speed
            when {
              !swarmMode -> {
                target.buildProgress = min(100f, target.buildProgress + inc)
                if (target.buildProgress >= 100f) target.status = NodeStatus.VERIFIED
              }
              c.team == SwarmTeam.QC -> {
                target.status = NodeStatus.INSPECTING
                target.inspectProgress = min(100f, target.inspectProgress + inc)
                if (target.inspectProgress >= 100f) {
                  c.completedTasks++
                  if (target.hasDefect) {
                    target.status = NodeStatus.FLAGGED_ERROR
                    target.handoffPulse = 1f
                    val yellowPeer = cursors.firstOrNull { it.team == SwarmTeam.ERROR_CORRECTION }
                    if (yellowPeer != null && showCoordination) {
                      signals.add(HandoffSignal(c.x, c.y, yellowPeer.x, yellowPeer.y, SwarmTeam.ERROR_CORRECTION.color))
                    }
                  } else {
                    target.status = NodeStatus.VERIFIED
                  }
                }
              }
              c.team == SwarmTeam.ERROR_CORRECTION -> {
                target.status = NodeStatus.REPAIRING
                target.repairProgress = min(100f, target.repairProgress + inc)
                if (target.repairProgress >= 100f) {
                  target.hasDefect = false
                  target.status = NodeStatus.VERIFIED
                  target.handoffPulse = 1f
                  c.completedTasks++
                }
              }
              else -> {
                target.status = NodeStatus.IN_PROGRESS
                target.buildProgress = min(100f, target.buildProgress + inc)
                if (target.buildProgress >= 100f) {
                  target.status = NodeStatus.BUILT_UNVERIFIED
                  target.handoffPulse = 0.9f
                  c.completedTasks++
                  val qcPeer = cursors.firstOrNull { it.team == SwarmTeam.QC }
                  if (qcPeer != null && showCoordination) {
                    signals.add(HandoffSignal(c.x, c.y, qcPeer.x, qcPeer.y, SwarmTeam.QC.color))
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  val verifiedCount = nodes.count { it.status == NodeStatus.VERIFIED }
  val progressPct = ((verifiedCount.toFloat() / max(1, nodes.size)) * 100).toInt()

  LazyColumn(
    modifier = Modifier
      .fillMaxSize()
      .background(Color(0xFF09090B))
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp)
  ) {
    item {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          text = "GOUSU SWARM",
          color = Color.White,
          fontSize = 20.sp,
          fontWeight = FontWeight.Bold
        )
        Button(
          onClick = { isRunning = !isRunning },
          colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
        ) {
          Text(if (isRunning) "Pause Swarm" else "Resume Swarm", color = Color.White)
        }
      }
    }

    item {
      OutlinedTextField(
        value = urlInput,
        onValueChange = { urlInput = it },
        label = { Text("Target Website URL", color = Color.LightGray) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true
      )
    }

    item {
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(280.dp)
          .border(1.dp, Color(0xFF27272A), RoundedCornerShape(8.dp))
          .background(Color(0xFF121216))
      ) {
        val currentTick = tick
        Canvas(modifier = Modifier.fillMaxSize()) {
          if (currentTick >= 0) {
            val w = size.width
            val h = size.height

            nodes.forEach { n ->
              val rectTopLeft = Offset(n.x * w, n.y * h)
              val rectSize = Size(n.w * w, n.h * h)
              val borderColor = when (n.status) {
                NodeStatus.FLAGGED_ERROR -> Color(0xFFEF4444)
                NodeStatus.REPAIRING -> Color(0xFFFACC15)
                NodeStatus.VERIFIED -> Color(0xFF22C55E)
                else -> n.primaryTeam.color
              }
              drawRect(
                color = borderColor.copy(alpha = 0.18f),
                topLeft = rectTopLeft,
                size = Size(rectSize.width * (n.buildProgress / 100f), rectSize.height)
              )
              drawRect(
                color = borderColor,
                topLeft = rectTopLeft,
                size = rectSize,
                style = Stroke(width = 2f)
              )
            }

            if (showCoordination) {
              signals.forEach { sig ->
                drawLine(
                  color = sig.color.copy(alpha = 0.6f),
                  start = Offset(sig.fromX * w, sig.fromY * h),
                  end = Offset(sig.toX * w, sig.toY * h),
                  strokeWidth = 2f
                )
              }
            }

            cursors.forEach { c ->
              val cx = c.x * w
              val cy = c.y * h
              val p = Path().apply {
                moveTo(cx, cy)
                lineTo(cx, cy + 16f)
                lineTo(cx + 11f, cy + 11f)
                close()
              }
              drawPath(p, color = c.team.color)
            }
          }
        }
      }
    }

    item {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Text("Progress: $progressPct%", color = Color(0xFFFACC15), fontFamily = FontFamily.Monospace)
        Text("Verified: $verifiedCount / ${nodes.size}", color = Color.White, fontFamily = FontFamily.Monospace)
      }
    }

    items(SwarmTeam.entries) { team ->
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .border(1.dp, Color(0xFF27272A), RoundedCornerShape(6.dp))
          .background(Color(0xFF121216))
          .clickable { enabledTeams[team] = !(enabledTeams[team] ?: true) }
          .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column {
          Text(team.label, color = team.color, fontWeight = FontWeight.Bold, fontSize = 12.sp)
          Text(team.role, color = Color.White, fontSize = 14.sp)
        }
        Text(
          text = if (enabledTeams[team] == true) "ACTIVE" else "DISABLED",
          color = if (enabledTeams[team] == true) Color(0xFFFACC15) else Color.Gray,
          fontFamily = FontFamily.Monospace,
          fontSize = 12.sp
        )
      }
    }
  }
}
