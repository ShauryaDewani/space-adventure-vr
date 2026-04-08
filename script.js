/* global AFRAME, THREE */

(function () {
  // Centralized game states keep transitions explicit and easy to discuss in demos.
  const GAME_STATES = {
    SPLASH: "splash",
    SETUP: "setup",
    LEVEL1: "level1",
    LEVEL1_COMPLETE: "level1Complete",
    LEVEL2: "level2",
    WIN: "win",
    GAMEOVER: "gameover"
  };

  const CONFIG = {
    splashDurationMs: 2600,
    startHealth: 3,
    level1: {
      ringTarget: 3,
      ringPoints: 10,
      damage: 1
    },
    level2: {
      crystalTarget: 7,
      crystalPoints: 20,
      damage: 1
    },
    audio: {
      // Keep null to avoid missing-file errors. Add real files later if desired.
      musicFile: null,
      collectFile: null,
      hitFile: null,
      menuFile: null,
      levelCompleteFile: null
    }
  };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  class AudioController {
    constructor() {
      this.ctx = null;
      this.musicEnabled = true;
      this.masterGain = null;
      this.musicGain = null;
      this.musicOscA = null;
      this.musicOscB = null;
      this.loaded = {};
      this.musicElement = null;
    }

    async init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.08;
      this.musicGain.connect(this.masterGain);

      this.tryLoadMusicFile();
      this.startMusicSynth();
      this.setMusicEnabled(true);
      this.preloadSfx();
    }

    async resume() {
      if (!this.ctx) {
        await this.init();
      } else if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
    }

    preloadSfx() {
      ["collectFile", "hitFile", "menuFile", "levelCompleteFile"].forEach((key) => {
        const path = CONFIG.audio[key];
        if (!path) return;
        fetch(path)
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error("missing"))))
          .then((data) => this.ctx.decodeAudioData(data))
          .then((buffer) => {
            this.loaded[key] = buffer;
          })
          .catch(() => {
            // Fall back to procedural tones when files are not present.
          });
      });
    }

    tryLoadMusicFile() {
      if (!CONFIG.audio.musicFile) {
        this.musicElement = null;
        return;
      }
      this.musicElement = new Audio(CONFIG.audio.musicFile);
      this.musicElement.loop = true;
      this.musicElement.volume = 0.28;
      this.musicElement.preload = "auto";
      this.musicElement.addEventListener("error", () => {
        this.musicElement = null;
      });
    }

    startMusicSynth() {
      if (!this.ctx || this.musicOscA) return;
      this.musicOscA = this.ctx.createOscillator();
      this.musicOscB = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 600;

      this.musicOscA.type = "sine";
      this.musicOscB.type = "triangle";
      this.musicOscA.frequency.value = 92;
      this.musicOscB.frequency.value = 138;
      this.musicOscA.connect(filter);
      this.musicOscB.connect(filter);
      filter.connect(this.musicGain);

      this.musicOscA.start();
      this.musicOscB.start();
    }

    setMusicEnabled(enabled) {
      this.musicEnabled = enabled;
      if (this.musicGain) {
        this.musicGain.gain.setTargetAtTime(enabled ? 0.08 : 0.0, this.ctx.currentTime, 0.08);
      }
      if (this.musicElement) {
        if (enabled) {
          this.musicElement.play().catch(() => {});
        } else {
          this.musicElement.pause();
          this.musicElement.currentTime = 0;
        }
      }
    }

    playSfx(kind) {
      if (!this.ctx) return;
      const keyMap = {
        collect: "collectFile",
        hit: "hitFile",
        menu: "menuFile",
        complete: "levelCompleteFile"
      };
      const buffer = this.loaded[keyMap[kind]];
      if (buffer) {
        const src = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        gain.gain.value = 0.5;
        src.buffer = buffer;
        src.connect(gain);
        gain.connect(this.masterGain);
        src.start();
        return;
      }
      this.playFallbackTone(kind);
    }

    playFallbackTone(kind) {
      const toneMap = {
        collect: [640, 920, 0.09],
        hit: [180, 120, 0.16],
        menu: [420, 560, 0.08],
        complete: [300, 520, 0.25]
      };
      const [f1, f2, dur] = toneMap[kind] || [300, 460, 0.08];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(f1, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(f2, this.ctx.currentTime + dur);
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, this.ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + dur + 0.02);
    }
  }

  AFRAME.registerComponent("game-manager", {
    init: function () {
      this.state = GAME_STATES.SPLASH;
      this.score = 0;
      this.health = CONFIG.startHealth;
      this.ringsCollected = 0;
      this.crystalsCollected = 0;
      this.audio = new AudioController();
      this.lastHitAt = 0;
      this.hitCooldownMs = 850;
      this.instructionsVisible = false;
      this.level2AutoTransitionTimer = null;

      this.refs = {
        rig: document.querySelector("#playerRig"),
        hud: document.querySelector("#hudRoot"),
        scoreText: document.querySelector("#scoreText"),
        healthText: document.querySelector("#healthText"),
        splash: document.querySelector("#uiSplash"),
        setup: document.querySelector("#uiSetup"),
        transition: document.querySelector("#uiLevelComplete"),
        transitionScore: document.querySelector("#transitionScoreText"),
        endScreen: document.querySelector("#uiEnd"),
        endTitle: document.querySelector("#endTitleText"),
        endScore: document.querySelector("#finalScoreText"),
        musicText: document.querySelector("#musicToggleText"),
        setupInstructionsText: document.querySelector("#setupInstructionsText"),
        level1Root: document.querySelector("#level1Root"),
        level2Root: document.querySelector("#level2Root"),
        l1Rings: document.querySelector("#l1Rings"),
        l1Hazards: document.querySelector("#l1Hazards"),
        l1Track: document.querySelector("#l1Track"),
        l1Portal: document.querySelector("#l1Portal"),
        l2Tunnel: document.querySelector("#l2Tunnel"),
        l2Crystals: document.querySelector("#l2Crystals"),
        l2Hazards: document.querySelector("#l2Hazards"),
        l2Portal: document.querySelector("#l2Portal"),
        starField: document.querySelector("#starField")
      };

      this.buildStars();
      this.buildLevel1();
      this.buildLevel2();
      this.updateHud();
      this.setState(GAME_STATES.SPLASH);

      setTimeout(() => {
        if (this.state === GAME_STATES.SPLASH) this.setState(GAME_STATES.SETUP);
      }, CONFIG.splashDurationMs);
    },

    buildStars: function () {
      const parent = this.refs.starField;
      for (let i = 0; i < 220; i += 1) {
        const star = document.createElement("a-sphere");
        const x = randomInRange(-45, 45);
        const y = randomInRange(-10, 30);
        const z = randomInRange(-170, 20);
        const r = randomInRange(0.03, 0.12);
        star.setAttribute("position", `${x} ${y} ${z}`);
        star.setAttribute("radius", r.toFixed(3));
        star.setAttribute("material", "color: #d8ecff; emissive: #bde7ff; emissiveIntensity: 0.7");
        parent.appendChild(star);
      }
    },

    buildLevel1: function () {
      const ringParent = this.refs.l1Rings;
      const hazardParent = this.refs.l1Hazards;
      const trackParent = this.refs.l1Track;

      // Level 1 is intentionally short and readable as a steering tutorial.
      const tutorialRingPath = [
        { x: -0.8, y: 1.55, z: -18 },
        { x: 0.9, y: 1.62, z: -26 },
        { x: -0.7, y: 1.48, z: -34 },
        { x: 0.75, y: 1.64, z: -42 },
        { x: 0.0, y: 1.56, z: -50 }
      ];

      for (let i = 0; i < tutorialRingPath.length; i += 1) {
        const ringPos = tutorialRingPath[i];

        const ring = document.createElement("a-torus");
        ring.setAttribute("position", `${ringPos.x} ${ringPos.y} ${ringPos.z}`);
        ring.setAttribute("radius", "1.02");
        ring.setAttribute("radius-tubular", "0.08");
        ring.setAttribute(
          "material",
          "src: #texEnergy; color: #ffcf87; emissive: #ffa73d; emissiveIntensity: 0.85; metalness: 0.2; roughness: 0.14"
        );
        ring.setAttribute("spin-float", "");
        ring.setAttribute("collectible", `points: ${CONFIG.level1.ringPoints}; type: ring`);
        ring.setAttribute("class", "active-collider");
        ring.setAttribute("data-radius", "1.08");
        ringParent.appendChild(ring);
      }

      for (let i = 0; i < 8; i += 1) {
        const asteroid = document.createElement("a-dodecahedron");
        const z = -22 - i * 5.1;
        const lane = (i % 4) - 1.5;
        const x = lane * 1.7 + randomInRange(-0.32, 0.32);
        const y = 1.45 + randomInRange(-0.55, 0.85);
        asteroid.setAttribute("position", `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
        asteroid.setAttribute("radius", randomInRange(0.4, 0.66).toFixed(2));
        asteroid.setAttribute(
          "material",
          "src: #texRock; color: #7b7770; roughness: 0.98; metalness: 0.02; repeat: 1.5 1.5"
        );
        asteroid.setAttribute("spin-float", "speed: 0.35; floatAmp: 0.03");
        asteroid.setAttribute("hazard", `damage: ${CONFIG.level1.damage}`);
        asteroid.setAttribute("class", "active-collider");
        asteroid.setAttribute("data-radius", "0.6");
        hazardParent.appendChild(asteroid);
      }

      for (let i = 0; i < 6; i += 1) {
        const marker = document.createElement("a-cylinder");
        marker.setAttribute("position", `${i % 2 === 0 ? -3.8 : 3.8} 1 ${-12 - i * 8}`);
        marker.setAttribute("radius", "0.08");
        marker.setAttribute("height", "2.2");
        marker.setAttribute("material", "src: #texPanel; color: #40598c; emissive: #4d71b9; emissiveIntensity: 0.28; repeat: 1 3");
        trackParent.appendChild(marker);
      }

      // Move level 1 finish portal closer for faster transition to level 2.
      this.refs.l1Portal.setAttribute("position", "0 1.6 -56");
    },

    buildLevel2: function () {
      const tunnelParent = this.refs.l2Tunnel;
      const crystalParent = this.refs.l2Crystals;
      const hazardParent = this.refs.l2Hazards;

      for (let i = 0; i < 44; i += 1) {
        const segment = document.createElement("a-box");
        segment.setAttribute("position", `0 1.6 ${-8 - i * 3}`);
        segment.setAttribute("width", "8");
        segment.setAttribute("height", "6");
        segment.setAttribute("depth", "2.8");
        segment.setAttribute(
          "material",
          "src: #texPanel; color: #2f3c59; metalness: 0.42; roughness: 0.6; repeat: 4 2; opacity: 0.93; transparent: true"
        );
        segment.setAttribute("wireframe", "false");
        tunnelParent.appendChild(segment);

        const innerVoid = document.createElement("a-box");
        innerVoid.setAttribute("position", `0 1.6 ${-8 - i * 3}`);
        innerVoid.setAttribute("width", "4.2");
        innerVoid.setAttribute("height", "3.8");
        innerVoid.setAttribute("depth", "2.85");
        innerVoid.setAttribute("material", "src: #texPanel; color: #040714; side: back; repeat: 2.5 1.5; roughness: 0.95");
        tunnelParent.appendChild(innerVoid);
      }

      for (let i = 0; i < 10; i += 1) {
        const crystal = document.createElement("a-octahedron");
        const z = -20 - i * 10.5;
        const x = randomInRange(-1.3, 1.3);
        const y = randomInRange(0.8, 2.5);
        crystal.setAttribute("position", `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
        crystal.setAttribute("radius", "0.45");
        crystal.setAttribute(
          "material",
          "src: #texEnergy; color: #ffd08e; emissive: #ffb14a; emissiveIntensity: 1.15; metalness: 0.2; roughness: 0.08"
        );
        crystal.setAttribute("spin-float", "speed: 1.2; floatAmp: 0.15");
        crystal.setAttribute("collectible", `points: ${CONFIG.level2.crystalPoints}; type: crystal`);
        crystal.setAttribute("class", "active-collider");
        crystal.setAttribute("data-radius", "0.6");
        crystalParent.appendChild(crystal);
      }

      for (let i = 0; i < 22; i += 1) {
        const barrier = document.createElement("a-box");
        const z = -15 - i * 5.2;
        const vertical = i % 2 === 0;
        const posX = vertical ? randomInRange(-1.6, 1.6) : randomInRange(-1.3, 1.3);
        const posY = vertical ? 1.6 : randomInRange(0.7, 2.5);
        barrier.setAttribute("position", `${posX.toFixed(2)} ${posY.toFixed(2)} ${z.toFixed(2)}`);
        barrier.setAttribute("width", vertical ? "0.45" : "2.1");
        barrier.setAttribute("height", vertical ? "2.8" : "0.35");
        barrier.setAttribute("depth", "0.7");
        barrier.setAttribute(
          "material",
          "src: #texPanel; color: #8c3354; metalness: 0.22; roughness: 0.7; repeat: 1.2 1.2"
        );
        barrier.setAttribute("hazard", `damage: ${CONFIG.level2.damage}`);
        barrier.setAttribute("class", "active-collider");
        barrier.setAttribute("data-radius", vertical ? "0.55" : "0.6");
        hazardParent.appendChild(barrier);
      }
    },

    setState: function (newState) {
      this.state = newState;
      const { splash, setup, transition, endScreen, level1Root, level2Root, hud } = this.refs;

      splash.setAttribute("visible", newState === GAME_STATES.SPLASH);
      setup.setAttribute("visible", newState === GAME_STATES.SETUP);
      transition.setAttribute("visible", newState === GAME_STATES.LEVEL1_COMPLETE);
      endScreen.setAttribute("visible", newState === GAME_STATES.WIN || newState === GAME_STATES.GAMEOVER);
      level1Root.setAttribute("visible", newState === GAME_STATES.LEVEL1);
      level2Root.setAttribute("visible", newState === GAME_STATES.LEVEL2);
      hud.setAttribute("visible", newState === GAME_STATES.LEVEL1 || newState === GAME_STATES.LEVEL2);

      const moving = newState === GAME_STATES.LEVEL1 || newState === GAME_STATES.LEVEL2;
      this.refs.rig.setAttribute(
        "auto-fly",
        `enabled: ${moving}; speed: ${newState === GAME_STATES.LEVEL2 ? 4.9 : 3.8}; steerStrength: 2.55; deadzone: 0.1; smoothing: 4.2; inputSmoothing: 4.6; verticalScale: 0.62; maxLateralSpeed: 2.7`
      );

      if (newState === GAME_STATES.LEVEL1_COMPLETE) {
        this.refs.transitionScore.setAttribute("value", `Score: ${this.score}`);
        this.scheduleAutoLevel2Start();
      }

      if (newState === GAME_STATES.WIN) {
        this.refs.endTitle.setAttribute("value", "Mission Complete!");
        this.refs.endScore.setAttribute("value", `Final Score: ${this.score}`);
      } else if (newState === GAME_STATES.GAMEOVER) {
        this.refs.endTitle.setAttribute("value", "Game Over");
        this.refs.endScore.setAttribute("value", `Final Score: ${this.score}`);
      }
    },

    resetRun: function () {
      this.score = 0;
      this.health = CONFIG.startHealth;
      this.ringsCollected = 0;
      this.crystalsCollected = 0;
      this.lastHitAt = 0;
      if (this.level2AutoTransitionTimer) {
        clearTimeout(this.level2AutoTransitionTimer);
        this.level2AutoTransitionTimer = null;
      }

      this.refs.rig.object3D.position.set(0, 1.6, 10);
      this.refs.l1Portal.setAttribute("visible", false);
      this.refs.l2Portal.setAttribute("visible", false);

      document.querySelectorAll("[collectible]").forEach((el) => {
        el.setAttribute("visible", true);
        el.dataset.collected = "false";
      });

      this.updateHud();
      this.setState(GAME_STATES.LEVEL1);
    },
    scheduleAutoLevel2Start: function () {
      if (this.level2AutoTransitionTimer) clearTimeout(this.level2AutoTransitionTimer);
      // Keep a short completion screen, then automatically start Level 2.
      this.level2AutoTransitionTimer = setTimeout(() => {
        if (this.state !== GAME_STATES.LEVEL1_COMPLETE) return;
        this.refs.rig.object3D.position.set(0, 1.6, 8);
        this.setState(GAME_STATES.LEVEL2);
        this.level2AutoTransitionTimer = null;
      }, 1300);
    },

    toggleMusic: async function () {
      await this.audio.resume();
      this.audio.setMusicEnabled(!this.audio.musicEnabled);
      this.refs.musicText.setAttribute("value", `Music: ${this.audio.musicEnabled ? "ON" : "OFF"}`);
    },

    addScore: function (points, type) {
      this.score += points;
      if (type === "ring") {
        this.ringsCollected += 1;
        if (this.ringsCollected >= CONFIG.level1.ringTarget) {
          this.refs.l1Portal.setAttribute("visible", true);
        }
      } else if (type === "crystal") {
        this.crystalsCollected += 1;
        if (this.crystalsCollected >= CONFIG.level2.crystalTarget) {
          this.refs.l2Portal.setAttribute("visible", true);
        }
      }
      this.updateHud();
    },

    applyDamage: function (damage) {
      const now = performance.now();
      if (now - this.lastHitAt < this.hitCooldownMs) return;
      this.lastHitAt = now;
      this.health -= damage;
      this.audio.playSfx("hit");
      this.updateHud();
      if (this.health <= 0) {
        this.health = 0;
        this.setState(GAME_STATES.GAMEOVER);
      }
    },

    tryFinishLevel: function (level) {
      if (level === 1 && this.state === GAME_STATES.LEVEL1) {
        if (this.ringsCollected >= CONFIG.level1.ringTarget) {
          this.audio.playSfx("complete");
          this.setState(GAME_STATES.LEVEL1_COMPLETE);
        } else {
          this.audio.playSfx("hit");
          this.applyDamage(1);
        }
      } else if (level === 2 && this.state === GAME_STATES.LEVEL2) {
        if (this.crystalsCollected >= CONFIG.level2.crystalTarget) {
          this.audio.playSfx("complete");
          this.setState(GAME_STATES.WIN);
        } else {
          this.audio.playSfx("hit");
          this.applyDamage(1);
        }
      }
    },

    onGazeAction: async function (action) {
      await this.audio.resume();
      this.audio.playSfx("menu");

      switch (action) {
        case "start-game":
          this.resetRun();
          break;
        case "toggle-music":
          this.toggleMusic();
          break;
        case "instructions":
          this.toggleInstructionsText();
          break;
        case "continue-level2":
          if (this.level2AutoTransitionTimer) {
            clearTimeout(this.level2AutoTransitionTimer);
            this.level2AutoTransitionTimer = null;
          }
          this.refs.rig.object3D.position.set(0, 1.6, 8);
          this.setState(GAME_STATES.LEVEL2);
          break;
        case "restart":
          this.setState(GAME_STATES.SETUP);
          break;
        default:
          break;
      }
    },

    toggleInstructionsText: function () {
      this.instructionsVisible = !this.instructionsVisible;
      const concise = "Look around to steer\nCollect glowing objects\nAvoid obstacles\nGaze at buttons to select";
      const detailed =
        "Controls:\n- Look left/right/up/down to steer\n- You move forward automatically\n- Rings = +10, Crystals = +20\n- Avoid hazards, health reaches 0 => Game Over";
      this.refs.setupInstructionsText.setAttribute("value", this.instructionsVisible ? detailed : concise);
    },

    updateHud: function () {
      this.refs.scoreText.setAttribute("value", `Score: ${this.score}`);
      this.refs.healthText.setAttribute("value", `Health: ${Math.max(this.health, 0)}`);
    }
  });

  AFRAME.registerComponent("gaze-button", {
    schema: {
      action: { type: "string" }
    },
    init: function () {
      this.onClick = this.onClick.bind(this);
      this.el.addEventListener("click", this.onClick);
      this.el.addEventListener("mouseenter", () => {
        this.el.object3D.scale.set(1.06, 1.06, 1.06);
      });
      this.el.addEventListener("mouseleave", () => {
        this.el.object3D.scale.set(1, 1, 1);
      });
    },
    remove: function () {
      this.el.removeEventListener("click", this.onClick);
    },
    onClick: function () {
      const scene = this.el.sceneEl;
      scene.components["game-manager"].onGazeAction(this.data.action);
    }
  });

  AFRAME.registerComponent("auto-fly", {
    schema: {
      enabled: { type: "boolean", default: false },
      speed: { type: "number", default: 4.0 }, // Constant forward speed.
      steerStrength: { type: "number", default: 2.55 }, // More responsive look-following drift.
      deadzone: { type: "number", default: 0.1 }, // Start steering sooner from center.
      smoothing: { type: "number", default: 4.2 }, // Faster velocity response (less floaty).
      inputSmoothing: { type: "number", default: 4.6 }, // Faster recognition of head movement.
      verticalScale: { type: "number", default: 0.62 }, // Keep vertical motion comfortable in mobile VR.
      maxLateralSpeed: { type: "number", default: 2.7 } // Clamp steering speed spikes.
    },
    init: function () {
      this.cameraEl = document.querySelector("#playerCam");
      this.tempDir = new THREE.Vector3();
      this.currentVX = 0;
      this.currentVY = 0;
      this.filteredLookX = 0;
      this.filteredLookY = 0;
    },
    applyDeadzone: function (value, deadzone) {
      const abs = Math.abs(value);
      if (abs < deadzone) return 0;
      // Re-normalize after deadzone so full head turns still reach full steering.
      const sign = Math.sign(value);
      return sign * ((abs - deadzone) / (1 - deadzone));
    },
    tick: function (time, deltaMs) {
      if (!this.data.enabled || !this.cameraEl) {
        this.currentVX = 0;
        this.currentVY = 0;
        return;
      }
      const dt = deltaMs / 1000;
      const rig = this.el.object3D;
      const cam = this.cameraEl.object3D;

      // Look-following flight:
      // 1) read camera forward vector
      // 2) map x/y to desired lateral/up steering
      // 3) apply deadzone and smoothing for stable mobile VR control
      cam.getWorldDirection(this.tempDir);

      // Step 1: smooth raw look direction to reduce micro head jitter.
      const inputAlpha = 1 - Math.exp(-this.data.inputSmoothing * dt);
      this.filteredLookX += (this.tempDir.x - this.filteredLookX) * inputAlpha;
      this.filteredLookY += (this.tempDir.y - this.filteredLookY) * inputAlpha;

      // Step 2: apply deadzone so tiny movements near center do not steer.
      const steerX = this.applyDeadzone(this.filteredLookX, this.data.deadzone);
      const steerY = this.applyDeadzone(this.filteredLookY, this.data.deadzone);

      const targetVX = steerX * this.data.steerStrength;
      const targetVY = steerY * this.data.steerStrength * this.data.verticalScale;

      const smoothingAlpha = 1 - Math.exp(-this.data.smoothing * dt);
      this.currentVX += (targetVX - this.currentVX) * smoothingAlpha;
      this.currentVY += (targetVY - this.currentVY) * smoothingAlpha;
      this.currentVX = THREE.MathUtils.clamp(this.currentVX, -this.data.maxLateralSpeed, this.data.maxLateralSpeed);
      this.currentVY = THREE.MathUtils.clamp(this.currentVY, -this.data.maxLateralSpeed, this.data.maxLateralSpeed);

      rig.position.z -= this.data.speed * dt;
      rig.position.x += this.currentVX * dt;
      rig.position.y += this.currentVY * dt;

      rig.position.x = THREE.MathUtils.clamp(rig.position.x, -3.2, 3.2);
      rig.position.y = THREE.MathUtils.clamp(rig.position.y, 0.45, 3.15);
    }
  });

  AFRAME.registerComponent("collectible", {
    schema: {
      points: { type: "int", default: 10 },
      type: { type: "string", default: "ring" }
    },
    init: function () {
      this.el.dataset.collected = "false";
    }
  });

  AFRAME.registerComponent("hazard", {
    schema: {
      damage: { type: "int", default: 1 }
    }
  });

  AFRAME.registerComponent("finish-portal", {
    schema: {
      level: { type: "int", default: 1 }
    },
    init: function () {
      this.el.classList.add("active-collider");
      this.el.setAttribute("data-radius", "1.8");
    }
  });

  AFRAME.registerComponent("spin-float", {
    schema: {
      speed: { type: "number", default: 0.9 },
      floatAmp: { type: "number", default: 0.08 }
    },
    init: function () {
      this.baseY = this.el.object3D.position.y;
    },
    tick: function (time) {
      const t = time / 1000;
      this.el.object3D.rotation.y += 0.01 * this.data.speed;
      this.el.object3D.position.y = this.baseY + Math.sin(t * this.data.speed * 2) * this.data.floatAmp;
    }
  });

  AFRAME.registerComponent("collision-loop", {
    init: function () {
      // Reused temp vector avoids per-frame allocations.
      this.tempWorldPos = new THREE.Vector3();
    },
    tick: function () {
      const gm = this.el.components["game-manager"];
      if (!gm || (gm.state !== GAME_STATES.LEVEL1 && gm.state !== GAME_STATES.LEVEL2)) return;

      const rigPos = gm.refs.rig.object3D.position;

      // Level 2 tunnel wall handling: touching wall bounds causes damage.
      if (gm.state === GAME_STATES.LEVEL2) {
        const tunnelHalfWidth = 2.18;
        const tunnelMinY = 0.05;
        const tunnelMaxY = 3.15;
        const outOfBounds = Math.abs(rigPos.x) > tunnelHalfWidth || rigPos.y < tunnelMinY || rigPos.y > tunnelMaxY;
        if (outOfBounds) {
          gm.applyDamage(1);
          rigPos.x = THREE.MathUtils.clamp(rigPos.x, -tunnelHalfWidth, tunnelHalfWidth);
          rigPos.y = THREE.MathUtils.clamp(rigPos.y, tunnelMinY, tunnelMaxY);
        }
      }

      const colliders = this.el.querySelectorAll(".active-collider");

      for (let i = 0; i < colliders.length; i += 1) {
        const target = colliders[i];
        if (!target.getAttribute("visible")) continue;

        const cPos = target.object3D.getWorldPosition(this.tempWorldPos);
        const radius = Number(target.getAttribute("data-radius") || 0.6);
        const dist = rigPos.distanceTo(cPos);
        if (dist > radius) continue;

        if (target.hasAttribute("collectible")) {
          if (target.dataset.collected === "true") continue;
          target.dataset.collected = "true";
          target.setAttribute("visible", false);
          const data = target.getAttribute("collectible");
          gm.addScore(data.points, data.type);
          gm.audio.playSfx("collect");
        } else if (target.hasAttribute("hazard")) {
          gm.applyDamage(target.getAttribute("hazard").damage || 1);
        } else if (target.hasAttribute("finish-portal")) {
          gm.tryFinishLevel(target.getAttribute("finish-portal").level);
        }
      }
    }
  });

  window.addEventListener("DOMContentLoaded", () => {
    const scene = document.querySelector("#gameScene");
    scene.setAttribute("collision-loop", "");
  });
})();
