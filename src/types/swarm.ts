export type TeamId = 'layout' | 'typography' | 'visual' | 'qc' | 'error_correction';

export type ElementCategory =
  | 'section'
  | 'container'
  | 'heading'
  | 'paragraph'
  | 'button'
  | 'image'
  | 'icon'
  | 'border';

export type ElementStatus =
  | 'pending_parent'
  | 'queued'
  | 'in_progress'
  | 'built_unverified'
  | 'inspecting'
  | 'flagged_error'
  | 'repairing'
  | 'verified';

export interface BlueprintElement {
  id: string;
  label: string;
  category: ElementCategory;
  primaryTeam: TeamId;
  parentId: string | null;
  // Normalized coordinates (0..1000 canvas coordinate space for crisp scaling)
  x: number;
  y: number;
  width: number;
  height: number;
  status: ElementStatus;
  buildProgress: number; // 0..100
  inspectProgress: number; // 0..100
  repairProgress: number; // 0..100
  hasLatentDefect: boolean;
  defectType?: string;
  assignedCursorId: number | null;
  handoffPulse: number; // 0..1 decaying pulse when passed between teams
  handoffColor: string;
  priority: boolean;
  // Visual content metadata for realistic reconstruction rendering
  textSample?: string;
  subLines?: number;
  accentColor?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface SwarmCursor {
  id: number;
  team: TeamId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  targetElementId: string | null;
  state: 'idle' | 'moving' | 'working' | 'inspecting' | 'repairing';
  tasksCompleted: number;
  repairsCompleted: number;
  trail: Point[];
  phaseOffset: number;
}

export interface CoordinationLink {
  id: string;
  fromCursorId: number;
  toCursorId: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromTeam: TeamId;
  toTeam: TeamId;
  elementId: string;
  elementLabel: string;
  reason: 'unlock_child' | 'request_qc' | 'dispatch_repair' | 'repair_complete';
  progress: number; // 0..1
  createdAt: number;
}

export interface SwarmEventLog {
  id: string;
  timestamp: string;
  fromTeam: TeamId;
  toTeam?: TeamId;
  elementLabel: string;
  message: string;
  type: 'handoff' | 'defect_found' | 'repair_done' | 'milestone';
}

export interface TeamConfig {
  id: TeamId;
  name: string;
  roleTitle: string;
  color: string;
  secondaryColor: string;
  description: string;
  tasksDescription: string[];
  enabled: boolean;
}

export type ReconstructionPhase =
  | 'Standby — Ready to Initialize'
  | 'Phase 1: Structural Layout Framing'
  | 'Phase 2: Visual & Typography Assembly'
  | 'Phase 3: Quality Control & Error Rectification'
  | 'Phase 4: Final Integrity Verification'
  | 'Reconstruction Complete — 100% Verified';
