import {
  AppDatabase,
  ApprovalDecision,
  ApprovalStage,
  AuditLogEntry,
  Category,
  CommentKind,
  Department,
  MessageChannel,
  MessageLogEntry,
  NotificationItem,
  Priority,
  Reason,
  RequestStatus,
  TechnicianReport,
  TimelineEvent,
  User,
  UserRole,
  WorkshopRequest,
} from '../types';

export const SEED_DEPARTMENTS: Department[] = [
  { id: 'dept-fleet', name: 'Fleet & Vehicles', code: 'FLT', costCenter: 'CC-110', active: true },
  { id: 'dept-hvac', name: 'HVAC & Facilities', code: 'HVC', costCenter: 'CC-220', active: true },
  { id: 'dept-elec', name: 'Electrical & Power', code: 'ELC', costCenter: 'CC-330', active: true },
  { id: 'dept-mach', name: 'Machining & Fabrication', code: 'MCH', costCenter: 'CC-440', active: true },
  { id: 'dept-carp', name: 'Carpentry & Civil Works', code: 'CRP', costCenter: 'CC-550', active: true },
];

export const SEED_CATEGORIES: Category[] = [
  { id: 'cat-pm', name: 'Preventive Maintenance', description: 'Scheduled servicing and inspection intervals', active: true },
  { id: 'cat-mech', name: 'Mechanical Repair', description: 'Bearings, belts, gearboxes, and drive assemblies', active: true },
  { id: 'cat-elec', name: 'Electrical Fault', description: 'Breakers, switchgear, wiring, and lighting circuits', active: true },
  { id: 'cat-hvac', name: 'HVAC & Climate', description: 'Chillers, air handlers, ductwork, and thermostats', active: true },
  { id: 'cat-weld', name: 'Welding & Metalwork', description: 'Structural steel, brackets, frames, and TIG/MIG welding', active: true },
  { id: 'cat-hyd', name: 'Hydraulic Systems', description: 'Rams, hoses, manifolds, and pressure pumps', active: true },
  { id: 'cat-cal', name: 'Calibration & Alignment', description: 'CNC spindle, laser leveling, and torque calibration', active: true },
  { id: 'cat-safe', name: 'Facility Safety', description: 'Guardrails, emergency stops, signage, and roll-up doors', active: true },
];

export const SEED_REASONS: Reason[] = [
  { id: 'rsn-break', name: 'Equipment Breakdown', description: 'Unplanned asset stoppage or mechanical failure', active: true },
  { id: 'rsn-sched', name: 'Scheduled Service', description: 'Routine interval maintenance plan', active: true },
  { id: 'rsn-hazard', name: 'Safety Hazard', description: 'Condition requiring immediate risk mitigation', active: true },
  { id: 'rsn-install', name: 'New Installation', description: 'Commissioning new bench, bay, or utility line', active: true },
  { id: 'rsn-upgrade', name: 'Upgrade / Retrofit', description: 'Efficiency or control system modernization', active: true },
  { id: 'rsn-inspect', name: 'Inspection Finding', description: 'Follow-up corrective action from compliance audit', active: true },
];

export const SEED_USERS: User[] = [
  {
    id: 'usr-admin',
    name: 'Elena Rostova',
    email: 'admin@workshoplog.io',
    phone: '+1-555-0101',
    role: UserRole.ADMIN,
    departmentId: 'dept-mach',
    title: 'Systems Administrator',
    active: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'usr-mgr',
    name: 'Marcus Vance',
    email: 'manager@workshoplog.io',
    phone: '+1-555-0102',
    role: UserRole.WORKSHOP_MANAGER,
    departmentId: 'dept-mach',
    title: 'Workshop Operations Manager',
    active: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'usr-req1',
    name: 'Nadia Patel',
    email: 'requester@workshoplog.io',
    phone: '+1-555-0103',
    role: UserRole.REQUESTER,
    departmentId: 'dept-fleet',
    title: 'Logistics Coordinator',
    active: true,
    createdAt: '2026-01-12T09:00:00Z',
  },
  {
    id: 'usr-req2',
    name: 'Devon Brooks',
    email: 'devon.brooks@workshoplog.io',
    phone: '+1-555-0104',
    role: UserRole.REQUESTER,
    departmentId: 'dept-hvac',
    title: 'Facility Supervisor',
    active: true,
    createdAt: '2026-01-14T09:00:00Z',
  },
  {
    id: 'usr-tech1',
    name: 'Carlos Mendez',
    email: 'tech@workshoplog.io',
    phone: '+1-555-0105',
    role: UserRole.TECHNICIAN,
    departmentId: 'dept-mach',
    title: 'Senior Millwright Technician',
    active: true,
    createdAt: '2026-01-15T08:30:00Z',
  },
  {
    id: 'usr-tech2',
    name: 'Hannah Lindqvist',
    email: 'hannah.l@workshoplog.io',
    phone: '+1-555-0106',
    role: UserRole.TECHNICIAN,
    departmentId: 'dept-elec',
    title: 'Master Industrial Electrician',
    active: true,
    createdAt: '2026-01-16T08:30:00Z',
  },
  {
    id: 'usr-tech3',
    name: 'Tariq Al-Mansoor',
    email: 'tariq.a@workshoplog.io',
    phone: '+1-555-0107',
    role: UserRole.TECHNICIAN,
    departmentId: 'dept-fleet',
    title: 'Fleet & Hydraulic Specialist',
    active: true,
    createdAt: '2026-01-18T08:30:00Z',
  },
  {
    id: 'usr-hod1',
    name: 'claire.dunne@workshoplog.io'.includes('@') ? 'Claire Dunne' : 'Claire Dunne',
    email: 'hod@workshoplog.io',
    phone: '+1-555-0108',
    role: UserRole.HEAD_OF_DEPARTMENT,
    departmentId: 'dept-fleet',
    title: 'Head of Fleet & Vehicles',
    active: true,
    createdAt: '2026-01-11T08:00:00Z',
  },
  {
    id: 'usr-hod2',
    name: 'Samuel Okafor',
    email: 'samuel.okafor@workshoplog.io',
    phone: '+1-555-0109',
    role: UserRole.HEAD_OF_DEPARTMENT,
    departmentId: 'dept-elec',
    title: 'Head of Electrical & Power',
    active: true,
    createdAt: '2026-01-11T08:00:00Z',
  },
  {
    id: 'usr-fin',
    name: 'Grace Chen',
    email: 'finance@workshoplog.io',
    phone: '+1-555-0110',
    role: UserRole.FINANCE,
    departmentId: 'dept-hvac',
    title: 'Procurement & Finance Controller',
    active: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
];

const REQUEST_TEMPLATES: Array<{
  title: string;
  description: string;
  deptId: string;
  catId: string;
  reasonId: string;
  location: string;
  priority: Priority;
  needsPurchase: boolean;
  estCost: number;
}> = [
  {
    title: 'Forklift Bay 3 Hydraulic Lift Cylinder Seal Leak',
    description: 'Unit FL-08 hydraulic mast cylinder weeping oil at upper wiper seal under 1,800 kg test load. Requires seal kit replacement and pressure test.',
    deptId: 'dept-fleet',
    catId: 'cat-hyd',
    reasonId: 'rsn-break',
    location: 'Loading Dock Bay 3',
    priority: Priority.URGENT,
    needsPurchase: true,
    estCost: 480,
  },
  {
    title: 'Main Compressor Room Air Dryer Drain Valve Jam',
    description: 'Automatic condensate drain valve on Rotary Screw Compressor #2 stuck open, causing continuous air pressure drop across Bay B pneumatic tools.',
    deptId: 'dept-mach',
    catId: 'cat-mech',
    reasonId: 'rsn-break',
    location: 'Compressor Mezzanine',
    priority: Priority.HIGH,
    needsPurchase: true,
    estCost: 310,
  },
  {
    title: 'North Warehouse LED High-Bay Circuit Flickering',
    description: 'Row 4 high-bay fixtures cycling intermittently on breaker panel B-12. Suspected loose neutral lug or failing ballast driver.',
    deptId: 'dept-elec',
    catId: 'cat-elec',
    reasonId: 'rsn-hazard',
    location: 'North Warehouse Aisle 4',
    priority: Priority.HIGH,
    needsPurchase: false,
    estCost: 145,
  },
  {
    title: 'CNC Lathe #4 Spindle Runout & Tailstock Alignment',
    description: 'Operator reported 0.04mm taper over 150mm turning length. Scheduled spindle alignment verification and gib adjustment needed.',
    deptId: 'dept-mach',
    catId: 'cat-cal',
    reasonId: 'rsn-inspect',
    location: 'Machine Shop Zone A',
    priority: Priority.MEDIUM,
    needsPurchase: false,
    estCost: 220,
  },
  {
    title: 'Rooftop Chiller Unit 2 Condenser Fan Bearing Noise',
    description: 'Audible metallic rumble from condenser fan motor #3 during peak afternoon cooling cycle. Bearing kit and belt check required.',
    deptId: 'dept-hvac',
    catId: 'cat-hvac',
    reasonId: 'rsn-sched',
    location: 'Building Roof Sector East',
    priority: Priority.HIGH,
    needsPurchase: true,
    estCost: 690,
  },
  {
    title: 'Heavy Timber Packing Bench Corner Frame Reinforcement',
    description: 'Fabricate and weld 6mm steel gusset plates onto Crate Assembly Table #2 after forklift impact bent rear leg upright.',
    deptId: 'dept-carp',
    catId: 'cat-weld',
    reasonId: 'rsn-break',
    location: 'Crating & Dispatch Annex',
    priority: Priority.MEDIUM,
    needsPurchase: false,
    estCost: 185,
  },
  {
    title: 'Service Van #14 30,000km Brake & Suspension Service',
    description: 'Routine 30k interval inspection: front brake pads, rotor thickness check, rear leaf spring bushings, and oil/filter service.',
    deptId: 'dept-fleet',
    catId: 'cat-pm',
    reasonId: 'rsn-sched',
    location: 'Fleet Garage Bay 1',
    priority: Priority.MEDIUM,
    needsPurchase: true,
    estCost: 540,
  },
  {
    title: 'Roll-Up Dock Door #6 Safety Photo-Eye Realignment',
    description: 'Door reverses mid-descent even with clear threshold. Photo-eye bracket bent and wiring conduit loose near floor guide.',
    deptId: 'dept-carp',
    catId: 'cat-safe',
    reasonId: 'rsn-hazard',
    location: 'East Yard Gate 6',
    priority: Priority.URGENT,
    needsPurchase: false,
    estCost: 120,
  },
  {
    title: 'Sub-Distribution Panel MDP-4 Thermal Scan & Torque Check',
    description: 'Annual infrared thermography flagged elevated temperature (68C) on Phase B main lug. Isolate and re-torque bus connections.',
    deptId: 'dept-elec',
    catId: 'cat-pm',
    reasonId: 'rsn-inspect',
    location: 'Electrical Room West',
    priority: Priority.HIGH,
    needsPurchase: false,
    estCost: 260,
  },
  {
    title: 'Paint Booth Exhaust Louver Actuator Replacement',
    description: '24V damper actuator fails to open exhaust louver during purge cycle. Replace Belimo-compatible spring-return actuator.',
    deptId: 'dept-hvac',
    catId: 'cat-hvac',
    reasonId: 'rsn-break',
    location: 'Finishing & Coating Bay',
    priority: Priority.HIGH,
    needsPurchase: true,
    estCost: 410,
  },
  {
    title: 'Gantry Crane 5-Ton Hoist Limit Switch Calibration',
    description: 'Upper hook travel limit trips 80mm early; verify hoist limit cam settings and test load brake holding torque.',
    deptId: 'dept-mach',
    catId: 'cat-cal',
    reasonId: 'rsn-sched',
    location: 'Fabrication Hall Center',
    priority: Priority.MEDIUM,
    needsPurchase: false,
    estCost: 195,
  },
  {
    title: 'Yard Utility Cart #3 Lithium Charger Relay Fault',
    description: '48V smart charger throws E-04 contactor error after 10 minutes. Inspect output relay and Anderson plug contacts.',
    deptId: 'dept-fleet',
    catId: 'cat-elec',
    reasonId: 'rsn-break',
    location: 'Fleet Charging Alcove',
    priority: Priority.LOW,
    needsPurchase: true,
    estCost: 290,
  },
];

// Deterministic status sequence across 60 requests
const STATUS_DISTRIBUTION: RequestStatus[] = [
  RequestStatus.OPEN, RequestStatus.OPEN, RequestStatus.OPEN, RequestStatus.OPEN, RequestStatus.OPEN, RequestStatus.OPEN, RequestStatus.OPEN, RequestStatus.OPEN,
  RequestStatus.ASSIGNED, RequestStatus.ASSIGNED, RequestStatus.ASSIGNED, RequestStatus.ASSIGNED, RequestStatus.ASSIGNED, RequestStatus.ASSIGNED, RequestStatus.ASSIGNED,
  RequestStatus.IN_PROGRESS, RequestStatus.IN_PROGRESS, RequestStatus.IN_PROGRESS, RequestStatus.IN_PROGRESS, RequestStatus.IN_PROGRESS, RequestStatus.IN_PROGRESS, RequestStatus.IN_PROGRESS, RequestStatus.IN_PROGRESS,
  RequestStatus.AWAITING_HOD_APPROVAL, RequestStatus.AWAITING_HOD_APPROVAL, RequestStatus.AWAITING_HOD_APPROVAL, RequestStatus.AWAITING_HOD_APPROVAL, RequestStatus.AWAITING_HOD_APPROVAL, RequestStatus.AWAITING_HOD_APPROVAL,
  RequestStatus.AWAITING_FINANCE_APPROVAL, RequestStatus.AWAITING_FINANCE_APPROVAL, RequestStatus.AWAITING_FINANCE_APPROVAL, RequestStatus.AWAITING_FINANCE_APPROVAL, RequestStatus.AWAITING_FINANCE_APPROVAL,
  RequestStatus.COMPLETED, RequestStatus.COMPLETED, RequestStatus.COMPLETED, RequestStatus.COMPLETED, RequestStatus.COMPLETED,
  RequestStatus.CLOSED, RequestStatus.CLOSED, RequestStatus.CLOSED, RequestStatus.CLOSED, RequestStatus.CLOSED, RequestStatus.CLOSED, RequestStatus.CLOSED, RequestStatus.CLOSED, RequestStatus.CLOSED, RequestStatus.CLOSED, RequestStatus.CLOSED, RequestStatus.CLOSED,
  RequestStatus.REJECTED, RequestStatus.REJECTED, RequestStatus.REJECTED,
  RequestStatus.ON_HOLD, RequestStatus.ON_HOLD, RequestStatus.ON_HOLD,
  RequestStatus.REOPENED, RequestStatus.REOPENED, RequestStatus.REOPENED,
];

function addDays(base: Date, days: number): string {
  const d = new Date(base.getTime() + days * 86400000);
  return d.toISOString();
}

export function createSeedDatabase(now = new Date('2026-11-18T08:00:00Z')): AppDatabase {
  const requests: WorkshopRequest[] = [];
  const notifications: NotificationItem[] = [];
  const messageLogs: MessageLogEntry[] = [];
  const auditLogs: AuditLogEntry[] = [];

  const requesters = [SEED_USERS[2], SEED_USERS[3]];
  const technicians = [SEED_USERS[4], SEED_USERS[5], SEED_USERS[6]];
  const manager = SEED_USERS[1];
  const hodFleet = SEED_USERS[7];
  const hodElec = SEED_USERS[8];
  const finance = SEED_USERS[9];

  for (let i = 0; i < 60; i++) {
    const seq = i + 1;
    const ref = `WR-2026-${String(seq).padStart(5, '0')}`;
    const tpl = REQUEST_TEMPLATES[i % REQUEST_TEMPLATES.length];
    const status = STATUS_DISTRIBUTION[i];
    const requester = requesters[i % requesters.length];
    const tech = status === RequestStatus.OPEN ? null : technicians[i % technicians.length];
    const hod = tpl.deptId === 'dept-elec' ? hodElec : hodFleet;

    // Ensure Finance approval requests always have needsPurchase = true
    const needsPurchase =
      status === RequestStatus.AWAITING_FINANCE_APPROVAL
        ? true
        : status === RequestStatus.AWAITING_HOD_APPROVAL && i % 2 === 0
        ? true
        : tpl.needsPurchase;

    // Spread created dates over the past 45 days; make some open/in-progress overdue for realistic KPIs
    const daysAgo = 45 - Math.floor((i * 44) / 60);
    const createdDate = new Date(now.getTime() - daysAgo * 86400000);
    const createdAt = createdDate.toISOString();
    // Some active jobs intentionally overdue (dueDate in the past relative to `now`)
    const dueOffsetDays = i % 5 === 0 ? 2 : 9;
    const dueDate = addDays(createdDate, dueOffsetDays);

    const variantSuffix = i >= REQUEST_TEMPLATES.length ? ` (Bay ${(i % 5) + 1})` : '';
    const title = `${tpl.title}${variantSuffix}`;
    const id = `req-${seq}`;
    const estCost = tpl.estCost + (i % 4) * 35;

    const timeline: TimelineEvent[] = [
      {
        id: `tl-${seq}-1`,
        requestId: id,
        actorId: requester.id,
        actorName: requester.name,
        actorRole: requester.role,
        action: 'Request Submitted',
        toStatus: RequestStatus.OPEN,
        note: `Initial worksheet logged at ${tpl.location}.`,
        timestamp: createdAt,
      },
    ];

    const comments = [];
    const techReports: TechnicianReport[] = [];
    const approvals = [];
    let updatedAt = createdAt;
    let closedAt: string | null = null;
    let approvedCost: number | null = null;

    if (status !== RequestStatus.OPEN && tech) {
      const tAssign = addDays(createdDate, 1);
      updatedAt = tAssign;
      timeline.unshift({
        id: `tl-${seq}-2`,
        requestId: id,
        actorId: manager.id,
        actorName: manager.name,
        actorRole: manager.role,
        action: `Assigned to ${tech.name}`,
        fromStatus: RequestStatus.OPEN,
        toStatus: RequestStatus.ASSIGNED,
        note: `Scheduled for ${tech.title} inspection.`,
        timestamp: tAssign,
      });

      if (i % 3 === 0) {
        comments.push({
          id: `cmt-${seq}-mgr`,
          requestId: id,
          authorId: manager.id,
          authorName: manager.name,
          authorRole: manager.role,
          kind: CommentKind.MANAGER,
          body: 'Prioritize lockout/tagout verification before opening housing.',
          createdAt: tAssign,
        });
      }
    }

    const passedInProgress = [
      RequestStatus.IN_PROGRESS,
      RequestStatus.AWAITING_HOD_APPROVAL,
      RequestStatus.AWAITING_FINANCE_APPROVAL,
      RequestStatus.COMPLETED,
      RequestStatus.CLOSED,
      RequestStatus.ON_HOLD,
      RequestStatus.REOPENED,
    ].includes(status);

    if (passedInProgress && tech) {
      const tStart = addDays(createdDate, 2);
      updatedAt = tStart;
      timeline.unshift({
        id: `tl-${seq}-3`,
        requestId: id,
        actorId: tech.id,
        actorName: tech.name,
        actorRole: tech.role,
        action: 'Work Started',
        fromStatus: RequestStatus.ASSIGNED,
        toStatus: RequestStatus.IN_PROGRESS,
        note: 'On-site diagnostics initiated and initial teardown completed.',
        timestamp: tStart,
      });

      comments.push({
        id: `cmt-${seq}-usr`,
        requestId: id,
        authorId: requester.id,
        authorName: requester.name,
        authorRole: requester.role,
        kind: CommentKind.USER,
        body: 'Area has been cleared and access keycard left with the shift lead.',
        createdAt: tStart,
      });
    }

    const passedHodSubmit = [
      RequestStatus.AWAITING_HOD_APPROVAL,
      RequestStatus.AWAITING_FINANCE_APPROVAL,
      RequestStatus.COMPLETED,
      RequestStatus.CLOSED,
      RequestStatus.REOPENED,
    ].includes(status);

    if (passedHodSubmit && tech) {
      const tReport = addDays(createdDate, 3);
      updatedAt = tReport;
      const labourHours = 2 + (i % 5) * 0.5;
      const labourCost = labourHours * 65;
      const partsCost = needsPurchase ? Math.round(estCost * 0.72) : Math.round(estCost * 0.3);
      const totalCost = labourCost + partsCost;

      techReports.push({
        id: `rep-${seq}-1`,
        requestId: id,
        technicianId: tech.id,
        technicianName: tech.name,
        workDone: `Completed diagnostic teardown for ${title}. Replaced worn assembly components, verified clearances, and ran functional load check.`,
        partsUsed: needsPurchase ? 'OEM Seal & Bearing Service Kit, synthetic lubricant' : 'Standard fasteners, cleaning solvent',
        labourHours,
        partsCost,
        labourCost,
        totalCost,
        recommendations: 'Schedule 90-day follow-up inspection during next preventive window.',
        createdAt: tReport,
      });

      timeline.unshift({
        id: `tl-${seq}-4`,
        requestId: id,
        actorId: tech.id,
        actorName: tech.name,
        actorRole: tech.role,
        action: 'Submitted for HoD Approval',
        fromStatus: RequestStatus.IN_PROGRESS,
        toStatus: RequestStatus.AWAITING_HOD_APPROVAL,
        note: 'Technician field report filed; awaiting department review.',
        timestamp: tReport,
      });
    }

    const passedHodApproval = [
      RequestStatus.AWAITING_FINANCE_APPROVAL,
      RequestStatus.COMPLETED,
      RequestStatus.CLOSED,
      RequestStatus.REOPENED,
    ].includes(status);

    if (passedHodApproval) {
      const tHod = addDays(createdDate, 4);
      updatedAt = tHod;
      const nextSt = needsPurchase ? RequestStatus.AWAITING_FINANCE_APPROVAL : RequestStatus.COMPLETED;
      approvals.push({
        id: `app-${seq}-hod`,
        requestId: id,
        stage: ApprovalStage.HOD,
        decision: ApprovalDecision.APPROVED,
        actorId: hod.id,
        actorName: hod.name,
        amountApproved: estCost,
        note: needsPurchase ? 'Department scope verified; forwarding purchase estimate to Finance.' : 'Department sign-off approved.',
        createdAt: tHod,
      });
      timeline.unshift({
        id: `tl-${seq}-5`,
        requestId: id,
        actorId: hod.id,
        actorName: hod.name,
        actorRole: hod.role,
        action: needsPurchase ? 'HoD Approved (Sent to Finance)' : 'HoD Approved & Completed',
        fromStatus: RequestStatus.AWAITING_HOD_APPROVAL,
        toStatus: nextSt,
        note: 'Verified against department maintenance budget.',
        timestamp: tHod,
      });
    }

    const passedFinance =
      needsPurchase &&
      [RequestStatus.COMPLETED, RequestStatus.CLOSED, RequestStatus.REOPENED].includes(status);

    if (passedFinance) {
      const tFin = addDays(createdDate, 5);
      updatedAt = tFin;
      approvedCost = techReports[0]?.totalCost ?? estCost;
      approvals.push({
        id: `app-${seq}-fin`,
        requestId: id,
        stage: ApprovalStage.FINANCE,
        decision: ApprovalDecision.APPROVED,
        actorId: finance.id,
        actorName: finance.name,
        amountApproved: approvedCost,
        note: `PO authorized under ${SEED_DEPARTMENTS.find((d) => d.id === tpl.deptId)?.costCenter}.`,
        createdAt: tFin,
      });
      timeline.unshift({
        id: `tl-${seq}-6`,
        requestId: id,
        actorId: finance.id,
        actorName: finance.name,
        actorRole: finance.role,
        action: 'Finance Approved Purchase',
        fromStatus: RequestStatus.AWAITING_FINANCE_APPROVAL,
        toStatus: RequestStatus.COMPLETED,
        note: `Authorized $${approvedCost.toFixed(2)} expenditure.`,
        timestamp: tFin,
      });
    }

    if (status === RequestStatus.CLOSED || status === RequestStatus.REOPENED) {
      const tClose = addDays(createdDate, 6);
      updatedAt = tClose;
      closedAt = status === RequestStatus.CLOSED ? tClose : null;
      if (approvedCost === null) {
        approvedCost = techReports[0]?.totalCost ?? estCost;
      }
      timeline.unshift({
        id: `tl-${seq}-7`,
        requestId: id,
        actorId: manager.id,
        actorName: manager.name,
        actorRole: manager.role,
        action: 'Request Closed',
        fromStatus: RequestStatus.COMPLETED,
        toStatus: RequestStatus.CLOSED,
        note: 'Final inspection passed and worksheet archived.',
        timestamp: tClose,
      });
    }

    if (status === RequestStatus.REOPENED) {
      const tReopen = addDays(createdDate, 8);
      updatedAt = tReopen;
      timeline.unshift({
        id: `tl-${seq}-8`,
        requestId: id,
        actorId: manager.id,
        actorName: manager.name,
        actorRole: manager.role,
        action: 'Request Reopened',
        fromStatus: RequestStatus.CLOSED,
        toStatus: RequestStatus.REOPENED,
        note: 'Follow-up vibration check requested by shift supervisor.',
        timestamp: tReopen,
      });
    }

    if (status === RequestStatus.ON_HOLD && tech) {
      const tHold = addDays(createdDate, 3);
      updatedAt = tHold;
      timeline.unshift({
        id: `tl-${seq}-hold`,
        requestId: id,
        actorId: tech.id,
        actorName: tech.name,
        actorRole: tech.role,
        action: 'Placed On Hold',
        fromStatus: RequestStatus.IN_PROGRESS,
        toStatus: RequestStatus.ON_HOLD,
        note: 'Awaiting backordered OEM coupling assembly from supplier.',
        timestamp: tHold,
      });
    }

    if (status === RequestStatus.REJECTED) {
      const tRej = addDays(createdDate, 2);
      updatedAt = tRej;
      timeline.unshift({
        id: `tl-${seq}-rej`,
        requestId: id,
        actorId: manager.id,
        actorName: manager.name,
        actorRole: manager.role,
        action: 'Request Rejected',
        fromStatus: RequestStatus.ASSIGNED,
        toStatus: RequestStatus.REJECTED,
        note: 'Duplicate worksheet; consolidated under scheduled quarterly shutdown.',
        timestamp: tRej,
      });
    }

    requests.push({
      id,
      referenceNumber: ref,
      title,
      description: tpl.description,
      departmentId: tpl.deptId,
      categoryId: tpl.catId,
      reasonId: tpl.reasonId,
      priority: tpl.priority,
      location: tpl.location,
      status,
      requesterId: requester.id,
      assignedTechnicianId: tech ? tech.id : null,
      needsPurchase,
      estimatedCost: estCost,
      approvedCost,
      dueDate,
      createdAt,
      updatedAt,
      closedAt,
      attachments: [],
      technicianReports: techReports,
      comments,
      approvals,
      timeline,
    });
  }

  // Seed sample notifications & simulated message logs for active workflow items
  const activeReqs = requests.filter((r) =>
    [
      RequestStatus.OPEN,
      RequestStatus.ASSIGNED,
      RequestStatus.AWAITING_HOD_APPROVAL,
      RequestStatus.AWAITING_FINANCE_APPROVAL,
    ].includes(r.status)
  );

  activeReqs.slice(0, 12).forEach((req, idx) => {
    const recipient =
      req.status === RequestStatus.OPEN
        ? manager
        : req.status === RequestStatus.ASSIGNED && req.assignedTechnicianId
        ? SEED_USERS.find((u) => u.id === req.assignedTechnicianId) || manager
        : req.status === RequestStatus.AWAITING_HOD_APPROVAL
        ? req.departmentId === 'dept-elec'
          ? hodElec
          : hodFleet
        : finance;

    notifications.push({
      id: `notif-seed-${idx + 1}`,
      recipientUserId: recipient.id,
      requestId: req.id,
      referenceNumber: req.referenceNumber,
      title: `Action Needed: ${req.referenceNumber}`,
      message: `${req.title} is currently ${req.status.replace(/_/g, ' ')}.`,
      read: idx > 5,
      createdAt: req.updatedAt,
    });

    messageLogs.push({
      id: `msg-seed-${idx + 1}`,
      requestId: req.id,
      referenceNumber: req.referenceNumber,
      recipientName: recipient.name,
      recipientContact: idx % 2 === 0 ? recipient.email : recipient.phone,
      channel: idx % 2 === 0 ? MessageChannel.EMAIL : MessageChannel.SMS,
      subject: idx % 2 === 0 ? `[WorkshopLog] ${req.referenceNumber} status update` : undefined,
      body: `Worksheet ${req.referenceNumber} (${req.title}) is now ${req.status.replace(/_/g, ' ')}.`,
      sentAt: req.updatedAt,
    });
  });

  auditLogs.push(
    {
      id: 'aud-1',
      actorId: SEED_USERS[0].id,
      actorName: SEED_USERS[0].name,
      actorRole: SEED_USERS[0].role,
      entityType: 'SYSTEM',
      entityId: 'seed',
      action: 'Initialized Workspace',
      details: 'Seeded 60 workshop requests, 5 departments, 8 categories, 6 reasons, and 10 staff accounts.',
      timestamp: now.toISOString(),
    },
    {
      id: 'aud-2',
      actorId: manager.id,
      actorName: manager.name,
      actorRole: manager.role,
      entityType: 'REQUEST',
      entityId: 'req-1',
      action: 'Priority Escalation',
      details: 'Verified urgent dock bay priority on WR-2026-00001.',
      timestamp: addDays(now, -1),
    }
  );

  return {
    users: SEED_USERS,
    departments: SEED_DEPARTMENTS,
    categories: SEED_CATEGORIES,
    reasons: SEED_REASONS,
    requests,
    notifications,
    messageLogs,
    auditLogs,
    nextReferenceSeq: 61,
  };
}
