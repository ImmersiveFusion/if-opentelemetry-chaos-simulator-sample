import { Component, EventEmitter, Input, OnInit, Output, OnChanges, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { networkDiagramAnimations } from './network-diagram.animations';
import { SQL_SCENARIOS, REDIS_SCENARIOS, FlowScenario, SqlScenario, RedisScenario } from '../../services/flow.service';

export interface FlowRequest {
  resource: string;
  scenario: string;
}

export interface NetworkNode {
  id: string;
  type: 'client' | 'api' | 'database' | 'cache' | 'telemetry' | 'message-broker' | 'message-worker';
  label: string;
  icon: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  comingSoon?: boolean;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  resource: string;
  status: 'healthy' | 'broken';
}

export interface RequestFlow {
  id: string;
  resource: string;
  status: 'idle' | 'traveling-to-api' | 'processing' | 'traveling-to-target' | 'returning' | 'success' | 'error';
  progress: number;
}

// SVG coordinate positions for each node (matches SVG line endpoints)
// Based on viewBox="0 0 800 650" - aligned with HTML node positions
const NODE_POSITIONS: { [key: string]: { x: number; y: number } } = {
  'client': { x: 80, y: 250 },   // Left side (10%), middle
  'api': { x: 400, y: 250 },     // Center (50%), same height as client
  'sql': { x: 720, y: 220 },     // Right side (90%), above API
  'redis': { x: 720, y: 350 },   // Right side (90%), below API
  'message-broker': { x: 720, y: 100 },   // Right side (90%), top
  'message-worker': { x: 400, y: 100 },   // Center (50%), top
  'otel': { x: 400, y: 520 },    // Center (50%), below API - matches line endpoint
  'immersive-apm': { x: 280, y: 590 },  // Left-center (35%), bottom
  'others': { x: 520, y: 590 }          // Right-center (65%), bottom
};

@Component({
  selector: 'app-network-diagram',
  templateUrl: './network-diagram.component.html',
  styleUrls: ['./network-diagram.component.scss'],
  animations: networkDiagramAnimations,
  standalone: false
})
export class NetworkDiagramComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() resources: { [id: string]: boolean } = {};
  @Output() connectionToggle = new EventEmitter<string>();
  @Output() executeFlow = new EventEmitter<FlowRequest>();
  @Output() logMessage = new EventEmitter<string>();

  @ViewChild('diagramContainer') diagramContainer!: ElementRef<HTMLDivElement>;

  // Scenario configuration
  sqlScenarios: FlowScenario[] = SQL_SCENARIOS;
  redisScenarios: FlowScenario[] = REDIS_SCENARIOS;
  selectedSqlScenario: SqlScenario = 'success';
  selectedRedisScenario: RedisScenario = 'success';
  sqlExpanded = false;
  redisExpanded = false;

  // Nodes
  nodes: NetworkNode[] = [
    { id: 'client', type: 'client', label: 'Client', icon: 'fa-user', status: 'idle' },
    { id: 'api', type: 'api', label: 'API', icon: 'fa-server', status: 'idle' },
    { id: 'sql', type: 'database', label: 'SQL Database', icon: 'fa-database', status: 'idle' },
    { id: 'redis', type: 'cache', label: 'Redis Cache', icon: 'fa-bolt', status: 'idle' },
    { id: 'message-broker', type: 'message-broker', label: 'Message Broker', icon: 'fa-exchange-alt', status: 'idle', comingSoon: true },
    { id: 'message-worker', type: 'message-worker', label: 'Worker', icon: 'fa-cogs', status: 'idle', comingSoon: true },
    { id: 'otel', type: 'telemetry', label: 'OpenTelemetry', icon: 'fa-chart-line', status: 'idle' },
    { id: 'immersive-apm', type: 'telemetry', label: 'Immersive APM', icon: 'fa-wave-square', status: 'idle' },
    { id: 'others', type: 'telemetry', label: 'Others', icon: 'fa-ellipsis-h', status: 'idle' }
  ];

  // Connections
  connections: Connection[] = [
    { id: 'client-api', from: 'client', to: 'api', resource: 'api', status: 'healthy' },
    { id: 'api-sql', from: 'api', to: 'sql', resource: 'sql', status: 'healthy' },
    { id: 'api-redis', from: 'api', to: 'redis', resource: 'redis', status: 'healthy' },
    { id: 'api-otel', from: 'api', to: 'otel', resource: 'otel', status: 'healthy' },
    { id: 'otel-immersive', from: 'otel', to: 'immersive-apm', resource: 'immersive-apm', status: 'healthy' },
    { id: 'otel-others', from: 'otel', to: 'others', resource: 'others', status: 'healthy' }
  ];

  // Current request flow state
  currentFlow: RequestFlow | null = null;
  showExplosion = false;
  explosionNodeId = '';

  // Visibility toggles
  showOptionalCapabilities = false;
  showComingSoon = false;

  // Animation state
  isAnimating = false;

  // Fullscreen state
  isFullscreen = false;

  // Request dot animation
  requestDotVisible = false;
  requestDotPosition = { fromNode: '', toNode: '', progress: 0 };
  requestDotClass = '';

  // Telemetry animation state
  telemetryDotVisible = false;
  telemetryDotProgress = 0;

  // APM dots animation state (from OpenTelemetry to destinations)
  immersiveApmDotVisible = false;
  immersiveApmDotProgress = 0;
  othersDotVisible = false;
  othersDotProgress = 0;

  // Optional telemetry dots (SQL and Redis to OpenTelemetry)
  sqlTelemetryDotVisible = false;
  sqlTelemetryDotProgress = 0;
  redisTelemetryDotVisible = false;
  redisTelemetryDotProgress = 0;

  // Status ticker - messages stack horizontally and linger
  statusMessages: { id: number; text: string; type: 'request' | 'telemetry'; step: number }[] = [];
  private messageIdCounter = 0;
  private stepCounter = 0;
  private lastDisappearTime = 0; // Track when the last message is scheduled to disappear

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.syncConnectionStates();
  }

  ngAfterViewInit(): void {
    // DOM is ready
  }

  ngOnChanges(): void {
    this.syncConnectionStates();
  }

  private syncConnectionStates(): void {
    this.connections.forEach(conn => {
      if (conn.resource === 'sql' || conn.resource === 'redis') {
        conn.status = this.resources[conn.resource] ? 'broken' : 'healthy';
      }
    });
  }

  getNode(id: string): NetworkNode | undefined {
    return this.nodes.find(n => n.id === id);
  }

  getConnection(id: string): Connection | undefined {
    return this.connections.find(c => c.id === id);
  }

  getConnectionForResource(resource: string): Connection | undefined {
    return this.connections.find(c => c.resource === resource);
  }

  onConnectionClick(connection: Connection): void {
    console.log('Connection clicked:', connection);
    if (this.isAnimating) return;
    if (connection.resource === 'api' || connection.resource === 'otel') return;

    console.log('Emitting connectionToggle for:', connection.resource);
    this.connectionToggle.emit(connection.resource);
  }

  onSendRequest(resource: string): void {
    if (this.isAnimating || this.currentFlow) return;

    this.isAnimating = true;
    const scenario = resource === 'sql' ? this.selectedSqlScenario : this.selectedRedisScenario;
    this.executeFlow.emit({ resource, scenario });
    this.startFlowAnimation(resource);
  }

  toggleSqlExpanded(): void {
    this.sqlExpanded = !this.sqlExpanded;
  }

  toggleRedisExpanded(): void {
    this.redisExpanded = !this.redisExpanded;
  }

  getSelectedScenario(resource: string): FlowScenario | undefined {
    if (resource === 'sql') {
      return this.sqlScenarios.find(s => s.id === this.selectedSqlScenario);
    } else {
      return this.redisScenarios.find(s => s.id === this.selectedRedisScenario);
    }
  }

  getSelectedScenarioLabel(resource: string): string {
    const scenario = this.getSelectedScenario(resource);
    return scenario?.label || 'Roundtrip';
  }

  getClientNodeHeight(): number {
    const baseHeight = 100; // Header section
    const sqlHeight = this.sqlExpanded ? 140 : 65; // Expanded vs collapsed
    const redisHeight = this.redisExpanded ? 160 : 65; // Redis has more options
    return baseHeight + sqlHeight + redisHeight;
  }

  private addStatusMessage(text: string, type: 'request' | 'telemetry' = 'request'): void {
    const id = ++this.messageIdCounter;
    const step = ++this.stepCounter;
    this.statusMessages.push({ id, text, type, step });
    this.cdr.detectChanges();

    // Sequential disappearance - each message disappears 800ms after the previous one
    const now = Date.now();
    const baseDelay = 1500; // Minimum time a message stays visible
    const staggerDelay = 800; // Time between each message disappearing

    // Schedule this message to disappear after the last one, or after baseDelay if first
    const disappearTime = Math.max(now + baseDelay, this.lastDisappearTime + staggerDelay);
    this.lastDisappearTime = disappearTime;

    const delay = disappearTime - now;
    setTimeout(() => {
      this.statusMessages = this.statusMessages.filter(m => m.id !== id);
      this.cdr.detectChanges();
    }, delay);
  }

  private resetStepCounters(): void {
    this.stepCounter = 0;
  }

  get requestMessages() {
    return this.statusMessages.filter(m => m.type === 'request');
  }

  get telemetryMessages() {
    return this.statusMessages.filter(m => m.type === 'telemetry');
  }

  private async startFlowAnimation(resource: string): Promise<void> {
    const targetConnection = this.connections.find(c => c.resource === resource);
    if (!targetConnection) return;

    const isBroken = targetConnection.status === 'broken';
    const targetLabel = resource === 'sql' ? 'SQL Database' : 'Redis Cache';

    // Reset step counters for new animation
    this.resetStepCounters();

    this.currentFlow = {
      id: Date.now().toString(),
      resource,
      status: 'traveling-to-api',
      progress: 0
    };

    // Step 1: Client pulses briefly
    this.setNodeStatus('client', 'processing');
    this.addStatusMessage('Sending request to API', 'request');
    await this.delay(100);

    // Step 2: Travel to API - initialize position BEFORE making visible
    this.requestDotPosition = { fromNode: 'client', toNode: 'api', progress: 0 };
    this.requestDotClass = '';
    this.requestDotVisible = true;
    this.cdr.detectChanges();
    this.setNodeStatus('client', 'idle'); // Stop pulsing once dot starts moving
    await this.animateDot('client', 'api', 400);
    this.setNodeStatus('api', 'processing');
    this.addStatusMessage('API processing request', 'request');

    await this.delay(300);

    // Step 3: Travel to target
    this.currentFlow!.status = 'traveling-to-target';
    const targetNodeId = resource === 'sql' ? 'sql' : 'redis';
    this.addStatusMessage(`API querying ${targetLabel}`, 'request');

    if (isBroken) {
      // Animate partially then explode
      await this.animateDot('api', targetNodeId, 300, 0.6);
      this.setNodeStatus('api', 'error');
      this.addStatusMessage(`Connection to ${targetLabel} failed!`, 'request');

      // Show explosion
      this.requestDotClass = 'dot-error';
      this.showExplosion = true;
      this.explosionNodeId = targetNodeId;
      this.cdr.detectChanges();
      await this.delay(400);
      this.showExplosion = false;
      this.requestDotVisible = false;
      this.cdr.detectChanges();

      // Error state
      this.currentFlow!.status = 'error';
      this.setNodeStatus('api', 'error');
      await this.delay(300);
      this.setNodeStatus('client', 'error');
      this.addStatusMessage('Error returned to client', 'request');

      // Send telemetry on error (fire and forget)
      this.animateTelemetry();

      await this.delay(500);

      // Reset
      this.setNodeStatus('api', 'idle');
      this.setNodeStatus('client', 'idle');
    } else {
      // Success path
      await this.animateDot('api', targetNodeId, 400);
      this.setNodeStatus('api', 'idle');
      this.setNodeStatus(targetNodeId, 'success');
      this.addStatusMessage(`${targetLabel} responding`, 'request');

      // Fire optional telemetry from the target node (SQL or Redis) to OpenTelemetry
      if (resource === 'sql') {
        this.animateSqlTelemetry();
      } else if (resource === 'redis') {
        this.animateRedisTelemetry();
      }

      await this.delay(200);

      // Return journey
      this.currentFlow!.status = 'returning';
      this.requestDotClass = 'dot-success';
      this.addStatusMessage(`${targetLabel} returning data`, 'request');
      await this.animateDot(targetNodeId, 'api', 400);
      this.setNodeStatus(targetNodeId, 'idle');

      // Send telemetry when request completes at API (fire and forget)
      this.animateTelemetry();

      this.addStatusMessage('API responding to client', 'request');
      await this.animateDot('api', 'client', 400);
      this.setNodeStatus('client', 'success');
      this.addStatusMessage('Request completed', 'request');
      await this.delay(300);

      this.currentFlow!.status = 'success';
      this.setNodeStatus('client', 'idle');
      this.requestDotVisible = false;
    }

    this.currentFlow = null;
    this.isAnimating = false;
  }

  private async animateTelemetry(source: string = 'API'): Promise<void> {
    this.telemetryDotProgress = 0;
    this.telemetryDotVisible = true;
    this.addStatusMessage(`${source} sending telemetry to OTel`, 'telemetry');
    this.cdr.detectChanges();

    const steps = 20;
    const stepDuration = 400 / steps;

    for (let i = 0; i <= steps; i++) {
      this.telemetryDotProgress = i / steps;
      this.cdr.detectChanges();
      await this.delay(stepDuration);
    }

    this.setNodeStatus('otel', 'processing');
    this.telemetryDotVisible = false;
    this.addStatusMessage(`OTel processing ${source} traces`, 'telemetry');

    // Fire dots to Immersive APM and Others in parallel
    this.animateToImmersiveApm(source);
    this.animateToOthers(source);

    await this.delay(400);
    this.setNodeStatus('otel', 'idle');
    this.cdr.detectChanges();
  }

  private async animateToImmersiveApm(source: string = 'API'): Promise<void> {
    this.immersiveApmDotProgress = 0;
    this.immersiveApmDotVisible = true;
    this.addStatusMessage(`Exporting ${source} traces to IAPM`, 'telemetry');
    this.cdr.detectChanges();

    const steps = 20;
    const stepDuration = 300 / steps;

    for (let i = 0; i <= steps; i++) {
      this.immersiveApmDotProgress = i / steps;
      this.cdr.detectChanges();
      await this.delay(stepDuration);
    }

    this.setNodeStatus('immersive-apm', 'processing');
    this.addStatusMessage(`IAPM received ${source} traces`, 'telemetry');
    await this.delay(300);
    this.immersiveApmDotVisible = false;
    this.setNodeStatus('immersive-apm', 'idle');
    this.cdr.detectChanges();
  }

  private async animateToOthers(source: string = 'API'): Promise<void> {
    this.othersDotProgress = 0;
    this.othersDotVisible = true;
    this.addStatusMessage(`Exporting ${source} traces to Others`, 'telemetry');
    this.cdr.detectChanges();

    const steps = 20;
    const stepDuration = 300 / steps;

    for (let i = 0; i <= steps; i++) {
      this.othersDotProgress = i / steps;
      this.cdr.detectChanges();
      await this.delay(stepDuration);
    }

    this.setNodeStatus('others', 'processing');
    this.addStatusMessage(`Others received ${source} traces`, 'telemetry');
    await this.delay(300);
    this.othersDotVisible = false;
    this.setNodeStatus('others', 'idle');
    this.cdr.detectChanges();
  }

  private setNodeStatus(nodeId: string, status: 'idle' | 'processing' | 'success' | 'error'): void {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.status = status;
    }
  }

  private async animateDot(fromNodeId: string, toNodeId: string, duration: number, endProgress: number = 1): Promise<void> {
    const steps = 30;
    const stepDuration = duration / steps;

    for (let i = 0; i <= steps * endProgress; i++) {
      this.requestDotPosition = {
        fromNode: fromNodeId,
        toNode: toNodeId,
        progress: i / steps
      };
      this.cdr.detectChanges();
      await this.delay(stepDuration);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isBreakableConnection(connection: Connection): boolean {
    return connection.resource !== 'api' && connection.resource !== 'otel';
  }

  getNodeClass(node: NetworkNode): string {
    const classes = ['node', `node-${node.type}`];
    if (node.status !== 'idle') {
      classes.push(`status-${node.status}`);
    }
    return classes.join(' ');
  }

  getConnectionClass(connection: Connection): string {
    const classes = ['connection', `connection-${connection.status}`];
    if (this.isBreakableConnection(connection)) {
      classes.push('breakable');
    }
    return classes.join(' ');
  }

  // Get SVG position for request dot
  getRequestDotSvgPosition(): { x: number; y: number } {
    const { fromNode, toNode, progress } = this.requestDotPosition;

    const from = NODE_POSITIONS[fromNode] || { x: 80, y: 150 };
    const to = NODE_POSITIONS[toNode] || { x: 400, y: 150 };

    return {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress
    };
  }

  // Get SVG position for telemetry dot (follows line from API at y=300 to OTel at y=440)
  getTelemetryDotSvgPosition(): { x: number; y: number } {
    // Line: x1="400" y1="300" x2="400" y2="440"
    const from = { x: 400, y: 300 };
    const to = { x: 400, y: 440 };

    return {
      x: from.x + (to.x - from.x) * this.telemetryDotProgress,
      y: from.y + (to.y - from.y) * this.telemetryDotProgress
    };
  }

  // Get SVG position for Immersive APM dot (follows line from OTel at y=520 to IAPM at y=590)
  getImmersiveApmDotSvgPosition(): { x: number; y: number } {
    // Line: x1="400" y1="520" x2="280" y2="590"
    const from = { x: 400, y: 520 };
    const to = { x: 280, y: 590 };

    return {
      x: from.x + (to.x - from.x) * this.immersiveApmDotProgress,
      y: from.y + (to.y - from.y) * this.immersiveApmDotProgress
    };
  }

  // Get SVG position for Others dot (follows line from OTel at y=520 to Others at y=590)
  getOthersDotSvgPosition(): { x: number; y: number } {
    // Line: x1="400" y1="520" x2="520" y2="590"
    const from = { x: 400, y: 520 };
    const to = { x: 520, y: 590 };

    return {
      x: from.x + (to.x - from.x) * this.othersDotProgress,
      y: from.y + (to.y - from.y) * this.othersDotProgress
    };
  }

  // Calculate position along a quadratic bezier curve
  // P(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
  private getQuadraticBezierPosition(
    start: { x: number; y: number },
    control: { x: number; y: number },
    end: { x: number; y: number },
    t: number
  ): { x: number; y: number } {
    const oneMinusT = 1 - t;
    return {
      x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x,
      y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y
    };
  }

  // Get SVG position for SQL telemetry dot (along curved path)
  getSqlTelemetryDotSvgPosition(): { x: number; y: number } {
    // Path: M 720 220 Q 620 400 400 470 (matches HTML)
    const start = { x: 720, y: 220 };
    const control = { x: 620, y: 400 };
    const end = { x: 400, y: 470 };
    return this.getQuadraticBezierPosition(start, control, end, this.sqlTelemetryDotProgress);
  }

  // Get SVG position for Redis telemetry dot (along curved path)
  getRedisTelemetryDotSvgPosition(): { x: number; y: number } {
    // Path: M 720 350 Q 600 450 400 470 (matches HTML)
    const start = { x: 720, y: 350 };
    const control = { x: 600, y: 450 };
    const end = { x: 400, y: 470 };
    return this.getQuadraticBezierPosition(start, control, end, this.redisTelemetryDotProgress);
  }

  // Animate telemetry from SQL to OpenTelemetry
  private async animateSqlTelemetry(): Promise<void> {
    if (!this.showOptionalCapabilities) return;

    this.sqlTelemetryDotProgress = 0;
    this.sqlTelemetryDotVisible = true;
    this.addStatusMessage('SQL sending telemetry to OTel', 'telemetry');
    this.cdr.detectChanges();

    const steps = 20;
    const stepDuration = 350 / steps;

    for (let i = 0; i <= steps; i++) {
      this.sqlTelemetryDotProgress = i / steps;
      this.cdr.detectChanges();
      await this.delay(stepDuration);
    }

    this.sqlTelemetryDotVisible = false;
    this.addStatusMessage('OTel processing SQL traces', 'telemetry');

    // When SQL telemetry reaches OpenTelemetry, forward to APM destinations
    this.setNodeStatus('otel', 'processing');
    this.animateToImmersiveApm('SQL');
    this.animateToOthers('SQL');
    await this.delay(400);
    this.setNodeStatus('otel', 'idle');
    this.cdr.detectChanges();
  }

  // Animate telemetry from Redis to OpenTelemetry
  private async animateRedisTelemetry(): Promise<void> {
    if (!this.showOptionalCapabilities) return;

    this.redisTelemetryDotProgress = 0;
    this.redisTelemetryDotVisible = true;
    this.addStatusMessage('Redis sending telemetry to OTel', 'telemetry');
    this.cdr.detectChanges();

    const steps = 20;
    const stepDuration = 350 / steps;

    for (let i = 0; i <= steps; i++) {
      this.redisTelemetryDotProgress = i / steps;
      this.cdr.detectChanges();
      await this.delay(stepDuration);
    }

    this.redisTelemetryDotVisible = false;
    this.addStatusMessage('OTel processing Redis traces', 'telemetry');

    // When Redis telemetry reaches OpenTelemetry, forward to APM destinations
    this.setNodeStatus('otel', 'processing');
    this.animateToImmersiveApm('Redis');
    this.animateToOthers('Redis');
    await this.delay(400);
    this.setNodeStatus('otel', 'idle');
    this.cdr.detectChanges();
  }

  // Toggle fullscreen mode
  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;

    if (this.isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
}
