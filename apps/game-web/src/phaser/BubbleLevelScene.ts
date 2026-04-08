import Phaser from "phaser";

import type { GameSessionState } from "@bubble-kingdom/game-core";

export class BubbleLevelScene extends Phaser.Scene {
  private state: GameSessionState | null = null;

  private bubbleGroup?: Phaser.GameObjects.Container;

  private aimGraphics?: Phaser.GameObjects.Graphics;

  private background?: Phaser.GameObjects.Graphics;

  private shooterY = 680;

  private onPreview?: (angle: number) => void;

  private onShoot?: (angle: number) => void;

  constructor() {
    super("BubbleLevelScene");
  }

  create() {
    this.background = this.add.graphics();
    this.bubbleGroup = this.add.container(0, 0);
    this.aimGraphics = this.add.graphics();

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.state || this.state.currentScreen !== "level") {
        return;
      }
      const angle = Phaser.Math.Angle.Between(360, this.shooterY, pointer.x, pointer.y);
      this.onPreview?.(clampAngle(angle));
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.state || this.state.currentScreen !== "level") {
        return;
      }
      const angle = Phaser.Math.Angle.Between(360, this.shooterY, pointer.x, pointer.y);
      this.onShoot?.(clampAngle(angle));
    });
  }

  setInteractionCallbacks(callbacks: {
    onPreview: (angle: number) => void;
    onShoot: (angle: number) => void;
  }) {
    this.onPreview = callbacks.onPreview;
    this.onShoot = callbacks.onShoot;
  }

  setState(state: GameSessionState) {
    this.state = state;
    this.draw();
  }

  private draw() {
    if (!this.background || !this.bubbleGroup || !this.aimGraphics) {
      return;
    }

    this.background.clear();
    this.background.fillGradientStyle(0x15324f, 0x204d68, 0xf0c46c, 0xf7d884, 1);
    this.background.fillRect(0, 0, this.scale.width, this.scale.height);

    this.background.fillStyle(0xffffff, 0.18);
    this.background.fillCircle(80, 80, 46);
    this.background.fillStyle(0x4cbfb0, 0.22);
    this.background.fillCircle(640, 110, 62);
    this.background.fillStyle(0xc8568e, 0.18);
    this.background.fillCircle(110, 720, 84);

    this.bubbleGroup.removeAll(true);
    this.aimGraphics.clear();

    if (!this.state?.activeLevel) {
      return;
    }

    const board = this.state.activeLevel.board;
    const radius = 24;
    const stepX = radius * 2.1;
    const stepY = radius * 1.8;
    const originX = 100;
    const originY = 92;

    for (let row = 0; row < board.rows; row += 1) {
      for (let col = 0; col < board.cols; col += 1) {
        const cell = board.cells[row]?.[col];
        if (!cell) {
          continue;
        }
        const x = originX + col * stepX + (row % 2 === 0 ? 0 : radius);
        const y = originY + row * stepY;
        const circle = this.add.circle(x, y, radius, bubbleColor(cell.color));
        circle.setStrokeStyle(3, bubbleStroke(cell.kind), 0.9);
        this.bubbleGroup.add(circle);

        if (cell.kind !== "normal") {
          const label = this.add
            .text(x, y, bubbleLabel(cell.kind), {
              fontFamily: "Trebuchet MS",
              fontSize: "15px",
              color: "#173042",
            })
            .setOrigin(0.5);
          this.bubbleGroup.add(label);
        }
      }
    }

    const shooterBase = this.add.circle(360, this.shooterY + 20, 44, 0x204d68, 0.36);
    const current = board.queue[0];
    const shotBubble = this.add.circle(360, this.shooterY, 24, queueBubbleColor(current));
    shotBubble.setStrokeStyle(4, 0xffffff, 0.95);
    const nextBubble = this.add.circle(430, this.shooterY + 6, 18, queueBubbleColor(board.queue[1]));
    nextBubble.setAlpha(0.8);
    this.bubbleGroup.add([shooterBase, shotBubble, nextBubble]);

    if (this.state.activeLevel.preview) {
      this.aimGraphics.lineStyle(6, 0xffffff, 0.55);
      const path = this.state.activeLevel.preview.path.map((point) => ({
        x: originX + point.x * 24,
        y: originY + point.y * 24,
      }));
      this.aimGraphics.beginPath();
      this.aimGraphics.moveTo(360, this.shooterY);
      for (const point of path) {
        this.aimGraphics.lineTo(point.x, point.y);
      }
      this.aimGraphics.strokePath();
    }
  }
}

function bubbleColor(color: string | null): number {
  switch (color) {
    case "ruby":
      return 0xff6a6c;
    case "sapphire":
      return 0x4f8fff;
    case "emerald":
      return 0x45c172;
    case "sun":
      return 0xf5c84a;
    case "amethyst":
      return 0xb86cff;
    case "aqua":
      return 0x53d8dd;
    default:
      return 0xe8edf2;
  }
}

function queueBubbleColor(color: string | undefined): number {
  if (color === "bomb") {
    return 0x30343f;
  }
  if (color === "line") {
    return 0xff8d3b;
  }
  if (color === "rainbow") {
    return 0xffffff;
  }
  return bubbleColor(color ?? null);
}

function bubbleStroke(kind: string): number {
  switch (kind) {
    case "stone":
      return 0x8c765a;
    case "ice":
      return 0xdff7ff;
    case "vine":
      return 0x2d7b48;
    case "fog":
      return 0xcfd6de;
    case "bomb":
      return 0xff6a6c;
    case "line":
      return 0xff8d3b;
    default:
      return 0xffffff;
  }
}

function bubbleLabel(kind: string): string {
  switch (kind) {
    case "stone":
      return "S";
    case "ice":
      return "I";
    case "vine":
      return "V";
    case "fog":
      return "F";
    case "crystal":
      return "C";
    case "pet":
      return "P";
    case "flower":
      return "H";
    case "artifact":
      return "A";
    case "line":
      return "L";
    default:
      return "";
  }
}

function clampAngle(angle: number): number {
  return Phaser.Math.Clamp(angle, -2.7, -0.44);
}
