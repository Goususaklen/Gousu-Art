import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Globe,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Layers,
  Share2,
  Eye,
  ArrowUpRight,
} from 'lucide-react';
import {
  BlueprintElement,
  CoordinationLink,
  ReconstructionPhase,
  SwarmCursor,
  SwarmEventLog,
  TeamConfig,
  TeamId,
} from './types/swarm';
import {
  generateBlueprintForUrl,
  INITIAL_TEAMS,
  WEBSITE_PRESETS,
} from './data/blueprintGenerator';
import { SwarmCanvas } from './components/SwarmCanvas';

const TEAM_ORDER: TeamId[] = [
  'layout',
  'typography',
  'visual',
  'qc',
  'error_correction',
];

function createCursors(count: number): SwarmCursor[] {
  const cursors: SwarmCursor[] = [];
  for (let i = 0; i < count; i++) {
    // Distribute across the 5 specialist teams
    const team = TEAM_ORDER[i % TEAM_ORDER.length];
    const startX = 60 + ((i * 73) % 880);
    const startY = 50 + ((i * 59) % 600);
    cursors.push({
      id: i + 1,
      team,
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      targetX: startX,
      targetY: startY,
      targetElementId: null,
      state: 'idle',
      tasksCompleted: 0,
      repairsCompleted: 0,
      trail: [],
      phaseOffset: i * 0.7,
    });
  }
  return cursors;
}

export default function App() {
  const [urlInput, setUrlInput] = useState<string>('https://linear.app/features');
  const [activeUrl, setActiveUrl] = useState<string>('https://linear.app/features');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [hasStarted, setHasStarted] = useState<boolean>(true);
  const [swarmIntelligenceMode, setSwarmIntelligenceMode] = useState<boolean>(true);
  const [showCoordinationLinks, setShowCoordinationLinks] = useState<boolean>(true);
  const [showSplitReference, setShowSplitReference] = useState<boolean>(false);

  const [cursorCount, setCursorCount] = useState<number>(85);
  const [cursorSpeed, setCursorSpeed] = useState<number>(1.35);
  const [cursorSize, setCursorSize] = useState<number>(1.0);
  const [classicColor, setClassicColor] = useState<string>('#EF4444');

  const [teams, setTeams] = useState<Record<TeamId, TeamConfig>>(INITIAL_TEAMS);
  const [selectedElementId, setSelectedElementId] = useState<string | null>('hdg-hero-main');
  const [taskFilter, setTaskFilter] = useState<'all' | TeamId | 'defects'>('all');
  const [eventLogs, setEventLogs] = useState<SwarmEventLog[]>([]);

  // Mutable refs for 60fps canvas simulation loop
  const elementsRef = useRef<BlueprintElement[]>(
    generateBlueprintForUrl('https://linear.app/features')
  );
  const cursorsRef = useRef<SwarmCursor[]>(createCursors(85));
  const linksRef = useRef<CoordinationLink[]>([]);

  // Snapshot state synced every 6 frames for responsive UI readouts
  const [uiElements, setUiElements] = useState<BlueprintElement[]>(elementsRef.current);
  const [uiCursors, setUiCursors] = useState<SwarmCursor[]>(cursorsRef.current);

  const handlePushEvent = useCallback(
    (evt: Omit<SwarmEventLog, 'id' | 'timestamp'>) => {
      const now = new Date();
      const timestamp = now.toTimeString().split(' ')[0];
      setEventLogs((prev) => [
        {
          ...evt,
          id: `${Date.now()}-${Math.random()}`,
          timestamp,
        },
        ...prev.slice(0, 29),
      ]);
    },
    []
  );

  const handleStatsTick = useCallback(() => {
    setUiElements([...elementsRef.current]);
    setUiCursors([...cursorsRef.current]);
  }, []);

  // Dynamically adjust cursor count while preserving existing cursor stats
  useEffect(() => {
    const current = cursorsRef.current;
    if (cursorCount > current.length) {
      const extra: SwarmCursor[] = [];
      for (let i = current.length; i < cursorCount; i++) {
        const team = TEAM_ORDER[i % TEAM_ORDER.length];
        const x = 80 + ((i * 97) % 840);
        const y = 70 + ((i * 67) % 560);
        extra.push({
          id: i + 1,
          team,
          x,
          y,
          vx: 0,
          vy: 0,
          targetX: x,
          targetY: y,
          targetElementId: null,
          state: 'idle',
          tasksCompleted: 0,
          repairsCompleted: 0,
          trail: [],
          phaseOffset: i * 0.7,
        });
      }
      cursorsRef.current = [...current, ...extra];
    } else if (cursorCount < current.length) {
      cursorsRef.current = current.slice(0, cursorCount);
    }
    setUiCursors([...cursorsRef.current]);
  }, [cursorCount]);

  const reconstructWebsite = (targetUrl: string) => {
    const formatted = targetUrl.trim() || 'https://gousu-swarm.ai';
    setActiveUrl(formatted);
    elementsRef.current = generateBlueprintForUrl(formatted);
    cursorsRef.current = createCursors(cursorCount);
    linksRef.current = [];
    setUiElements([...elementsRef.current]);
    setUiCursors([...cursorsRef.current]);
    setSelectedElementId(elementsRef.current[0]?.id || null);
    setHasStarted(true);
    setIsRunning(true);
    setEventLogs([
      {
        id: `${Date.now()}-init`,
        timestamp: new Date().toTimeString().split(' ')[0],
        fromTeam: 'layout',
        elementLabel: formatted,
        message: `Initialized blueprint matrix (${elementsRef.current.length} DOM nodes queued)`,
        type: 'milestone',
      },
    ]);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reconstructWebsite(urlInput);
  };

  const handleRestart = () => {
    reconstructWebsite(activeUrl);
  };

  const handleToggleTeam = (teamId: TeamId) => {
    setTeams((prev) => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        enabled: !prev[teamId].enabled,
      },
    }));
  };

  // Inject anomalies on several elements so users can test QC + Yellow Error Correction anytime
  const handleInjectFaults = () => {
    const candidates = elementsRef.current.filter(
      (el) => el.status === 'verified' || el.status === 'built_unverified' || el.status === 'in_progress'
    );
    const targets = candidates.length > 0 ? candidates.slice(0, 4) : elementsRef.current.slice(0, 4);

    for (const el of targets) {
      el.hasLatentDefect = true;
      el.defectType = 'Injected structural drift (+6.4px offset)';
      el.buildProgress = 100;
      el.inspectProgress = 100;
      el.repairProgress = 0;
      el.status = 'flagged_error';
      el.handoffPulse = 1.0;
      el.handoffColor = '#FACC15';
      el.assignedCursorId = null;
    }

    handlePushEvent({
      fromTeam: 'qc',
      toTeam: 'error_correction',
      elementLabel: `${targets.length} Blueprint Nodes`,
      message: `Quality Control flagged ${targets.length} corrupted sections — Yellow Error Correction Team deployed`,
      type: 'defect_found',
    });
    setIsRunning(true);
    handleStatsTick();
  };

  const handleReassignElementTeam = (elementId: string, newTeam: TeamId) => {
    const el = elementsRef.current.find((item) => item.id === elementId);
    if (!el) return;
    el.primaryTeam = newTeam;
    el.assignedCursorId = null;
    el.handoffPulse = 1.0;
    el.handoffColor = teams[newTeam].color;
    if (el.status === 'verified') {
      el.status = 'queued';
      el.buildProgress = 0;
      el.inspectProgress = 0;
      el.repairProgress = 0;
    }
    handlePushEvent({
      fromTeam: 'layout',
      toTeam: newTeam,
      elementLabel: el.label,
      message: `Manual task override: assigned node to ${teams[newTeam].name}`,
      type: 'handoff',
    });
    handleStatsTick();
  };

  const handleTogglePriority = (elementId: string) => {
    const el = elementsRef.current.find((item) => item.id === elementId);
    if (!el) return;
    el.priority = !el.priority;
    el.handoffPulse = 0.85;
    el.handoffColor = '#FACC15';
    handleStatsTick();
  };

  const handleFlagElementForRepair = (elementId: string) => {
    const el = elementsRef.current.find((item) => item.id === elementId);
    if (!el) return;
    el.hasLatentDefect = true;
    el.defectType = 'Manual QC Audit Flag — Redraw Required';
    el.buildProgress = 100;
    el.inspectProgress = 100;
    el.repairProgress = 0;
    el.status = 'flagged_error';
    el.assignedCursorId = null;
    el.handoffPulse = 1.0;
    el.handoffColor = '#FACC15';
    handlePushEvent({
      fromTeam: 'qc',
      toTeam: 'error_correction',
      elementLabel: el.label,
      message: `Flagged for Error Correction redraw pass`,
      type: 'defect_found',
    });
    setIsRunning(true);
    handleStatsTick();
  };

  // Compute live statistics from actual simulation state
  const totalElements = uiElements.length;
  const verifiedCount = uiElements.filter((e) => e.status === 'verified').length;
  const flaggedOrRepairingCount = uiElements.filter(
    (e) => e.status === 'flagged_error' || e.status === 'repairing'
  ).length;
  const remainingTasks = totalElements - verifiedCount;

  const overallProgress =
    totalElements > 0
      ? Math.round(
          uiElements.reduce((acc, el) => {
            if (el.status === 'verified') return acc + 100;
            if (el.status === 'repairing') return acc + 85 + el.repairProgress * 0.15;
            if (el.status === 'flagged_error') return acc + 75;
            if (el.status === 'inspecting' || el.status === 'built_unverified')
              return acc + 70 + el.inspectProgress * 0.15;
            return acc + el.buildProgress * 0.7;
          }, 0) / totalElements
        )
      : 0;

  const activeCursorsCount = uiCursors.filter((c) => {
    if (!isRunning) return false;
    if (!swarmIntelligenceMode) return true;
    return teams[c.team]?.enabled;
  }).length;

  const busyCursorsCount = uiCursors.filter((c) => c.state !== 'idle').length;
  const totalRepairsDone = uiCursors.reduce((sum, c) => sum + c.repairsCompleted, 0);

  const enabledTeamsCount = Object.values(teams).filter((t) => t.enabled).length;
  const swarmEfficiency =
    !isRunning || activeCursorsCount === 0
      ? 0
      : verifiedCount === totalElements
      ? 100
      : Math.min(
          99,
          Math.round(
            (busyCursorsCount / Math.max(1, activeCursorsCount)) * 55 +
              (enabledTeamsCount / 5) * 35 +
              Math.min(10, totalRepairsDone * 2)
          )
        );

  const currentPhase: ReconstructionPhase = (() => {
    if (!hasStarted) return 'Standby — Ready to Initialize';
    if (verifiedCount === totalElements && totalElements > 0) {
      return 'Reconstruction Complete — 100% Verified';
    }
    const layoutElements = uiElements.filter((e) => e.primaryTeam === 'layout');
    const layoutBuilt = layoutElements.filter((e) => e.buildProgress >= 100).length;
    if (layoutBuilt < layoutElements.length) {
      return 'Phase 1: Structural Layout Framing';
    }
    const buildersDone = uiElements.filter((e) => e.buildProgress >= 100).length;
    if (buildersDone < totalElements) {
      return 'Phase 2: Visual & Typography Assembly';
    }
    if (flaggedOrRepairingCount > 0) {
      return 'Phase 3: Quality Control & Error Rectification';
    }
    return 'Phase 4: Final Integrity Verification';
  })();

  const selectedElement = uiElements.find((e) => e.id === selectedElementId) || null;

  const filteredElements = uiElements.filter((el) => {
    if (taskFilter === 'all') return true;
    if (taskFilter === 'defects') {
      return (
        el.status === 'flagged_error' ||
        el.status === 'repairing' ||
        el.hasLatentDefect
      );
    }
    if (taskFilter === 'qc') {
      return el.status === 'built_unverified' || el.status === 'inspecting';
    }
    if (taskFilter === 'error_correction') {
      return el.status === 'flagged_error' || el.status === 'repairing';
    }
    return el.primaryTeam === taskFilter;
  });

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col">
      {/* Top Bar Contract: 3 Clean Zones (Brand Wordmark — 4 Nav Links — 1 Primary Action) */}
      <header className="flex items-center justify-between gap-8 border-b border-zinc-800 bg-[#09090B] px-6 py-4">
        <a
          href="#viewport"
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          GOUSU SWARM
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400">
          <a
            href="#viewport"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Viewport
          </a>
          <a
            href="#swarm-teams"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Swarm Teams
          </a>
          <a
            href="#task-queue"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Task Queue
          </a>
          <a
            href="#coordination-log"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Coordination Log
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            onClick={() => setIsRunning((prev) => !prev)}
            className="px-4 py-2 text-xs font-semibold bg-[#EF4444] text-white rounded-md hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isRunning ? 'Pause Swarm' : 'Resume Swarm'}
          </button>
        </div>
      </header>

      {/* Main Content Container (1440px Desktop Presence) */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6 py-6 space-y-6">
        {/* Top Command Strip: URL Reconstruction Bar + Simulation Controls */}
        <section
          id="viewport"
          className="rounded-lg border border-zinc-800 bg-[#121216] p-5 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="text-[#EF4444] font-semibold">
                  Multi-Cursor Website Reconstruction Lab
                </span>
                <span aria-hidden="true">·</span>
                <span>{currentPhase}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#FACC15]">
                  {overallProgress}% Complete
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Coordinated Swarm Intelligence Reconstruction
              </h1>
            </div>

            {/* URL Input Form */}
            <form
              onSubmit={handleUrlSubmit}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto"
            >
              <div className="relative flex-1 sm:w-80">
                <Globe className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Enter website URL (e.g. https://stripe.com)"
                  aria-label="Website URL to reconstruct"
                  className="w-full rounded-md border border-zinc-700 bg-[#09090B] pl-10 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#FACC15] focus:outline-none font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-white text-[#09090B] rounded-md hover:bg-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reconstruct URL
              </button>
            </form>
          </div>

          {/* Preset Target Blueprints & Mode Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-800/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-400 mr-1">Target Blueprints:</span>
              {WEBSITE_PRESETS.map((preset) => {
                const active = activeUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setUrlInput(preset.url);
                      reconstructWebsite(preset.url);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#EF4444] text-white'
                        : 'bg-[#09090B] text-zinc-300 border border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>

            {/* Playback & Mode Switches */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setHasStarted(true);
                  setIsRunning(true);
                }}
                disabled={isRunning}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isRunning
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-[#EF4444] text-white hover:bg-red-500'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                {hasStarted ? 'Resume' : 'Start'}
              </button>

              <button
                type="button"
                onClick={() => setIsRunning(false)}
                disabled={!isRunning}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !isRunning
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                }`}
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-800 text-white rounded-md hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart
              </button>

              <button
                type="button"
                onClick={handleInjectFaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#FACC15] text-[#09090B] rounded-md hover:bg-yellow-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                Simulate QC Faults
              </button>

              <button
                type="button"
                onClick={() => setShowSplitReference((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showSplitReference
                    ? 'border-[#FACC15] bg-[#FACC15]/10 text-[#FACC15]'
                    : 'border-zinc-700 bg-[#09090B] text-zinc-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {showSplitReference ? 'Hide URL Preview' : 'URL Preview Split'}
              </button>
            </div>
          </div>
        </section>

        {/* Live Intelligence KPI Strip (Black / Red / White / Yellow Theme) */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-lg border border-zinc-800 bg-[#121216] p-4">
            <div className="text-xs text-zinc-400">Active Agents</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold text-white tabular-nums">
                {activeCursorsCount}
              </span>
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                / {cursorCount} total
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#121216] p-4">
            <div className="text-xs text-zinc-400">Completed Nodes</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold text-white tabular-nums">
                {verifiedCount}
              </span>
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                / {totalElements} verified
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#121216] p-4">
            <div className="text-xs text-zinc-400">Remaining Tasks</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold text-[#EF4444] tabular-nums">
                {remainingTasks}
              </span>
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                in queue
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#121216] p-4">
            <div className="text-xs text-zinc-400">Errors Rectified</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold text-[#FACC15] tabular-nums">
                {totalRepairsDone}
              </span>
              <span className="font-mono text-xs text-[#FACC15] tabular-nums">
                {flaggedOrRepairingCount} active
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#121216] p-4">
            <div className="text-xs text-zinc-400">Swarm Efficiency</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold text-white tabular-nums">
                {swarmEfficiency}%
              </span>
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                {cursorSpeed.toFixed(2)}x speed
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#121216] p-4">
            <div className="text-xs text-zinc-400">Reconstruction</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold text-[#FACC15] tabular-nums">
                {overallProgress}%
              </span>
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                integrity
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-[#EF4444] transition-all duration-150"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </section>

        {/* Main Workspace Split: Left 8 Columns Canvas + Right 4 Columns Swarm Controls & Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Multi-Cursor Reconstruction Viewport (+ Optional URL Reference Split) */}
          <div className="lg:col-span-8 space-y-4">
            <SwarmCanvas
              elementsRef={elementsRef}
              cursorsRef={cursorsRef}
              linksRef={linksRef}
              teams={teams}
              isRunning={isRunning}
              swarmIntelligenceMode={swarmIntelligenceMode}
              showCoordinationLinks={showCoordinationLinks}
              cursorSpeed={cursorSpeed}
              cursorSize={cursorSize}
              classicColor={classicColor}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onPushEvent={handlePushEvent}
              onStatsTick={handleStatsTick}
              targetUrl={activeUrl}
            />

            {/* Optional Website Preview Reference Frame + Explicit Algorithmic Transparency Banner */}
            {showSplitReference && (
              <div className="rounded-lg border border-zinc-800 bg-[#121216] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Target Website Reference Frame ({activeUrl})
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Note: The canvas above performs an algorithmic DOM blueprint reconstruction, not a static screenshot clone. External websites with X-Frame-Options policies may block embedded iframes below.
                    </p>
                  </div>
                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#FACC15] hover:underline whitespace-nowrap shrink-0"
                  >
                    Open Source URL
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="h-64 w-full overflow-hidden rounded border border-zinc-800 bg-[#09090B]">
                  <iframe
                    src={activeUrl}
                    title={`Preview of ${activeUrl}`}
                    className="h-full w-full border-0"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </div>
            )}

            {/* Selected Blueprint Node Inspector & Direct Task Assignment */}
            {selectedElement && (
              <div className="rounded-lg border border-zinc-800 bg-[#121216] p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span className="font-mono text-white font-semibold">
                        {selectedElement.label}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Category: {selectedElement.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Status: {selectedElement.status.replace('_', ' ')}</span>
                      {selectedElement.hasLatentDefect && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#FACC15] font-semibold">
                            Defect: {selectedElement.defectType || 'Flagged for Yellow Team'}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-zinc-300">
                      <span>Build: {Math.round(selectedElement.buildProgress)}%</span>
                      <span>QC Audit: {Math.round(selectedElement.inspectProgress)}%</span>
                      <span className="text-[#FACC15]">
                        Repair Pass: {Math.round(selectedElement.repairProgress)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePriority(selectedElement.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedElement.priority
                          ? 'border-[#FACC15] bg-[#FACC15] text-[#09090B]'
                          : 'border-zinc-700 bg-[#09090B] text-white hover:border-zinc-500'
                      }`}
                    >
                      {selectedElement.priority ? 'Priority Active' : 'Prioritize Task'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFlagElementForRepair(selectedElement.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#EF4444] text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Flag Error for Yellow Team
                    </button>
                  </div>
                </div>

                {/* Team Task Reassignment Row */}
                <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-zinc-400">
                    Assign Primary Engineering Team:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['layout', 'typography', 'visual'] as TeamId[]).map((tid) => {
                      const t = teams[tid];
                      const isAssigned = selectedElement.primaryTeam === tid;
                      return (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => handleReassignElementTeam(selectedElement.id, tid)}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isAssigned
                              ? 'bg-white text-[#09090B] font-semibold'
                              : 'bg-[#09090B] text-zinc-400 border border-zinc-800 hover:text-white'
                          }`}
                        >
                          {t.name} ({t.roleTitle.split(' ')[0]})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Swarm Intelligence Control Panel & Cursor Parameters */}
          <div className="lg:col-span-4 space-y-5">
            {/* Swarm Mode & Coordination Controls */}
            <div className="rounded-lg border border-zinc-800 bg-[#121216] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#EF4444]" />
                  <h2 className="font-display text-base font-bold text-white">
                    Swarm Parameters
                  </h2>
                </div>
                <span className="font-mono text-xs text-[#FACC15]">
                  {swarmIntelligenceMode ? '5-TEAM MODE' : 'UNIFIED MODE'}
                </span>
              </div>

              {/* Swarm Intelligence Mode Toggle */}
              <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-[#09090B] p-3">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Swarm Intelligence Mode
                  </div>
                  <div className="text-xs text-zinc-400">
                    Specialized teams + QC & Yellow Error Correction
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSwarmIntelligenceMode((prev) => !prev)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    swarmIntelligenceMode
                      ? 'bg-[#EF4444] text-white'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {swarmIntelligenceMode ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Team Coordination Visuals Toggle */}
              <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-[#09090B] p-3">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Coordination Handoff Links
                  </div>
                  <div className="text-xs text-zinc-400">
                    Subtle signal lines & element handoff pulses
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCoordinationLinks((prev) => !prev)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    showCoordinationLinks
                      ? 'bg-[#FACC15] text-[#09090B]'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {showCoordinationLinks ? 'Active' : 'Muted'}
                </button>
              </div>

              {/* Sliders: Cursor Count, Speed, Size */}
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Swarm Cursor Count</span>
                    <span className="font-mono text-white tabular-nums">
                      {cursorCount} cursors
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={250}
                    step={5}
                    value={cursorCount}
                    onChange={(e) => setCursorCount(Number(e.target.value))}
                    className="w-full accent-[#EF4444] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Animation Speed</span>
                    <span className="font-mono text-white tabular-nums">
                      {cursorSpeed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={3.5}
                    step={0.25}
                    value={cursorSpeed}
                    onChange={(e) => setCursorSpeed(Number(e.target.value))}
                    className="w-full accent-[#FACC15] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Cursor Scale</span>
                    <span className="font-mono text-white tabular-nums">
                      {cursorSize.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.7}
                    max={1.8}
                    step={0.1}
                    value={cursorSize}
                    onChange={(e) => setCursorSize(Number(e.target.value))}
                    className="w-full accent-white cursor-pointer"
                  />
                </div>

                {!swarmIntelligenceMode && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-zinc-300">Unified Cursor Color</span>
                    <div className="flex items-center gap-2">
                      {['#EF4444', '#FACC15', '#FFFFFF', '#3B82F6', '#22C55E'].map(
                        (col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setClassicColor(col)}
                            aria-label={`Select cursor color ${col}`}
                            className={`w-5 h-5 rounded-full border cursor-pointer ${
                              classicColor === col
                                ? 'border-white scale-110'
                                : 'border-zinc-700'
                            }`}
                            style={{ backgroundColor: col }}
                          />
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Coordination & Error Rectification Feed */}
            <div
              id="coordination-log"
              className="rounded-lg border border-zinc-800 bg-[#121216] p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-[#FACC15]" />
                  <h2 className="font-display text-base font-bold text-white">
                    Team Handoff & QC Stream
                  </h2>
                </div>
                <span className="font-mono text-xs text-zinc-400 tabular-nums">
                  {eventLogs.length} events
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {eventLogs.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">
                    Waiting for initial layout frame completion...
                  </p>
                ) : (
                  eventLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded border border-zinc-800/90 bg-[#09090B] p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-zinc-400 font-mono">
                        <span
                          style={{ color: teams[log.fromTeam]?.color || '#FFFFFF' }}
                          className="font-semibold"
                        >
                          {teams[log.fromTeam]?.name}
                          {log.toTeam ? ` → ${teams[log.toTeam]?.name}` : ''}
                        </span>
                        <span>{log.timestamp}</span>
                      </div>
                      <div className="text-white font-medium">{log.elementLabel}</div>
                      <div className="text-zinc-400">{log.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Specialized Cursor Teams Activity & Control Grid (All 5 Teams including Yellow Error Correction) */}
        <section id="swarm-teams" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Specialized Swarm Intelligence Teams
              </h2>
              <p className="text-sm text-zinc-400">
                Enable or disable individual divisions in real time. Quality Control (Green) inspects built sections and dispatches Error Correction (Yellow) to repair and redraw defective nodes.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
              <span>Active Divisions: {enabledTeamsCount} / 5</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {TEAM_ORDER.map((teamId) => {
              const team = teams[teamId];
              const teamCursors = uiCursors.filter((c) => c.team === teamId);
              const workingCount = teamCursors.filter((c) => c.state !== 'idle').length;
              const completedByTeam = teamCursors.reduce(
                (acc, c) => acc + c.tasksCompleted,
                0
              );

              return (
                <div
                  key={team.id}
                  className={`rounded-lg border p-4 flex flex-col justify-between transition-opacity ${
                    team.enabled
                      ? 'border-zinc-800 bg-[#121216]'
                      : 'border-zinc-900 bg-[#09090B] opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div
                          className="font-mono text-xs font-bold"
                          style={{ color: team.color }}
                        >
                          {team.name}
                        </div>
                        <h3 className="font-display text-base font-bold text-white mt-0.5">
                          {team.roleTitle}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleTeam(team.id)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          team.enabled
                            ? 'bg-white text-[#09090B]'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {team.enabled ? 'Active' : 'Disabled'}
                      </button>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {team.description}
                    </p>

                    <div className="space-y-1 pt-1 border-t border-zinc-800/80 text-xs text-zinc-300">
                      {team.tasksDescription.map((desc, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-zinc-500">·</span>
                          <span>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2 font-mono text-xs">
                    <div>
                      <div className="text-zinc-500">Agents Busy</div>
                      <div className="text-white font-semibold tabular-nums">
                        {team.enabled ? workingCount : 0} / {teamCursors.length}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500">Tasks Done</div>
                      <div
                        className="font-semibold tabular-nums"
                        style={{ color: team.color }}
                      >
                        {completedByTeam}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Interactive Blueprint Task Assignment & Error Queue Table */}
        <section
          id="task-queue"
          className="rounded-lg border border-zinc-800 bg-[#121216] p-5 space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#EF4444]" />
              <h2 className="font-display text-lg font-bold text-white">
                DOM Blueprint Task Assignment & Error Rectification Queue
              </h2>
            </div>

            {/* Interactive Filter Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Nodes' },
                  { id: 'defects', label: 'QC Flagged / Defects' },
                  { id: 'layout', label: 'Blue (Layout)' },
                  { id: 'typography', label: 'Purple (Type)' },
                  { id: 'visual', label: 'Cyan (Visual)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTaskFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    taskFilter === tab.id
                      ? 'bg-[#EF4444] text-white'
                      : 'bg-[#09090B] text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="py-2.5 px-3 font-medium">Blueprint Node</th>
                  <th className="py-2.5 px-3 font-medium">Assigned Team</th>
                  <th className="py-2.5 px-3 font-medium">Pipeline Status</th>
                  <th className="py-2.5 px-3 font-medium text-right">Build %</th>
                  <th className="py-2.5 px-3 font-medium text-right">QC Scan %</th>
                  <th className="py-2.5 px-3 font-medium text-right">Yellow Repair %</th>
                  <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 font-mono">
                {filteredElements.map((el) => {
                  const team = teams[el.primaryTeam];
                  const isSelected = el.id === selectedElementId;
                  return (
                    <tr
                      key={el.id}
                      onClick={() => setSelectedElementId(el.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-zinc-800/70' : 'hover:bg-zinc-900/60'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-sans font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{el.label}</span>
                          {el.priority && (
                            <span className="text-[#FACC15] font-mono text-[10px]">
                              [PRIORITY]
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span style={{ color: team.color }} className="font-semibold">
                          {team.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {el.status === 'flagged_error' || el.status === 'repairing' ? (
                          <span className="inline-flex items-center gap-1 text-[#FACC15] font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
                            {el.status === 'repairing'
                              ? 'Yellow Team Repairing'
                              : 'Flagged by QC'}
                          </span>
                        ) : el.status === 'verified' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verified
                          </span>
                        ) : (
                          <span className="text-zinc-300">
                            {el.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-zinc-200">
                        {Math.round(el.buildProgress)}%
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-zinc-200">
                        {Math.round(el.inspectProgress)}%
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#FACC15]">
                        {el.repairProgress > 0 || el.hasLatentDefect
                          ? `${Math.round(el.repairProgress)}%`
                          : '—'}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right font-sans"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleFlagElementForRepair(el.id)}
                          className="px-2.5 py-1 text-xs font-medium rounded bg-zinc-800 text-[#FACC15] hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Trigger Repair
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-zinc-800 bg-[#09090B] px-6 py-4 text-xs text-zinc-500">
        <div className="mx-auto max-w-[1440px] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            GOUSU SWARM — Multi-Cursor Website Reconstruction & Swarm Intelligence Simulation
          </span>
          <span>
            Algorithmic DOM Blueprint Engine · 5 Specialist Cursor Divisions
          </span>
        </div>
      </footer>
    </div>
  );
}
