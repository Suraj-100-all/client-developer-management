import bcrypt from 'bcryptjs';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER';
  avatarUrl: string;
  createdAt: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  company: string;
  email: string;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  title: string;
  description: string;
  clientId: string;
  createdByPmId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  taskNumber: number;
  title: string;
  description: string;
  projectId: string;
  assignedToDevId?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate: string; // ISO String
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskActivityLogRecord {
  id: string;
  taskId: string;
  projectId: string;
  userId: string;
  actionType: 'STATUS_CHANGE' | 'ASSIGNMENT' | 'CREATED' | 'OVERDUE_FLAGGED' | 'DESCRIPTION_UPDATE';
  oldValue?: string;
  newValue?: string;
  formattedMessage: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  taskId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

class DatabaseStore {
  public users: Map<string, UserRecord> = new Map();
  public clients: Map<string, ClientRecord> = new Map();
  public projects: Map<string, ProjectRecord> = new Map();
  public tasks: Map<string, TaskRecord> = new Map();
  public activityLogs: TaskActivityLogRecord[] = [];
  public notifications: Map<string, NotificationRecord> = new Map();
  public refreshTokens: Map<string, { userId: string; token: string; expiresAt: Date }> = new Map();

  private taskCounter = 100;

  constructor() {
    this.seedInitialData();
  }

  public getNextTaskNumber(): number {
    this.taskCounter += 1;
    return this.taskCounter;
  }

  // Find user by email
  public findUserByEmail(email: string): UserRecord | undefined {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return undefined;
  }

  // Get tasks with relational joins
  public getEnrichedTask(task: TaskRecord) {
    const project = this.projects.get(task.projectId);
    const assignedDev = task.assignedToDevId ? this.users.get(task.assignedToDevId) : undefined;
    const safeDev = assignedDev
      ? {
          id: assignedDev.id,
          name: assignedDev.name,
          email: assignedDev.email,
          role: assignedDev.role,
          avatarUrl: assignedDev.avatarUrl,
          createdAt: assignedDev.createdAt,
        }
      : undefined;

    return {
      ...task,
      project: project
        ? {
            id: project.id,
            title: project.title,
            createdByPmId: project.createdByPmId,
          }
        : undefined,
      assignedDev: safeDev,
    };
  }

  // Initial mock data setup for workspace projects and accounts
  private seedInitialData() {
    const defaultPasswordHash = bcrypt.hashSync('Password123!', 8);
    const now = new Date();
    const past2Days = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const past4Days = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const future2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const future4Days = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const future7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const future14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // 1 Admin
    const admin: UserRecord = {
      id: 'usr-admin-1',
      name: 'Alex Morgan',
      email: 'admin@velozity.com',
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      createdAt: past4Days,
    };

    // 2 Project Managers
    const pmSarah: UserRecord = {
      id: 'usr-pm-1',
      name: 'Sarah Jenkins',
      email: 'pm.sarah@velozity.com',
      passwordHash: defaultPasswordHash,
      role: 'PROJECT_MANAGER',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      createdAt: past4Days,
    };

    const pmMarcus: UserRecord = {
      id: 'usr-pm-2',
      name: 'Marcus Vance',
      email: 'pm.marcus@velozity.com',
      passwordHash: defaultPasswordHash,
      role: 'PROJECT_MANAGER',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      createdAt: past4Days,
    };

    // 4 Developers
    const devRavi: UserRecord = {
      id: 'usr-dev-1',
      name: 'Ravi Kumar',
      email: 'dev.ravi@velozity.com',
      passwordHash: defaultPasswordHash,
      role: 'DEVELOPER',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      createdAt: past4Days,
    };

    const devElena: UserRecord = {
      id: 'usr-dev-2',
      name: 'Elena Rostova',
      email: 'dev.elena@velozity.com',
      passwordHash: defaultPasswordHash,
      role: 'DEVELOPER',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      createdAt: past4Days,
    };

    const devAlex: UserRecord = {
      id: 'usr-dev-3',
      name: 'Alex Chen',
      email: 'dev.alex@velozity.com',
      passwordHash: defaultPasswordHash,
      role: 'DEVELOPER',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      createdAt: past4Days,
    };

    const devPriya: UserRecord = {
      id: 'usr-dev-4',
      name: 'Priya Patel',
      email: 'dev.priya@velozity.com',
      passwordHash: defaultPasswordHash,
      role: 'DEVELOPER',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      createdAt: past4Days,
    };

    [admin, pmSarah, pmMarcus, devRavi, devElena, devAlex, devPriya].forEach((u) => {
      this.users.set(u.id, u);
    });

    // Clients
    const client1: ClientRecord = {
      id: 'cli-1',
      name: 'Apex Global Markets',
      company: 'Apex Financial Services Inc.',
      email: 'contact@apexmarkets.io',
      createdAt: past4Days,
    };
    const client2: ClientRecord = {
      id: 'cli-2',
      name: 'BioVantage Health Systems',
      company: 'BioVantage MedTech Ltd.',
      email: 'tech@biovantage.health',
      createdAt: past4Days,
    };
    const client3: ClientRecord = {
      id: 'cli-3',
      name: 'OmniFreight Logistics',
      company: 'OmniFreight Global Cargo',
      email: 'ops@omnifreight.com',
      createdAt: past4Days,
    };

    [client1, client2, client3].forEach((c) => this.clients.set(c.id, c));

    // Projects (At least 3 projects, Sarah PM owns 2, Marcus PM owns 2)
    const proj1: ProjectRecord = {
      id: 'proj-1',
      title: 'Fintech Real-Time Trading Portal',
      description: 'High-frequency order routing interface with real-time Level 2 market data feeds and portfolio analytics.',
      clientId: client1.id,
      createdByPmId: pmSarah.id,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const proj2: ProjectRecord = {
      id: 'proj-2',
      title: 'HealthSync Patient Care Platform',
      description: 'HIPAA-compliant telemedicine dashboard connecting patients with specialists, e-prescriptions, and lab telemetry.',
      clientId: client2.id,
      createdByPmId: pmMarcus.id,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const proj3: ProjectRecord = {
      id: 'proj-3',
      title: 'LogiTrack Supply Chain Intelligence',
      description: 'Cross-border container tracking dashboard with route optimization, automated customs clearance, and IoT sensors.',
      clientId: client3.id,
      createdByPmId: pmSarah.id,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const proj4: ProjectRecord = {
      id: 'proj-4',
      title: 'AeroSky Aircraft Telemetry',
      description: 'Fleet health monitoring, predictive maintenance sensor ingestion, and pilot digital dispatch portal.',
      clientId: client1.id,
      createdByPmId: pmMarcus.id,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    [proj1, proj2, proj3, proj4].forEach((p) => this.projects.set(p.id, p));

    // Tasks (At least 5+ tasks each, with 2 already in OVERDUE state)
    // Project 1 Tasks (PM: Sarah)
    const t1: TaskRecord = {
      id: 'task-101',
      taskNumber: 101,
      title: 'Implement WebSocket depth-of-book orderbook ticker',
      description: 'Connect to exchange binary WebSocket feed, maintain in-memory bid/ask price ladders, render 60fps canvas.',
      projectId: proj1.id,
      assignedToDevId: devRavi.id,
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      dueDate: future2Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const t2: TaskRecord = {
      id: 'task-102',
      taskNumber: 102,
      title: 'Multi-factor biometric authentication handshake',
      description: 'Implement FIDO2 / WebAuthn hardware key verification with fallbacks for SMS and TOTP codes.',
      projectId: proj1.id,
      assignedToDevId: devRavi.id,
      status: 'IN_REVIEW',
      priority: 'HIGH',
      dueDate: past2Days, // OVERDUE TASK #1 (Assigned to Ravi)
      isOverdue: true,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const t3: TaskRecord = {
      id: 'task-103',
      taskNumber: 103,
      title: 'Latency benchmarks & order slip calculation engine',
      description: 'Profile sub-millisecond execution logs and aggregate P99 latency percentiles across dark pools.',
      projectId: proj1.id,
      assignedToDevId: devElena.id,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: future7Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past4Days,
    };

    const t4: TaskRecord = {
      id: 'task-104',
      taskNumber: 104,
      title: 'Fix margin call alert banner flickering on window resize',
      description: 'Debounce resize observer and synchronize state transition to prevent visual shudder.',
      projectId: proj1.id,
      assignedToDevId: devElena.id,
      status: 'DONE',
      priority: 'LOW',
      dueDate: past2Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const t5: TaskRecord = {
      id: 'task-105',
      taskNumber: 105,
      title: 'CSV & PDF export for audit compliance reports',
      description: 'Generate streaming PDF transaction summaries formatted for SEC and FINRA quarterly audits.',
      projectId: proj1.id,
      assignedToDevId: devAlex.id,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: future4Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past4Days,
    };

    const t6: TaskRecord = {
      id: 'task-106',
      taskNumber: 106,
      title: 'Database connection pool tuning for peak trading volume',
      description: 'Optimize max connections, statement timeout, and idle timeout on RDS PostgreSQL cluster.',
      projectId: proj1.id,
      assignedToDevId: devAlex.id,
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      dueDate: future2Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    // Project 2 Tasks (PM: Marcus)
    const t7: TaskRecord = {
      id: 'task-201',
      taskNumber: 201,
      title: 'HIPAA end-to-end encrypted video consultation room',
      description: 'Establish WebRTC peer-to-peer audio/video with selective forwarding unit and cryptographic key exchange.',
      projectId: proj2.id,
      assignedToDevId: devElena.id,
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      dueDate: past4Days, // OVERDUE TASK #2 (Assigned to Elena)
      isOverdue: true,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const t8: TaskRecord = {
      id: 'task-202',
      taskNumber: 202,
      title: 'Patient digital consent e-signature widget',
      description: 'Allow touch and stylus signature capture, embed vector paths into tamper-evident PDF document.',
      projectId: proj2.id,
      assignedToDevId: devPriya.id,
      status: 'IN_REVIEW',
      priority: 'HIGH',
      dueDate: future2Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const t9: TaskRecord = {
      id: 'task-203',
      taskNumber: 203,
      title: 'E-Prescription pharmacy network gateway integration',
      description: 'Validate Surescripts standard EDI messages, handle medication interaction warnings.',
      projectId: proj2.id,
      assignedToDevId: devAlex.id,
      status: 'TODO',
      priority: 'HIGH',
      dueDate: future4Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past4Days,
    };

    const t10: TaskRecord = {
      id: 'task-204',
      taskNumber: 204,
      title: 'Vital signs telemetry graph with real-time ECG waveform',
      description: 'Stream Bluetooth smart monitor blood pressure and pulse ox metrics with Canvas 60fps rendering.',
      projectId: proj2.id,
      assignedToDevId: devPriya.id,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: future7Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past4Days,
    };

    const t11: TaskRecord = {
      id: 'task-205',
      taskNumber: 205,
      title: 'Audit log export for clinical compliance officer',
      description: 'Cryptographically sign access events and record doctor-patient session durations.',
      projectId: proj2.id,
      assignedToDevId: devRavi.id,
      status: 'DONE',
      priority: 'LOW',
      dueDate: past4Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    // Project 3 Tasks (PM: Sarah)
    const t12: TaskRecord = {
      id: 'task-301',
      taskNumber: 301,
      title: 'Vessel AIS satellite telemetry parser and geo-fence alerts',
      description: 'Ingest NMEA AIS sentences from orbital satellites, compute estimated port arrival times.',
      projectId: proj3.id,
      assignedToDevId: devAlex.id,
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      dueDate: future2Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const t13: TaskRecord = {
      id: 'task-302',
      taskNumber: 302,
      title: 'Automated customs tariff harmonized code classification',
      description: 'Build predictive classifier for cargo manifest line items against international tariff schedules.',
      projectId: proj3.id,
      assignedToDevId: devPriya.id,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: future7Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past4Days,
    };

    const t14: TaskRecord = {
      id: 'task-303',
      taskNumber: 303,
      title: 'Reefer container temperature variance anomaly detection',
      description: 'Process telemetry from refrigerated shipping units and alert on sudden temperature drops.',
      projectId: proj3.id,
      assignedToDevId: devRavi.id,
      status: 'IN_REVIEW',
      priority: 'HIGH',
      dueDate: future4Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const t15: TaskRecord = {
      id: 'task-304',
      taskNumber: 304,
      title: 'Bill of Lading blockchain proof of possession',
      description: 'Implement distributed ledger smart contract tokenization for electronic title transfers.',
      projectId: proj3.id,
      assignedToDevId: devElena.id,
      status: 'TODO',
      priority: 'HIGH',
      dueDate: future14Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past4Days,
    };

    const t16: TaskRecord = {
      id: 'task-305',
      taskNumber: 305,
      title: 'Interactive global freight route map visualization',
      description: 'Render high-resolution shipping lanes, active weather storms, and port congestion heatmaps.',
      projectId: proj3.id,
      assignedToDevId: devPriya.id,
      status: 'DONE',
      priority: 'MEDIUM',
      dueDate: past2Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    // Project 4 Tasks (PM: Marcus)
    const t17: TaskRecord = {
      id: 'task-401',
      taskNumber: 401,
      title: 'Turbofan engine vibration spectrum FFT analysis module',
      description: 'Run Fast Fourier Transform on high-frequency vibration sensors to predict bearing fatigue.',
      projectId: proj4.id,
      assignedToDevId: devAlex.id,
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      dueDate: future4Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past2Days,
    };

    const t18: TaskRecord = {
      id: 'task-402',
      taskNumber: 402,
      title: 'Cockpit digital flight bag electronic checklist sync',
      description: 'Synchronize pre-flight check progress offline-first between tablet devices and dispatch.',
      projectId: proj4.id,
      assignedToDevId: devElena.id,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: future7Days,
      isOverdue: false,
      createdAt: past4Days,
      updatedAt: past4Days,
    };

    const allTasks = [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18];
    allTasks.forEach((task) => this.tasks.set(task.id, task));
    this.taskCounter = 405;

    // Seed Initial Activity Logs (Required: "Pre-existing activity log entries so the feed is not empty on first load")
    // Formatted exactly as requested: "Ravi moved Task #12 from In Progress → In Review · 2 mins ago"
    this.activityLogs = [
      {
        id: 'act-1',
        taskId: t2.id,
        projectId: proj1.id,
        userId: devRavi.id,
        actionType: 'STATUS_CHANGE',
        oldValue: 'IN_PROGRESS',
        newValue: 'IN_REVIEW',
        formattedMessage: 'Ravi moved Task #102 from In Progress → In Review',
        createdAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(), // 8 mins ago
      },
      {
        id: 'act-2',
        taskId: t1.id,
        projectId: proj1.id,
        userId: devRavi.id,
        actionType: 'STATUS_CHANGE',
        oldValue: 'TODO',
        newValue: 'IN_PROGRESS',
        formattedMessage: 'Ravi moved Task #101 from To Do → In Progress',
        createdAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(), // 25 mins ago
      },
      {
        id: 'act-3',
        taskId: t8.id,
        projectId: proj2.id,
        userId: devPriya.id,
        actionType: 'STATUS_CHANGE',
        oldValue: 'IN_PROGRESS',
        newValue: 'IN_REVIEW',
        formattedMessage: 'Priya moved Task #202 from In Progress → In Review',
        createdAt: new Date(now.getTime() - 42 * 60 * 1000).toISOString(),
      },
      {
        id: 'act-4',
        taskId: t14.id,
        projectId: proj3.id,
        userId: devRavi.id,
        actionType: 'STATUS_CHANGE',
        oldValue: 'IN_PROGRESS',
        newValue: 'IN_REVIEW',
        formattedMessage: 'Ravi moved Task #303 from In Progress → In Review',
        createdAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
      },
      {
        id: 'act-5',
        taskId: t6.id,
        projectId: proj1.id,
        userId: devAlex.id,
        actionType: 'STATUS_CHANGE',
        oldValue: 'TODO',
        newValue: 'IN_PROGRESS',
        formattedMessage: 'Alex moved Task #106 from To Do → In Progress',
        createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'act-6',
        taskId: t4.id,
        projectId: proj1.id,
        userId: devElena.id,
        actionType: 'STATUS_CHANGE',
        oldValue: 'IN_REVIEW',
        newValue: 'DONE',
        formattedMessage: 'Elena moved Task #104 from In Review → Done',
        createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'act-7',
        taskId: t7.id,
        projectId: proj2.id,
        userId: admin.id,
        actionType: 'OVERDUE_FLAGGED',
        oldValue: 'false',
        newValue: 'true',
        formattedMessage: 'System background scheduler flagged Task #201 as Overdue',
        createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'act-8',
        taskId: t2.id,
        projectId: proj1.id,
        userId: admin.id,
        actionType: 'OVERDUE_FLAGGED',
        oldValue: 'false',
        newValue: 'true',
        formattedMessage: 'System background scheduler flagged Task #102 as Overdue',
        createdAt: new Date(now.getTime() - 9 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'act-9',
        taskId: t1.id,
        projectId: proj1.id,
        userId: pmSarah.id,
        actionType: 'ASSIGNMENT',
        oldValue: 'unassigned',
        newValue: 'Ravi Kumar',
        formattedMessage: 'Sarah Jenkins assigned Task #101 to Ravi Kumar',
        createdAt: new Date(now.getTime() - 14 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'act-10',
        taskId: t7.id,
        projectId: proj2.id,
        userId: pmMarcus.id,
        actionType: 'ASSIGNMENT',
        oldValue: 'unassigned',
        newValue: 'Elena Rostova',
        formattedMessage: 'Marcus Vance assigned Task #201 to Elena Rostova',
        createdAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
      },
    ];

    // Seed Notifications
    const notifs: NotificationRecord[] = [
      {
        id: 'notif-1',
        userId: devRavi.id,
        taskId: t1.id,
        title: 'New Task Assigned',
        message: 'Sarah Jenkins assigned you to "Implement WebSocket depth-of-book orderbook ticker".',
        isRead: false,
        createdAt: new Date(now.getTime() - 14 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif-2',
        userId: pmSarah.id,
        taskId: t2.id,
        title: 'Task Ready for Review',
        message: 'Ravi Kumar moved Task #102 "Multi-factor biometric authentication handshake" to In Review.',
        isRead: false,
        createdAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif-3',
        userId: pmMarcus.id,
        taskId: t8.id,
        title: 'Task Ready for Review',
        message: 'Priya Patel moved Task #202 "Patient digital consent e-signature widget" to In Review.',
        isRead: false,
        createdAt: new Date(now.getTime() - 42 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif-4',
        userId: devElena.id,
        taskId: t7.id,
        title: 'Task Overdue Alert',
        message: 'Task #201 "HIPAA end-to-end encrypted video consultation room" is past its due date.',
        isRead: false,
        createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif-5',
        userId: devRavi.id,
        taskId: t2.id,
        title: 'Task Overdue Alert',
        message: 'Task #102 "Multi-factor biometric authentication handshake" is past its due date.',
        isRead: true,
        createdAt: new Date(now.getTime() - 9 * 60 * 60 * 1000).toISOString(),
      },
    ];

    notifs.forEach((n) => this.notifications.set(n.id, n));
  }
}

export const db = new DatabaseStore();
