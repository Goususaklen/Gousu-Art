import React, { useEffect, useRef } from 'react';
import {
  BlueprintElement,
  CoordinationLink,
  SwarmCursor,
  SwarmEventLog,
  TeamConfig,
  TeamId,
} from '../types/swarm';

interface SwarmCanvasProps {
  elementsRef: React.MutableRefObject<BlueprintElement[]>;
  cursorsRef: React.MutableRefObject<SwarmCursor[]>;
  linksRef: React.MutableRefObject<CoordinationLink[]>;
  teams: Record<TeamId, TeamConfig>;
  isRunning: boolean;
  swarmIntelligenceMode: boolean;
  showCoordinationLinks: boolean;
  cursorSpeed: number;
  cursorSize: number;
  classicColor: string;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onPushEvent: (event: Omit<SwarmEventLog, 'id' | 'timestamp'>) => void;
  onStatsTick: () => void;
  targetUrl: string;
}

const VIRTUAL_WIDTH = 1000;
const VIRTUAL_HEIGHT = 700;

export const SwarmCanvas: React.FC<SwarmCanvasProps> = ({
  elementsRef,
  cursorsRef,
  linksRef,
  teams,
  isRunning,
  swarmIntelligenceMode,
  showCoordinationLinks,
  cursorSpeed,
  cursorSize,
  classicColor,
  selectedElementId,
  onSelectElement,
  onPushEvent,
  onStatsTick,
  targetUrl,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCountRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const spawnCoordinationLink = (
      fromCursor: SwarmCursor,
      toTeam: TeamId,
      element: BlueprintElement,
      reason: CoordinationLink['reason']
    ) => {
      if (!showCoordinationLinks) return;
      const candidates = cursorsRef.current.filter(
        (c) => c.team === toTeam && c.id !== fromCursor.id
      );
      if (candidates.length === 0) return;

      // Find nearest teammate in target team
      let nearest = candidates[0];
      let minDist = Infinity;
      for (const c of candidates) {
        const d = Math.hypot(c.x - fromCursor.x, c.y - fromCursor.y);
        if (d < minDist) {
          minDist = d;
          nearest = c;
        }
      }

      // Limit active links so visuals stay subtle and clean
      if (linksRef.current.length > 18) {
        linksRef.current.shift();
      }

      linksRef.current.push({
        id: `${Date.now()}-${Math.random()}`,
        fromCursorId: fromCursor.id,
        toCursorId: nearest.id,
        fromX: fromCursor.x,
        fromY: fromCursor.y,
        toX: nearest.x,
        toY: nearest.y,
        fromTeam: fromCursor.team,
        toTeam,
        elementId: element.id,
        elementLabel: element.label,
        reason,
        progress: 0,
        createdAt: performance.now(),
      });
    };

    const updateSimulation = () => {
      const elements = elementsRef.current;
      const cursors = cursorsRef.current;
      const links = linksRef.current;

      // 1. Decay element handoff pulses
      for (const el of elements) {
        if (el.handoffPulse > 0) {
          el.handoffPulse = Math.max(0, el.handoffPulse - 0.022 * cursorSpeed);
        }
      }

      // 2. Advance & prune coordination links
      for (let i = links.length - 1; i >= 0; i--) {
        const lnk = links[i];
        lnk.progress += 0.032 * Math.max(0.6, cursorSpeed);
        const src = cursors.find((c) => c.id === lnk.fromCursorId);
        const dst = cursors.find((c) => c.id === lnk.toCursorId);
        if (src) {
          lnk.fromX = src.x;
          lnk.fromY = src.y;
        }
        if (dst) {
          lnk.toX = dst.x;
          lnk.toY = dst.y;
        }
        if (lnk.progress >= 1) {
          links.splice(i, 1);
        }
      }

      // 3. Unlock any children whose parent is at least built_unverified
      for (const el of elements) {
        if (el.status === 'pending_parent' && el.parentId) {
          const parent = elements.find((p) => p.id === el.parentId);
          if (
            parent &&
            (parent.status === 'built_unverified' ||
              parent.status === 'inspecting' ||
              parent.status === 'flagged_error' ||
              parent.status === 'repairing' ||
              parent.status === 'verified')
          ) {
            el.status = 'queued';
            el.handoffPulse = 0.85;
            el.handoffColor = teams[el.primaryTeam]?.color || '#3B82F6';
          }
        }
      }

      // 4. Update each cursor's task assignment & movement
      for (const cursor of cursors) {
        const teamCfg = teams[cursor.team];
        const isTeamEnabled = !swarmIntelligenceMode || (teamCfg && teamCfg.enabled);

        if (!isTeamEnabled) {
          cursor.state = 'idle';
          cursor.targetElementId = null;
          // Gentle orbital drift at top margin when disabled
          cursor.x += Math.cos(frameCountRef.current * 0.02 + cursor.phaseOffset) * 0.35;
          cursor.y += Math.sin(frameCountRef.current * 0.02 + cursor.phaseOffset) * 0.35;
          continue;
        }

        // Validate current target
        let targetEl = cursor.targetElementId
          ? elements.find((e) => e.id === cursor.targetElementId) || null
          : null;

        if (targetEl) {
          const validForTeam = (() => {
            if (!swarmIntelligenceMode) {
              return targetEl.status !== 'verified' && targetEl.status !== 'pending_parent';
            }
            if (cursor.team === 'qc') {
              return (
                targetEl.status === 'built_unverified' || targetEl.status === 'inspecting'
              );
            }
            if (cursor.team === 'error_correction') {
              return targetEl.status === 'flagged_error' || targetEl.status === 'repairing';
            }
            return (
              targetEl.primaryTeam === cursor.team &&
              (targetEl.status === 'queued' || targetEl.status === 'in_progress')
            );
          })();

          if (!validForTeam) {
            targetEl = null;
            cursor.targetElementId = null;
            cursor.state = 'idle';
          }
        }

        // Find a new task if needed
        if (!targetEl) {
          const available = elements.filter((el) => {
            if (!swarmIntelligenceMode) {
              return (
                el.status === 'queued' ||
                el.status === 'in_progress' ||
                el.status === 'built_unverified' ||
                el.status === 'inspecting' ||
                el.status === 'flagged_error' ||
                el.status === 'repairing'
              );
            }
            if (cursor.team === 'qc') {
              return el.status === 'built_unverified' || el.status === 'inspecting';
            }
            if (cursor.team === 'error_correction') {
              return el.status === 'flagged_error' || el.status === 'repairing';
            }
            return (
              el.primaryTeam === cursor.team &&
              (el.status === 'queued' || el.status === 'in_progress')
            );
          });

          if (available.length > 0) {
            // Sort by priority first, then unassigned first, then distance
            available.sort((a, b) => {
              if (a.priority !== b.priority) return a.priority ? -1 : 1;
              const aUnassigned = a.assignedCursorId === null ? 0 : 1;
              const bUnassigned = b.assignedCursorId === null ? 0 : 1;
              if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned;
              const da = Math.hypot(a.x + a.width / 2 - cursor.x, a.y + a.height / 2 - cursor.y);
              const db = Math.hypot(b.x + b.width / 2 - cursor.x, b.y + b.height / 2 - cursor.y);
              return da - db;
            });

            targetEl = available[0];
            cursor.targetElementId = targetEl.id;
            if (targetEl.assignedCursorId === null) {
              targetEl.assignedCursorId = cursor.id;
            }
            // Pick a dynamic work point inside the element
            const margin = 8;
            cursor.targetX =
              targetEl.x +
              margin +
              ((Math.sin(cursor.id * 17.3 + frameCountRef.current * 0.05) + 1) *
                0.5 *
                Math.max(4, targetEl.width - margin * 2));
            cursor.targetY =
              targetEl.y +
              margin +
              ((Math.cos(cursor.id * 31.7 + frameCountRef.current * 0.05) + 1) *
                0.5 *
                Math.max(4, targetEl.height - margin * 2));
            cursor.state = 'moving';
          } else {
            // Patrol smoothly around active construction areas or standby grid
            cursor.state = 'idle';
            if (frameCountRef.current % 70 === cursor.id % 70) {
              cursor.targetX = 80 + ((cursor.id * 137) % 840);
              cursor.targetY = 70 + ((cursor.id * 251) % 560);
            }
          }
        }

        // Move cursor toward target point
        const dx = cursor.targetX - cursor.x;
        const dy = cursor.targetY - cursor.y;
        const dist = Math.hypot(dx, dy);
        const maxStep = (targetEl ? 6.2 : 2.1) * cursorSpeed;

        if (dist > maxStep) {
          cursor.vx = (dx / dist) * maxStep;
          cursor.vy = (dy / dist) * maxStep;
          cursor.x += cursor.vx;
          cursor.y += cursor.vy;
        } else {
          cursor.x = cursor.targetX;
          cursor.y = cursor.targetY;
        }

        // Record short motion trail
        cursor.trail.push({ x: cursor.x, y: cursor.y });
        if (cursor.trail.length > 6) {
          cursor.trail.shift();
        }

        // Perform task work when close to target element
        if (targetEl && dist <= Math.max(24, maxStep * 2.5)) {
          // Periodically shift cursor scanning position across element bounds
          if (frameCountRef.current % 18 === cursor.id % 18) {
            const sweepRatio = ((frameCountRef.current * 0.04 + cursor.id) % 100) / 100;
            cursor.targetX = targetEl.x + 6 + sweepRatio * Math.max(8, targetEl.width - 12);
            cursor.targetY =
              targetEl.y +
              6 +
              ((Math.sin(frameCountRef.current * 0.1 + cursor.id) + 1) *
                0.5 *
                Math.max(8, targetEl.height - 12));
          }

          const workIncrement = 0.52 * cursorSpeed;

          if (!swarmIntelligenceMode) {
            // Classic unified mode: directly builds and verifies
            cursor.state = 'working';
            if (targetEl.status === 'queued') targetEl.status = 'in_progress';
            targetEl.buildProgress = Math.min(100, targetEl.buildProgress + workIncrement * 1.1);
            if (targetEl.buildProgress >= 100) {
              targetEl.status = 'verified';
              targetEl.inspectProgress = 100;
              targetEl.hasLatentDefect = false;
              targetEl.assignedCursorId = null;
              cursor.tasksCompleted += 1;
              cursor.targetElementId = null;
            }
          } else if (cursor.team === 'qc') {
            // GREEN TEAM: Quality Control inspection
            cursor.state = 'inspecting';
            if (targetEl.status === 'built_unverified') {
              targetEl.status = 'inspecting';
            }
            targetEl.inspectProgress = Math.min(
              100,
              targetEl.inspectProgress + workIncrement * 1.45
            );

            if (targetEl.inspectProgress >= 100) {
              cursor.tasksCompleted += 1;
              targetEl.assignedCursorId = null;
              cursor.targetElementId = null;

              if (targetEl.hasLatentDefect) {
                // Flag error for YELLOW TEAM (Error Correction)!
                targetEl.status = 'flagged_error';
                targetEl.handoffPulse = 1.0;
                targetEl.handoffColor = '#FACC15';
                spawnCoordinationLink(
                  cursor,
                  'error_correction',
                  targetEl,
                  'dispatch_repair'
                );
                onPushEvent({
                  fromTeam: 'qc',
                  toTeam: 'error_correction',
                  elementLabel: targetEl.label,
                  message: `QC detected ${targetEl.defectType || 'geometry anomaly'} — dispatched Yellow Error Correction Team`,
                  type: 'defect_found',
                });
              } else {
                // Certified verified!
                targetEl.status = 'verified';
                targetEl.handoffPulse = 0.9;
                targetEl.handoffColor = '#22C55E';
                onPushEvent({
                  fromTeam: 'qc',
                  elementLabel: targetEl.label,
                  message: `Quality Control verified structural & visual integrity (100%)`,
                  type: 'milestone',
                });
              }
            }
          } else if (cursor.team === 'error_correction') {
            // YELLOW TEAM: Error Correction & Redrawing
            cursor.state = 'repairing';
            if (targetEl.status === 'flagged_error') {
              targetEl.status = 'repairing';
            }
            targetEl.repairProgress = Math.min(
              100,
              targetEl.repairProgress + workIncrement * 1.35
            );

            if (targetEl.repairProgress >= 100) {
              targetEl.hasLatentDefect = false;
              targetEl.status = 'verified';
              targetEl.handoffPulse = 1.0;
              targetEl.handoffColor = '#FACC15';
              targetEl.assignedCursorId = null;
              cursor.tasksCompleted += 1;
              cursor.repairsCompleted += 1;
              cursor.targetElementId = null;

              spawnCoordinationLink(cursor, 'qc', targetEl, 'repair_complete');
              onPushEvent({
                fromTeam: 'error_correction',
                toTeam: 'qc',
                elementLabel: targetEl.label,
                message: `Error Correction rectified ${targetEl.defectType || 'anomaly'} & redrew node`,
                type: 'repair_done',
              });
            }
          } else {
            // BLUE (layout), PURPLE (typography), CYAN (visual)
            cursor.state = 'working';
            if (targetEl.status === 'queued') {
              targetEl.status = 'in_progress';
            }
            targetEl.buildProgress = Math.min(100, targetEl.buildProgress + workIncrement);

            if (targetEl.buildProgress >= 100) {
              targetEl.status = 'built_unverified';
              targetEl.assignedCursorId = null;
              targetEl.handoffPulse = 0.95;
              targetEl.handoffColor = '#22C55E';
              cursor.tasksCompleted += 1;
              cursor.targetElementId = null;

              // Check if completing this layout container unlocks children
              const children = elements.filter((c) => c.parentId === targetEl!.id);
              if (children.length > 0) {
                const childTeams = Array.from(new Set(children.map((c) => c.primaryTeam)));
                for (const ct of childTeams) {
                  spawnCoordinationLink(cursor, ct, targetEl, 'unlock_child');
                }
                onPushEvent({
                  fromTeam: cursor.team,
                  toTeam: childTeams[0],
                  elementLabel: targetEl.label,
                  message: `Frame complete — handed off ${children.length} child nodes to specialist teams`,
                  type: 'handoff',
                });
              } else {
                spawnCoordinationLink(cursor, 'qc', targetEl, 'request_qc');
              }
            }
          }
        }
      }
    };

    const drawScene = () => {
      ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      // 1. Dark laboratory background with subtle tactical grid
      ctx.fillStyle = '#09090B';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      const gridStep = 40;
      for (let gx = 0; gx <= VIRTUAL_WIDTH; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, VIRTUAL_HEIGHT);
        ctx.stroke();
      }
      for (let gy = 0; gy <= VIRTUAL_HEIGHT; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(VIRTUAL_WIDTH, gy);
        ctx.stroke();
      }

      const elements = elementsRef.current;
      const cursors = cursorsRef.current;
      const links = linksRef.current;

      // 2. Render Blueprint Elements
      for (const el of elements) {
        const isSelected = el.id === selectedElementId;
        const teamColor = teams[el.primaryTeam]?.color || '#3B82F6';
        const progressRatio = el.buildProgress / 100;

        ctx.save();

        // Base blueprint ghost slot
        ctx.strokeStyle = isSelected
          ? '#FFFFFF'
          : el.status === 'pending_parent'
          ? 'rgba(255, 255, 255, 0.06)'
          : 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = isSelected ? 2 : 1;
        if (el.status === 'pending_parent' || el.status === 'queued') {
          ctx.setLineDash([4, 4]);
        }
        ctx.strokeRect(el.x, el.y, el.width, el.height);
        ctx.setLineDash([]);

        // Reconstructed portion clipped to progress
        if (el.buildProgress > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(el.x, el.y, el.width * progressRatio, el.height);
          ctx.clip();

          // Surface fill based on category & state
          if (el.category === 'section') {
            ctx.fillStyle = 'rgba(24, 24, 30, 0.82)';
            ctx.fillRect(el.x, el.y, el.width, el.height);
          } else if (el.category === 'container') {
            ctx.fillStyle = 'rgba(34, 34, 44, 0.78)';
            ctx.fillRect(el.x, el.y, el.width, el.height);
          } else if (el.category === 'button') {
            ctx.fillStyle = el.accentColor || '#EF4444';
            ctx.globalAlpha = 0.88;
            ctx.fillRect(el.x, el.y, el.width, el.height);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
            ctx.fillText(el.textSample || el.label, el.x + 14, el.y + el.height / 2 + 4);
          } else if (el.category === 'heading') {
            ctx.fillStyle = '#FFFFFF';
            ctx.font =
              el.height > 40
                ? '700 20px "Outfit", sans-serif'
                : '700 13px "Outfit", sans-serif';
            ctx.fillText(
              el.textSample || el.label.toUpperCase(),
              el.x + 4,
              el.y + Math.min(el.height - 6, 24)
            );
            if (el.height > 45) {
              ctx.fillStyle = 'rgba(255,255,255,0.7)';
              ctx.font = '600 14px "Outfit", sans-serif';
              ctx.fillText('MULTI-AGENT DOM SYNTHESIS', el.x + 4, el.y + 48);
            }
          } else if (el.category === 'paragraph') {
            const lines = el.subLines || 3;
            if (el.textSample && lines === 1) {
              ctx.fillStyle = '#A1A1AA';
              ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
              ctx.fillText(el.textSample, el.x + 4, el.y + 14);
            } else {
              const lineH = Math.max(10, Math.floor((el.height - 8) / lines));
              for (let l = 0; l < lines; l++) {
                const wFactor = l === lines - 1 ? 0.68 : 0.94;
                ctx.fillStyle = l === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.22)';
                ctx.fillRect(el.x + 4, el.y + 6 + l * lineH, (el.width - 8) * wFactor, 6);
              }
            }
          } else if (el.category === 'image') {
            const grad = ctx.createLinearGradient(el.x, el.y, el.x + el.width, el.y + el.height);
            grad.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
            grad.addColorStop(1, 'rgba(59, 130, 246, 0.08)');
            ctx.fillStyle = grad;
            ctx.fillRect(el.x, el.y, el.width, el.height);

            // Draw internal vector waveform / wireframe mesh inside image slot
            ctx.strokeStyle = el.accentColor || '#06B6D4';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            const steps = 16;
            for (let s = 0; s <= steps; s++) {
              const px = el.x + (s / steps) * el.width;
              const py =
                el.y +
                el.height * 0.55 +
                Math.sin(s * 0.8 + frameCountRef.current * 0.03) * (el.height * 0.24);
              if (s === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.stroke();
          } else if (el.category === 'icon') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.fillRect(el.x, el.y, el.width, el.height);
            ctx.strokeStyle = el.accentColor || '#06B6D4';
            ctx.lineWidth = 1.8;
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            const r = Math.min(el.width, el.height) * 0.32;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
          } else if (el.category === 'border') {
            ctx.strokeStyle = el.accentColor || '#FACC15';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(el.x + 2, el.y + 2, el.width - 4, el.height - 4);
          }

          ctx.restore();
        }

        // Status border & overlays
        if (el.status === 'in_progress') {
          ctx.strokeStyle = teamColor;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(el.x, el.y, el.width, el.height);
        } else if (el.status === 'inspecting') {
          ctx.strokeStyle = '#22C55E';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(el.x, el.y, el.width, el.height);
          // QC vertical scanline
          const scanX = el.x + (el.inspectProgress / 100) * el.width;
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(scanX, el.y);
          ctx.lineTo(scanX, el.y + el.height);
          ctx.stroke();
        } else if (el.status === 'flagged_error') {
          // Flagged by Quality Control — waiting for Yellow Error Correction team!
          const pulse = (Math.sin(frameCountRef.current * 0.14) + 1) * 0.5;
          ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + pulse * 0.12})`;
          ctx.fillRect(el.x, el.y, el.width, el.height);
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(el.x, el.y, el.width, el.height);
          ctx.setLineDash([]);

          // Compact error tag
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(el.x + 4, el.y + 4, Math.min(el.width - 8, 128), 16);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.fillText('QC ANOMALY FLAGGED', el.x + 8, el.y + 15);
        } else if (el.status === 'repairing') {
          // Yellow Team actively repairing and redrawing!
          const repRatio = el.repairProgress / 100;
          ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
          ctx.fillRect(el.x, el.y, el.width * repRatio, el.height);
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 2;
          ctx.strokeRect(el.x, el.y, el.width, el.height);

          // Repair calibration laser
          const repX = el.x + repRatio * el.width;
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(repX, el.y);
          ctx.lineTo(repX, el.y + el.height);
          ctx.stroke();

          ctx.fillStyle = '#FACC15';
          ctx.fillRect(el.x + 4, el.y + 4, Math.min(el.width - 8, 136), 16);
          ctx.fillStyle = '#09090B';
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.fillText(`REPAIRING ${Math.round(el.repairProgress)}%`, el.x + 8, el.y + 15);
        } else if (el.status === 'verified') {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 1;
          ctx.strokeRect(el.x, el.y, el.width, el.height);
        }

        // Subtle Handoff Pulse Effect when passed between teams
        if (el.handoffPulse > 0.02) {
          const expand = (1 - el.handoffPulse) * 8;
          ctx.strokeStyle = el.handoffColor;
          ctx.globalAlpha = el.handoffPulse * 0.55;
          ctx.lineWidth = 1.75;
          ctx.strokeRect(
            el.x - expand,
            el.y - expand,
            el.width + expand * 2,
            el.height + expand * 2
          );
          ctx.globalAlpha = 1;
        }

        if (el.priority && el.status !== 'verified') {
          ctx.fillStyle = '#FACC15';
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.fillText('PRIORITY', el.x + el.width - 54, el.y + 12);
        }

        ctx.restore();
      }

      // 3. Render Subtle Team Coordination & Task Handoff Links
      if (showCoordinationLinks && links.length > 0) {
        for (const lnk of links) {
          const fromColor = teams[lnk.fromTeam]?.color || '#3B82F6';
          const toColor = teams[lnk.toTeam]?.color || '#FACC15';
          const fadeAlpha = Math.sin(lnk.progress * Math.PI) * 0.65;

          ctx.save();
          ctx.globalAlpha = Math.max(0.05, fadeAlpha);

          const midX = (lnk.fromX + lnk.toX) / 2;
          const midY = (lnk.fromY + lnk.toY) / 2 - 28;

          const grad = ctx.createLinearGradient(lnk.fromX, lnk.fromY, lnk.toX, lnk.toY);
          grad.addColorStop(0, fromColor);
          grad.addColorStop(1, toColor);

          ctx.strokeStyle = grad;
          ctx.lineWidth = lnk.reason === 'dispatch_repair' ? 2 : 1.35;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(lnk.fromX, lnk.fromY);
          ctx.quadraticCurveTo(midX, midY, lnk.toX, lnk.toY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Traveling signal packet along quadratic curve
          const t = lnk.progress;
          const invT = 1 - t;
          const pktX = invT * invT * lnk.fromX + 2 * invT * t * midX + t * t * lnk.toX;
          const pktY = invT * invT * lnk.fromY + 2 * invT * t * midY + t * t * lnk.toY;

          ctx.fillStyle = toColor;
          ctx.beginPath();
          ctx.arc(pktX, pktY, 3.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      // 4. Render Swarm Cursors
      for (const cursor of cursors) {
        const teamCfg = teams[cursor.team];
        const color = swarmIntelligenceMode
          ? teamCfg?.color || '#3B82F6'
          : classicColor;

        // Motion trail
        if (cursor.trail.length > 1) {
          ctx.save();
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.22;
          ctx.lineWidth = 1.2 * cursorSize;
          ctx.beginPath();
          ctx.moveTo(cursor.trail[0].x, cursor.trail[0].y);
          for (let i = 1; i < cursor.trail.length; i++) {
            ctx.lineTo(cursor.trail[i].x, cursor.trail[i].y);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Draw pointer arrow
        ctx.save();
        ctx.translate(cursor.x, cursor.y);
        ctx.scale(cursorSize, cursorSize);

        // Active work ring for Repairing / Inspecting / Working
        if (cursor.state === 'repairing') {
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(2, 4, 9 + Math.sin(frameCountRef.current * 0.25) * 2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (cursor.state === 'inspecting') {
          ctx.strokeStyle = '#22C55E';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.arc(2, 4, 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = color;
        ctx.strokeStyle = '#09090B';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 13);
        ctx.lineTo(3.6, 9.8);
        ctx.lineTo(6.5, 15);
        ctx.lineTo(8.5, 14);
        ctx.lineTo(5.6, 8.8);
        ctx.lineTo(10, 8.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Distinct badge on Yellow Error Correction cursors
        if (swarmIntelligenceMode && cursor.team === 'error_correction') {
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(8, -2, 6, 6);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(9.5, 1);
          ctx.lineTo(12.5, 1);
          ctx.moveTo(11, -0.5);
          ctx.lineTo(11, 2.5);
          ctx.stroke();
        }

        ctx.restore();
      }
    };

    const loop = () => {
      frameCountRef.current += 1;
      if (isRunning) {
        updateSimulation();
      }
      drawScene();
      if (frameCountRef.current % 6 === 0) {
        onStatsTick();
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    elementsRef,
    cursorsRef,
    linksRef,
    teams,
    isRunning,
    swarmIntelligenceMode,
    showCoordinationLinks,
    cursorSpeed,
    cursorSize,
    classicColor,
    selectedElementId,
    onPushEvent,
    onStatsTick,
  ]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = VIRTUAL_WIDTH / rect.width;
    const scaleY = VIRTUAL_HEIGHT / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Select innermost element containing click point
    const matches = elementsRef.current.filter(
      (el) =>
        clickX >= el.x &&
        clickX <= el.x + el.width &&
        clickY >= el.y &&
        clickY <= el.y + el.height
    );

    if (matches.length > 0) {
      // Pick smallest area match (child element over parent section)
      matches.sort((a, b) => a.width * a.height - b.width * b.height);
      onSelectElement(matches[0].id);
    } else {
      onSelectElement(null);
    }
  };

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-[#09090B]">
      {/* Browser Viewport Chrome Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#121216] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FACC15]" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
          </div>
          <span className="font-mono text-zinc-400 truncate max-w-[260px] sm:max-w-[420px]">
            {targetUrl}
          </span>
        </div>
        <div className="flex items-center gap-3 text-zinc-400">
          <span>Click any blueprint node to inspect or assign</span>
        </div>
      </div>

      {/* Main High-DPI Reconstruction Canvas */}
      <div className="relative aspect-[10/7] w-full bg-[#09090B]">
        <canvas
          ref={canvasRef}
          width={VIRTUAL_WIDTH}
          height={VIRTUAL_HEIGHT}
          onClick={handleCanvasClick}
          className="h-full w-full cursor-crosshair block"
        />
      </div>
    </div>
  );
};
