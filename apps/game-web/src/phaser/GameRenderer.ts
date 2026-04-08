import Phaser from "phaser";

import type { GameSessionState } from "@bubble-kingdom/game-core";

import { BubbleLevelScene } from "./BubbleLevelScene";

export class GameRenderer {
  private readonly phaser: Phaser.Game;

  private readonly scene: BubbleLevelScene;

  constructor(
    container: HTMLElement,
    callbacks: {
      onPreview: (angle: number) => void;
      onShoot: (angle: number) => void;
    },
  ) {
    this.scene = new BubbleLevelScene();
    this.phaser = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: 720,
      height: 960,
      backgroundColor: "#12243a",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [this.scene],
      render: {
        antialias: true,
      },
    });

    this.scene.setInteractionCallbacks(callbacks);
  }

  render(state: GameSessionState) {
    this.scene.setState(state);
  }

  destroy() {
    this.phaser.destroy(true);
  }
}
