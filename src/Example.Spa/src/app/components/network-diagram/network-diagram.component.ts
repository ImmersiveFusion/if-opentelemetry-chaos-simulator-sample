import { Component, EventEmitter, Input, OnInit, Output, OnChanges, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { networkDiagramAnimations } from './network-diagram.animations';

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
// Based on viewBox="0 0 800 600" - aligned with HTML node positions
const NODE_POSITIONS: { [key: string]: { x: number; y: number } } = {
  'client': { x: 80, y: 250 },   // Left side (10%), middle (35%)
  'api': { x: 400, y: 250 },     // Center (50%), same height as client (35%)
  'sql': { x: 720, y: 170 },     // Right side (90%), above API (20%)
  'redis': { x: 720, y: 350 },   // Right side (90%), below API (50%)
  'message-broker': { x: 720, y: 70 },   // Right side (90%), top (-1%)
  'message-worker': { x: 400, y: 30 },   // Center (50%), top (-14%)
  'otel': { x: 400, y: 400 },    // Center (50%), below API (60%)
  'immersive-apm': { x: 280, y: 530 },  // Left-center (35%), bottom (85%)
  'others': { x: 520, y: 530 }          // Right-center (65%), bottom (85%)
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
  @Output() executeFlow = new EventEmitter<string>();
  @Output() logMessage = new EventEmitter<string>();

  @ViewChild('diagramContainer') diagramContainer!: ElementRef<HTMLDivElement>;

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
    this.executeFlow.emit(resource);
    this.startFlowAnimation(resource);
  }

  private async startFlowAnimation(resource: string): Promise<void> {
    const targetConnection = this.connections.find(c => c.resource === resource);
    if (!targetConnection) return;

    const isBroken = targetConnection.status === 'broken';

    this.currentFlow = {
      id: Date.now().toString(),
      resource,
      status: 'traveling-to-api',
      progress: 0
    };

    // Step 1: Client pulses briefly
    this.setNodeStatus('client', 'processing');
    await this.delay(100);

    // Step 2: Travel to API - initialize position BEFORE making visible
    this.requestDotPosition = { fromNode: 'client', toNode: 'api', progress: 0 };
    this.requestDotClass = '';
    this.requestDotVisible = true;
    this.cdr.detectChanges();
    this.setNodeStatus('client', 'idle'); // Stop pulsing once dot starts moving
    await this.animateDot('client', 'api', 400);
    this.setNodeStatus('api', 'processing');

    await this.delay(300);

    // Step 3: Travel to target
    this.currentFlow!.status = 'traveling-to-target';
    const targetNodeId = resource === 'sql' ? 'sql' : 'redis';

    if (isBroken) {
      // Animate partially then explode
      await this.animateDot('api', targetNodeId, 300, 0.6);
      this.setNodeStatus('api', 'error');

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
      await this.animateDot(targetNodeId, 'api', 400);
      this.setNodeStatus(targetNodeId, 'idle');

      // Send telemetry when request completes at API (fire and forget)
      this.animateTelemetry();

      await this.animateDot('api', 'client', 400);
      this.setNodeStatus('client', 'success');
      await this.delay(300);

      this.currentFlow!.status = 'success';
      this.setNodeStatus('client', 'idle');
      this.requestDotVisible = false;
    }

    this.currentFlow = null;
    this.isAnimating = false;
  }

  private async animateTelemetry(): Promise<void> {
    this.telemetryDotProgress = 0;
    this.telemetryDotVisible = true;
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

    // Fire dots to Immersive APM and Others in parallel
    this.animateToImmersiveApm();
    this.animateToOthers();

    await this.delay(400);
    this.setNodeStatus('otel', 'idle');
    this.cdr.detectChanges();
  }

  private async animateToImmersiveApm(): Promise<void> {
    this.immersiveApmDotProgress = 0;
    this.immersiveApmDotVisible = true;
    this.cdr.detectChanges();

    const steps = 20;
    const stepDuration = 300 / steps;

    for (let i = 0; i <= steps; i++) {
      this.immersiveApmDotProgress = i / steps;
      this.cdr.detectChanges();
      await this.delay(stepDuration);
    }

    this.setNodeStatus('immersive-apm', 'processing');
    await this.delay(300);
    this.immersiveApmDotVisible = false;
    this.setNodeStatus('immersive-apm', 'idle');
    this.cdr.detectChanges();
  }

  private async animateToOthers(): Promise<void> {
    this.othersDotProgress = 0;
    this.othersDotVisible = true;
    this.cdr.detectChanges();

    const steps = 20;
    const stepDuration = 300 / steps;

    for (let i = 0; i <= steps; i++) {
      this.othersDotProgress = i / steps;
      this.cdr.detectChanges();
      await this.delay(stepDuration);
    }

    this.setNodeStatus('others', 'processing');
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

  // Get SVG position for telemetry dot
  getTelemetryDotSvgPosition(): { x: number; y: number } {
    const from = NODE_POSITIONS['api'];
    const to = NODE_POSITIONS['otel'];

    return {
      x: from.x + (to.x - from.x) * this.telemetryDotProgress,
      y: from.y + (to.y - from.y) * this.telemetryDotProgress
    };
  }

  // Get SVG position for Immersive APM dot
  getImmersiveApmDotSvgPosition(): { x: number; y: number } {
    const from = NODE_POSITIONS['otel'];
    const to = NODE_POSITIONS['immersive-apm'];

    return {
      x: from.x + (to.x - from.x) * this.immersiveApmDotProgress,
      y: from.y + (to.y - from.y) * this.immersiveApmDotProgress
    };
  }

  // Get SVG position for Others dot
  getOthersDotSvgPosition(): { x: number; y: number } {
    const from = NODE_POSITIONS['otel'];
    const to = NODE_POSITIONS['others'];

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
    // Path: M 720 170 Q 620 320 400 400 (matches HTML)
    const start = { x: 720, y: 170 };
    const control = { x: 620, y: 320 };
    const end = { x: 400, y: 400 };
    return this.getQuadraticBezierPosition(start, control, end, this.sqlTelemetryDotProgress);
  }

  // Get SVG position for Redis telemetry dot (along curved path)
  getRedisTelemetryDotSvgPosition(): { x: number; y: number } {
    // Path: M 720 350 Q 600 400 400 400 (matches HTML)
    const start = { x: 720, y: 350 };
    const control = { x: 600, y: 400 };
    const end = { x: 400, y: 400 };
    return this.getQuadraticBezierPosition(start, control, end, this.redisTelemetryDotProgress);
  }

  // Animate telemetry from SQL to OpenTelemetry
  private async animateSqlTelemetry(): Promise<void> {
    if (!this.showOptionalCapabilities) return;

    this.sqlTelemetryDotProgress = 0;
    this.sqlTelemetryDotVisible = true;
    this.cdr.detectChanges();

    const steps = 20;
    const stepDuration = 350 / steps;

    for (let i = 0; i <= steps; i++) {
      this.sqlTelemetryDotProgress = i / steps;
      this.cdr.detectChanges();
      await this.delay(stepDuration);
    }

    this.sqlTelemetryDotVisible = false;

    // When SQL telemetry reaches OpenTelemetry, forward to APM destinations
    this.setNodeStatus('otel', 'processing');
    this.animateToImmersiveApm();
    this.animateToOthers();
    await this.delay(400);
    this.setNodeStatus('otel', 'idle');
    this.cdr.detectChanges();
  }

  // Animate telemetry from Redis to OpenTelemetry
  private async animateRedisTelemetry(): Promise<void> {
    if (!this.showOptionalCapabilities) return;

    this.redisTelemetryDotProgress = 0;
    this.redisTelemetryDotVisible = true;
    this.cdr.detectChanges();

    const steps = 20;
    const stepDuration = 350 / steps;

    for (let i = 0; i <= steps; i++) {
      this.redisTelemetryDotProgress = i / steps;
      this.cdr.detectChanges();
      await this.delay(stepDuration);
    }

    this.redisTelemetryDotVisible = false;

    // When Redis telemetry reaches OpenTelemetry, forward to APM destinations
    this.setNodeStatus('otel', 'processing');
    this.animateToImmersiveApm();
    this.animateToOthers();
    await this.delay(400);
    this.setNodeStatus('otel', 'idle');
    this.cdr.detectChanges();
  }
}
