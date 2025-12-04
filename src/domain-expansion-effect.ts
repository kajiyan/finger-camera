/**
 * Domain Expansion Effect - 領域展開「無量空処」
 * Dramatic ink splatter and visual effects inspired by Jujutsu Kaisen
 */

import { Point2D } from './hand-tracker';

// Ink particle class
interface InkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'splatter' | 'drop' | 'streak';
}

// Burst line for dramatic effect
interface BurstLine {
  angle: number;
  length: number;
  targetLength: number;
  width: number;
  opacity: number;
  speed: number;
}

// Floating text element
interface FloatingText {
  text: string;
  x: number;
  y: number;
  targetY: number;
  opacity: number;
  scale: number;
  targetScale: number;
}

export class DomainExpansionEffect {
  private particles: InkParticle[] = [];
  private burstLines: BurstLine[] = [];
  private floatingTexts: FloatingText[] = [];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Effect state
  private isActive = false;
  private effectStartTime = 0;
  private flashOpacity = 0;
  private shakeIntensity = 0;
  private shakeOffset = { x: 0, y: 0 };

  // Colors for ink effect (dark purple/black theme)
  private inkColors = [
    '#0a0a0a',      // Near black
    '#1a0a2e',      // Dark purple
    '#2d1b4e',      // Purple
    '#4a1a6b',      // Violet
    '#16213e',      // Dark blue
    '#0f3460',      // Navy
  ];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  /**
   * Trigger the domain expansion effect
   */
  trigger(centerPoint: Point2D): void {
    if (this.isActive) return;

    this.isActive = true;
    this.effectStartTime = performance.now();

    // Convert normalized coordinates to canvas coordinates
    const centerX = (1 - centerPoint.x) * this.canvas.width; // Mirror X
    const centerY = centerPoint.y * this.canvas.height;

    console.log('[DomainExpansion] TRIGGERED at', centerX, centerY);

    // Initial flash
    this.flashOpacity = 1;

    // Screen shake
    this.shakeIntensity = 20;

    // Create burst lines
    this.createBurstLines(centerX, centerY);

    // Create ink particles in waves
    this.createInkWave(centerX, centerY, 0);
    setTimeout(() => this.createInkWave(centerX, centerY, 1), 100);
    setTimeout(() => this.createInkWave(centerX, centerY, 2), 200);
    setTimeout(() => this.createInkWave(centerX, centerY, 3), 350);

    // Create floating text
    setTimeout(() => {
      this.createFloatingText('領域展開', this.canvas.width / 2, this.canvas.height / 2 - 100);
    }, 300);

    setTimeout(() => {
      this.createFloatingText('無量空処', this.canvas.width / 2, this.canvas.height / 2 + 50);
    }, 600);
  }

  private createBurstLines(_centerX: number, _centerY: number): void {
    const numLines = 24;
    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2;
      this.burstLines.push({
        angle,
        length: 0,
        targetLength: 300 + Math.random() * 400,
        width: 2 + Math.random() * 4,
        opacity: 1,
        speed: 15 + Math.random() * 10,
      });
    }
  }

  private createInkWave(centerX: number, centerY: number, waveIndex: number): void {
    const numParticles = 60 - waveIndex * 10;
    const baseSpeed = 8 + waveIndex * 3;

    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = baseSpeed + Math.random() * 12;
      const type = Math.random() < 0.3 ? 'streak' : (Math.random() < 0.5 ? 'drop' : 'splatter');

      this.particles.push({
        x: centerX + (Math.random() - 0.5) * 50,
        y: centerY + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: type === 'streak' ? 3 + Math.random() * 5 : 10 + Math.random() * 30,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        opacity: 0.7 + Math.random() * 0.3,
        color: this.inkColors[Math.floor(Math.random() * this.inkColors.length)],
        life: 0,
        maxLife: 80 + Math.random() * 60,
        type,
      });
    }
  }

  private createFloatingText(text: string, x: number, y: number): void {
    this.floatingTexts.push({
      text,
      x,
      y: y + 50,
      targetY: y,
      opacity: 0,
      scale: 0.5,
      targetScale: 1,
    });
  }

  /**
   * Update effect state (call every frame)
   */
  update(): void {
    if (!this.isActive && this.particles.length === 0 && this.burstLines.length === 0 && this.floatingTexts.length === 0) {
      return;
    }

    // Update flash
    this.flashOpacity *= 0.9;
    if (this.flashOpacity < 0.01) this.flashOpacity = 0;

    // Update shake
    this.shakeIntensity *= 0.92;
    if (this.shakeIntensity > 0.1) {
      this.shakeOffset = {
        x: (Math.random() - 0.5) * this.shakeIntensity * 2,
        y: (Math.random() - 0.5) * this.shakeIntensity * 2,
      };
    } else {
      this.shakeOffset = { x: 0, y: 0 };
      this.shakeIntensity = 0;
    }

    // Update burst lines
    for (let i = this.burstLines.length - 1; i >= 0; i--) {
      const line = this.burstLines[i];
      line.length += line.speed;
      if (line.length >= line.targetLength) {
        line.opacity -= 0.03;
        if (line.opacity <= 0) {
          this.burstLines.splice(i, 1);
        }
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Physics
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.vy += 0.15; // Gravity
      p.rotation += p.rotationSpeed;
      p.life++;

      // Fade out
      if (p.life > p.maxLife * 0.6) {
        p.opacity *= 0.96;
      }

      // Remove dead particles
      if (p.life >= p.maxLife || p.opacity < 0.01) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating texts
    const age = performance.now() - this.effectStartTime;
    const isFadingOut = age > 2000;

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const text = this.floatingTexts[i];

      // Animate position and scale
      text.y += (text.targetY - text.y) * 0.1;
      text.scale += (text.targetScale - text.scale) * 0.1;

      if (isFadingOut) {
        // Fade out phase - only decrease opacity
        text.opacity -= 0.03;
        if (text.opacity <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      } else {
        // Fade in phase - increase opacity toward 1
        text.opacity += (1 - text.opacity) * 0.08;
      }
    }

    // Check if effect is complete
    if (age > 3000 && this.particles.length === 0 && this.burstLines.length === 0 && this.floatingTexts.length === 0) {
      this.isActive = false;
    }
  }

  /**
   * Render the effect
   */
  render(): void {
    if (!this.isActive && this.particles.length === 0 && this.burstLines.length === 0 && this.flashOpacity === 0) {
      return;
    }

    this.ctx.save();

    // Apply screen shake
    if (this.shakeIntensity > 0) {
      this.ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
    }

    // Draw burst lines (from center)
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    for (const line of this.burstLines) {
      this.ctx.save();
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${line.opacity * 0.8})`;
      this.ctx.lineWidth = line.width;
      this.ctx.lineCap = 'round';

      const startDist = Math.max(0, line.length - 100);
      const startX = centerX + Math.cos(line.angle) * startDist;
      const startY = centerY + Math.sin(line.angle) * startDist;
      const endX = centerX + Math.cos(line.angle) * line.length;
      const endY = centerY + Math.sin(line.angle) * line.length;

      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Draw ink particles
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      this.ctx.globalAlpha = p.opacity;

      if (p.type === 'splatter') {
        this.drawSplatter(p);
      } else if (p.type === 'drop') {
        this.drawDrop(p);
      } else {
        this.drawStreak(p);
      }

      this.ctx.restore();
    }

    // Draw floating text
    for (const text of this.floatingTexts) {
      this.ctx.save();
      this.ctx.translate(text.x, text.y);
      this.ctx.scale(text.scale, text.scale);
      this.ctx.globalAlpha = text.opacity;

      // Text shadow/glow
      this.ctx.shadowColor = '#4a1a6b';
      this.ctx.shadowBlur = 30;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;

      this.ctx.font = 'bold 72px "Hiragino Mincho ProN", "Yu Mincho", serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(text.text, 0, 0);

      // Outline
      this.ctx.strokeStyle = '#1a0a2e';
      this.ctx.lineWidth = 2;
      this.ctx.strokeText(text.text, 0, 0);

      this.ctx.restore();
    }

    // Screen flash
    if (this.flashOpacity > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashOpacity * 0.7})`;
      this.ctx.fillRect(-50, -50, this.canvas.width + 100, this.canvas.height + 100);
    }

    // Vignette effect during active effect
    if (this.isActive) {
      const gradient = this.ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, Math.max(this.canvas.width, this.canvas.height) * 0.7
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.7, 'rgba(26, 10, 46, 0.3)');
      gradient.addColorStop(1, 'rgba(10, 10, 10, 0.6)');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.ctx.restore();
  }

  private drawSplatter(p: InkParticle): void {
    this.ctx.fillStyle = p.color;

    // Draw irregular splatter shape
    this.ctx.beginPath();
    const points = 7 + Math.floor(Math.random() * 4);
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = p.size * (0.5 + Math.random() * 0.5);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();

    // Add some small droplets around
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = p.size * (0.8 + Math.random() * 0.5);
      const dropSize = 2 + Math.random() * 4;
      this.ctx.beginPath();
      this.ctx.arc(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        dropSize,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }
  }

  private drawDrop(p: InkParticle): void {
    this.ctx.fillStyle = p.color;

    // Teardrop shape
    this.ctx.beginPath();
    this.ctx.moveTo(0, -p.size);
    this.ctx.quadraticCurveTo(p.size * 0.6, 0, 0, p.size * 0.5);
    this.ctx.quadraticCurveTo(-p.size * 0.6, 0, 0, -p.size);
    this.ctx.fill();
  }

  private drawStreak(p: InkParticle): void {
    this.ctx.fillStyle = p.color;

    // Elongated streak
    const length = p.size * 3;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, p.size, length, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Get the current shake offset for applying to other canvases
   */
  getShakeOffset(): { x: number; y: number } {
    return this.shakeOffset;
  }

  /**
   * Check if effect is currently active
   */
  isEffectActive(): boolean {
    return this.isActive || this.particles.length > 0 || this.burstLines.length > 0 || this.flashOpacity > 0;
  }

  /**
   * Check if effect can be triggered (cooldown check)
   */
  canTrigger(): boolean {
    return !this.isActive;
  }
}
