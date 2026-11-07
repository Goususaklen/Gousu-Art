import { BlueprintElement, TeamConfig, TeamId } from '../types/swarm';

export const INITIAL_TEAMS: Record<TeamId, TeamConfig> = {
  layout: {
    id: 'layout',
    name: 'BLUE TEAM',
    roleTitle: 'Layout Engineers',
    color: '#3B82F6',
    secondaryColor: '#93C5FD',
    description: 'Constructs core DOM sections, structural containers, grid columns, and responsive page boundaries.',
    tasksDescription: [
      'Draw website sections',
      'Create containers and columns',
      'Establish page structure',
    ],
    enabled: true,
  },
  typography: {
    id: 'typography',
    name: 'PURPLE TEAM',
    roleTitle: 'Typography Engineers',
    color: '#A855F7',
    secondaryColor: '#D8B4FE',
    description: 'Synthesizes display headings, multi-line body copy blocks, interactive CTA buttons, and navigation labels.',
    tasksDescription: [
      'Reconstruct headings',
      'Draw paragraphs and text blocks',
      'Recreate buttons and labels',
    ],
    enabled: true,
  },
  visual: {
    id: 'visual',
    name: 'CYAN TEAM',
    roleTitle: 'Visual Engineers',
    color: '#06B6D4',
    secondaryColor: '#67E8F9',
    description: 'Renders hero media viewports, vector icons, decorative surface meshes, and border outlines.',
    tasksDescription: [
      'Reconstruct image placeholders',
      'Draw icons and visual elements',
      'Recreate borders and backgrounds',
    ],
    enabled: true,
  },
  qc: {
    id: 'qc',
    name: 'GREEN TEAM',
    roleTitle: 'Quality Control',
    color: '#22C55E',
    secondaryColor: '#86EFAC',
    description: 'Audits completed DOM nodes, verifies alignment tolerances, and flags corrupted or incomplete areas for repair.',
    tasksDescription: [
      'Inspect completed sections',
      'Identify missing elements',
      'Mark unfinished areas',
    ],
    enabled: true,
  },
  error_correction: {
    id: 'error_correction',
    name: 'YELLOW TEAM',
    roleTitle: 'Error Correction',
    color: '#FACC15',
    secondaryColor: '#FEF08A',
    description: 'Intercepts defects flagged by Quality Control, recalibrates geometry drift, and redraws damaged nodes.',
    tasksDescription: [
      'Intercept QC anomaly flags',
      'Repair corrupted DOM geometry',
      'Redraw incomplete sections',
    ],
    enabled: true,
  },
};

export interface WebsitePreset {
  id: string;
  name: string;
  url: string;
  archetype: 'saas' | 'dashboard' | 'editorial' | 'commerce';
  tagline: string;
}

export const WEBSITE_PRESETS: WebsitePreset[] = [
  {
    id: 'linear',
    name: 'Linear — Product Command',
    url: 'https://linear.app/features',
    archetype: 'saas',
    tagline: 'High-density issue tracking & roadmap engineering interface',
  },
  {
    id: 'stripe',
    name: 'Stripe — Financial Infrastructure',
    url: 'https://stripe.com/enterprise',
    archetype: 'commerce',
    tagline: 'Global payments API suite, live transaction ledger, and checkout mesh',
  },
  {
    id: 'vercel',
    name: 'Vercel — Edge Cloud Console',
    url: 'https://vercel.com/dashboard',
    archetype: 'dashboard',
    tagline: 'Serverless deployment topology, edge telemetry, and build analytics',
  },
  {
    id: 'verge',
    name: 'Chronicle — Tech Broadsheet',
    url: 'https://chronicle-tech.io/ai-swarm',
    archetype: 'editorial',
    tagline: 'Multi-column editorial layout, feature photography, and story feeds',
  },
];

const DEFECT_TYPES = [
  'Sub-pixel bounding box drift (+4.2px)',
  'Incomplete glyph baseline raster',
  'Broken aspect-ratio container clip',
  'Missing border-radius token alignment',
  'Unclosed flexbox child wrapper',
  'Corrupted SVG viewport matrix',
];

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Generates a structured, dependency-linked webpage blueprint (normalized 1000x700 coordinate space)
 * tailored to the input URL and archetype.
 */
export function generateBlueprintForUrl(
  urlInput: string,
  defectProbability = 0.28
): BlueprintElement[] {
  const cleanUrl = urlInput.trim() || 'https://gousu-swarm.ai';
  let domain = cleanUrl.replace(/^https?:\/\//i, '').split('/')[0] || 'gousu-swarm.ai';
  domain = domain.toUpperCase();

  const seed = hashString(cleanUrl);
  const rand = (idx: number) => {
    const x = Math.sin(seed + idx * 97.13) * 10000;
    return x - Math.floor(x);
  };

  const preset = WEBSITE_PRESETS.find(
    (p) => cleanUrl.toLowerCase().includes(p.id) || p.url.toLowerCase() === cleanUrl.toLowerCase()
  );
  const archetype =
    preset?.archetype ||
    (['saas', 'dashboard', 'editorial', 'commerce'][seed % 4] as WebsitePreset['archetype']);

  const rawElements: Omit<
    BlueprintElement,
    | 'status'
    | 'buildProgress'
    | 'inspectProgress'
    | 'repairProgress'
    | 'hasLatentDefect'
    | 'defectType'
    | 'assignedCursorId'
    | 'handoffPulse'
    | 'handoffColor'
    | 'priority'
  >[] = [];

  // 1. TOP NAVIGATION BAR (Parent Section)
  rawElements.push({
    id: 'sec-nav',
    label: 'Header Navigation Bar',
    category: 'section',
    primaryTeam: 'layout',
    parentId: null,
    x: 24,
    y: 20,
    width: 952,
    height: 56,
  });

  rawElements.push({
    id: 'ico-brand',
    label: `${domain} Brand Mark`,
    category: 'icon',
    primaryTeam: 'visual',
    parentId: 'sec-nav',
    x: 42,
    y: 34,
    width: 32,
    height: 28,
    accentColor: '#EF4444',
  });

  rawElements.push({
    id: 'hdg-brand',
    label: `${domain} Wordmark`,
    category: 'heading',
    primaryTeam: 'typography',
    parentId: 'sec-nav',
    x: 84,
    y: 36,
    width: 150,
    height: 24,
    textSample: domain.slice(0, 16),
  });

  rawElements.push({
    id: 'txt-nav-links',
    label: 'Primary Navigation Links',
    category: 'paragraph',
    primaryTeam: 'typography',
    parentId: 'sec-nav',
    x: 340,
    y: 38,
    width: 310,
    height: 20,
    textSample: 'Platform   Architecture   Telemetry   Docs',
    subLines: 1,
  });

  rawElements.push({
    id: 'btn-nav-cta',
    label: 'Header Launch Action',
    category: 'button',
    primaryTeam: 'typography',
    parentId: 'sec-nav',
    x: 830,
    y: 32,
    width: 128,
    height: 32,
    textSample: 'Deploy Node',
    accentColor: '#EF4444',
  });

  if (archetype === 'dashboard') {
    // SIDEBAR + TELEMETRY GRID + MAIN CHART + LOG TABLE
    rawElements.push({
      id: 'sec-sidebar',
      label: 'Command Sidebar Container',
      category: 'section',
      primaryTeam: 'layout',
      parentId: null,
      x: 24,
      y: 92,
      width: 200,
      height: 584,
    });

    rawElements.push({
      id: 'hdg-side-title',
      label: 'Workspace Selector Heading',
      category: 'heading',
      primaryTeam: 'typography',
      parentId: 'sec-sidebar',
      x: 40,
      y: 112,
      width: 168,
      height: 24,
      textSample: 'CLUSTER NODES',
    });

    rawElements.push({
      id: 'txt-side-menu',
      label: 'Navigation Tree Items',
      category: 'paragraph',
      primaryTeam: 'typography',
      parentId: 'sec-sidebar',
      x: 40,
      y: 152,
      width: 168,
      height: 190,
      subLines: 6,
    });

    rawElements.push({
      id: 'img-side-status',
      label: 'Topology Mini-Map',
      category: 'image',
      primaryTeam: 'visual',
      parentId: 'sec-sidebar',
      x: 40,
      y: 366,
      width: 168,
      height: 140,
      accentColor: '#06B6D4',
    });

    rawElements.push({
      id: 'btn-side-action',
      label: 'Sync Cluster Action',
      category: 'button',
      primaryTeam: 'typography',
      parentId: 'sec-sidebar',
      x: 40,
      y: 616,
      width: 168,
      height: 38,
      textSample: 'Run Diagnostics',
      accentColor: '#FACC15',
    });

    // KPI Row
    rawElements.push({
      id: 'sec-kpi-row',
      label: 'Telemetry KPI Strip',
      category: 'section',
      primaryTeam: 'layout',
      parentId: null,
      x: 240,
      y: 92,
      width: 736,
      height: 120,
    });

    for (let i = 0; i < 3; i++) {
      const kx = 256 + i * 240;
      const cid = `cnt-kpi-${i + 1}`;
      rawElements.push({
        id: cid,
        label: `Metric Card 0${i + 1}`,
        category: 'container',
        primaryTeam: 'layout',
        parentId: 'sec-kpi-row',
        x: kx,
        y: 106,
        width: 224,
        height: 92,
      });
      rawElements.push({
        id: `hdg-kpi-${i + 1}`,
        label: `KPI Value Readout 0${i + 1}`,
        category: 'heading',
        primaryTeam: 'typography',
        parentId: cid,
        x: kx + 14,
        y: 120,
        width: 130,
        height: 30,
        textSample: ['99.98% SLA', '1.42ms RTT', '42.8K RPS'][i],
      });
      rawElements.push({
        id: `ico-kpi-${i + 1}`,
        label: `KPI Sparkline Graphic 0${i + 1}`,
        category: 'icon',
        primaryTeam: 'visual',
        parentId: cid,
        x: kx + 154,
        y: 122,
        width: 54,
        height: 54,
        accentColor: ['#22C55E', '#06B6D4', '#FACC15'][i],
      });
    }

    // Main Analytics Viewport
    rawElements.push({
      id: 'sec-chart',
      label: 'Primary Telemetry Canvas Section',
      category: 'section',
      primaryTeam: 'layout',
      parentId: null,
      x: 240,
      y: 228,
      width: 736,
      height: 248,
    });

    rawElements.push({
      id: 'hdg-chart',
      label: 'Throughput Waveform Header',
      category: 'heading',
      primaryTeam: 'typography',
      parentId: 'sec-chart',
      x: 260,
      y: 246,
      width: 340,
      height: 26,
      textSample: 'REAL-TIME SWARM THROUGHPUT',
    });

    rawElements.push({
      id: 'img-chart-wave',
      label: 'Multi-Channel Oscilloscope Graph',
      category: 'image',
      primaryTeam: 'visual',
      parentId: 'sec-chart',
      x: 260,
      y: 284,
      width: 696,
      height: 172,
      accentColor: '#3B82F6',
    });

    // Bottom Data Grid
    rawElements.push({
      id: 'sec-table',
      label: 'Event Stream Table Section',
      category: 'section',
      primaryTeam: 'layout',
      parentId: null,
      x: 240,
      y: 492,
      width: 736,
      height: 184,
    });

    rawElements.push({
      id: 'txt-table-rows',
      label: 'Tabular Node Audit Rows',
      category: 'paragraph',
      primaryTeam: 'typography',
      parentId: 'sec-table',
      x: 260,
      y: 514,
      width: 480,
      height: 142,
      subLines: 5,
    });

    rawElements.push({
      id: 'brd-table-status',
      label: 'Security Verification Seal',
      category: 'border',
      primaryTeam: 'visual',
      parentId: 'sec-table',
      x: 760,
      y: 514,
      width: 196,
      height: 142,
      accentColor: '#EF4444',
    });
  } else {
    // HERO SPLIT + FEATURE BENTO GRID + CTA FOOTER
    rawElements.push({
      id: 'sec-hero',
      label: 'Hero Showcase Section',
      category: 'section',
      primaryTeam: 'layout',
      parentId: null,
      x: 24,
      y: 92,
      width: 952,
      height: 256,
    });

    rawElements.push({
      id: 'cnt-hero-copy',
      label: 'Hero Copy Column',
      category: 'container',
      primaryTeam: 'layout',
      parentId: 'sec-hero',
      x: 42,
      y: 110,
      width: 470,
      height: 220,
    });

    rawElements.push({
      id: 'hdg-hero-main',
      label: 'Hero Display Headline',
      category: 'heading',
      primaryTeam: 'typography',
      parentId: 'cnt-hero-copy',
      x: 58,
      y: 126,
      width: 430,
      height: 64,
      textSample: `${domain} ARCHITECTURE`,
    });

    rawElements.push({
      id: 'txt-hero-lead',
      label: 'Hero Lead Paragraph',
      category: 'paragraph',
      primaryTeam: 'typography',
      parentId: 'cnt-hero-copy',
      x: 58,
      y: 202,
      width: 410,
      height: 56,
      subLines: 3,
    });

    rawElements.push({
      id: 'btn-hero-primary',
      label: 'Primary Hero CTA Button',
      category: 'button',
      primaryTeam: 'typography',
      parentId: 'cnt-hero-copy',
      x: 58,
      y: 274,
      width: 164,
      height: 40,
      textSample: 'Start Simulation',
      accentColor: '#EF4444',
    });

    rawElements.push({
      id: 'btn-hero-secondary',
      label: 'Secondary Spec Button',
      category: 'button',
      primaryTeam: 'typography',
      parentId: 'cnt-hero-copy',
      x: 238,
      y: 274,
      width: 150,
      height: 40,
      textSample: 'View Blueprint',
      accentColor: '#3B82F6',
    });

    rawElements.push({
      id: 'cnt-hero-media',
      label: 'Hero Visual Showcase Frame',
      category: 'container',
      primaryTeam: 'layout',
      parentId: 'sec-hero',
      x: 530,
      y: 110,
      width: 426,
      height: 220,
    });

    rawElements.push({
      id: 'img-hero-render',
      label: 'Interactive 3D Wireframe Viewport',
      category: 'image',
      primaryTeam: 'visual',
      parentId: 'cnt-hero-media',
      x: 546,
      y: 126,
      width: 394,
      height: 188,
      accentColor: '#06B6D4',
    });

    // Feature Grid Section
    rawElements.push({
      id: 'sec-features',
      label: 'Bento Capabilities Section',
      category: 'section',
      primaryTeam: 'layout',
      parentId: null,
      x: 24,
      y: 364,
      width: 952,
      height: 212,
    });

    const cardTitles = [
      'Autonomous Layout Mesh',
      'Vector Glyph Synthesis',
      'Zero-Drift Verification',
    ];
    for (let i = 0; i < 3; i++) {
      const cx = 42 + i * 310;
      const cardId = `cnt-feat-${i + 1}`;
      rawElements.push({
        id: cardId,
        label: `Feature Module Card 0${i + 1}`,
        category: 'container',
        primaryTeam: 'layout',
        parentId: 'sec-features',
        x: cx,
        y: 382,
        width: 294,
        height: 176,
      });

      rawElements.push({
        id: `ico-feat-${i + 1}`,
        label: `Feature Vector Emblem 0${i + 1}`,
        category: 'icon',
        primaryTeam: 'visual',
        parentId: cardId,
        x: cx + 18,
        y: 398,
        width: 44,
        height: 44,
        accentColor: ['#3B82F6', '#A855F7', '#FACC15'][i],
      });

      rawElements.push({
        id: `hdg-feat-${i + 1}`,
        label: `Feature Heading 0${i + 1}`,
        category: 'heading',
        primaryTeam: 'typography',
        parentId: cardId,
        x: cx + 74,
        y: 404,
        width: 200,
        height: 28,
        textSample: cardTitles[i],
      });

      rawElements.push({
        id: `txt-feat-${i + 1}`,
        label: `Feature Specification Copy 0${i + 1}`,
        category: 'paragraph',
        primaryTeam: 'typography',
        parentId: cardId,
        x: cx + 18,
        y: 456,
        width: 258,
        height: 84,
        subLines: 4,
      });
    }

    // Bottom Conversion Strip
    rawElements.push({
      id: 'sec-footer',
      label: 'Bottom Conversion & Telemetry Bar',
      category: 'section',
      primaryTeam: 'layout',
      parentId: null,
      x: 24,
      y: 592,
      width: 952,
      height: 84,
    });

    rawElements.push({
      id: 'brd-footer-glow',
      label: 'Accent Structural Frame',
      category: 'border',
      primaryTeam: 'visual',
      parentId: 'sec-footer',
      x: 40,
      y: 606,
      width: 920,
      height: 56,
      accentColor: '#FACC15',
    });

    rawElements.push({
      id: 'hdg-footer-cta',
      label: 'Footer Callout Headline',
      category: 'heading',
      primaryTeam: 'typography',
      parentId: 'sec-footer',
      x: 62,
      y: 620,
      width: 460,
      height: 28,
      textSample: 'READY FOR MULTI-AGENT RECONSTRUCTION',
    });

    rawElements.push({
      id: 'btn-footer-launch',
      label: 'Footer Export Blueprint Action',
      category: 'button',
      primaryTeam: 'typography',
      parentId: 'sec-footer',
      x: 770,
      y: 616,
      width: 170,
      height: 36,
      textSample: 'Verify Integrity',
      accentColor: '#22C55E',
    });
  }

  return rawElements.map((el, index) => {
    const r = rand(index + 1);
    // Guarantee at least 4 latent defects across the blueprint so the Yellow Error Correction team always has real work to showcase
    const forcedDefect = index === 4 || index === 9 || index === 14 || index === 19;
    const hasLatentDefect = forcedDefect || r < defectProbability;
    const defectType = hasLatentDefect
      ? DEFECT_TYPES[(seed + index) % DEFECT_TYPES.length]
      : undefined;

    return {
      ...el,
      status: el.parentId === null ? 'queued' : 'pending_parent',
      buildProgress: 0,
      inspectProgress: 0,
      repairProgress: 0,
      hasLatentDefect,
      defectType,
      assignedCursorId: null,
      handoffPulse: 0,
      handoffColor: '#3B82F6',
      priority: false,
    };
  });
}
