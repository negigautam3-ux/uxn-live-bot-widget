class UXNVoiceBot extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.microphoneStream = null;
    this.timer = null;
    this.seconds = 0;
  }

  connectedCallback() {
    this.render();

    this.startButton =
      this.shadowRoot.querySelector("#startButton");
    this.endButton =
      this.shadowRoot.querySelector("#endButton");
    this.statusText =
      this.shadowRoot.querySelector("#statusText");
    this.orb =
      this.shadowRoot.querySelector("#orb");
    this.timerText =
      this.shadowRoot.querySelector("#timer");

    this.startButton.addEventListener(
      "click",
      () => this.startMicrophone()
    );

    this.endButton.addEventListener(
      "click",
      () => this.stopMicrophone()
    );
  }

  disconnectedCallback() {
    this.stopMicrophone();
  }

  async startMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.setStatus(
        "Microphone access is not supported by this browser.",
        "error"
      );
      return;
    }

    this.setStatus("Requesting microphone permission...", "waiting");

    try {
      this.microphoneStream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

      this.startButton.disabled = true;
      this.endButton.disabled = false;
      this.orb.classList.add("active");

      this.setStatus("Listening...", "active");
      this.startTimer();
    } catch (error) {
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        this.setStatus(
          "Microphone permission was denied. Please allow access in your browser settings.",
          "error"
        );
      } else {
        this.setStatus(
          "The microphone could not be started.",
          "error"
        );
      }
    }
  }

  stopMicrophone() {
    if (this.microphoneStream) {
      this.microphoneStream
        .getTracks()
        .forEach((track) => track.stop());

      this.microphoneStream = null;
    }

    clearInterval(this.timer);
    this.timer = null;
    this.seconds = 0;

    if (this.timerText) {
      this.timerText.textContent = "00:00";
    }

    if (this.startButton) {
      this.startButton.disabled = false;
    }

    if (this.endButton) {
      this.endButton.disabled = true;
    }

    if (this.orb) {
      this.orb.classList.remove("active");
    }

    if (this.statusText) {
      this.setStatus("Ready when you are.", "ready");
    }
  }

  startTimer() {
    clearInterval(this.timer);
    this.seconds = 0;

    this.timer = setInterval(() => {
      this.seconds += 1;

      const minutes = String(
        Math.floor(this.seconds / 60)
      ).padStart(2, "0");

      const seconds = String(
        this.seconds % 60
      ).padStart(2, "0");

      this.timerText.textContent =
        `${minutes}:${seconds}`;
    }, 1000);
  }

  setStatus(message, state) {
    this.statusText.textContent = message;
    this.statusText.dataset.state = state;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          color: #f6f6f6;
          font-family: Arial, Helvetica, sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        .bot {
          min-height: 680px;
          width: 100%;
          padding: 70px 24px 36px;
          background:
            radial-gradient(
              circle at 50% 44%,
              rgba(255, 102, 44, 0.09),
              transparent 32%
            ),
            #03070c;
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          overflow: hidden;
        }

        .eyebrow {
          color: #ff6b2c;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.23em;
          text-transform: uppercase;
          margin-bottom: 22px;
        }

        h1 {
          max-width: 760px;
          margin: 0;
          font-size: clamp(30px, 5vw, 56px);
          line-height: 1.05;
          letter-spacing: -0.04em;
          font-weight: 600;
        }

        .subtitle {
          margin: 18px 0 0;
          color: #aeb5bf;
          font-size: 17px;
        }

        .orb-area {
          position: relative;
          width: 190px;
          height: 190px;
          margin: 42px 0 24px;
          display: grid;
          place-items: center;
        }

        .ring {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(255, 107, 44, 0.18);
          border-radius: 50%;
        }

        .ring:nth-child(2) {
          inset: 20px;
          border-color: rgba(255, 255, 255, 0.1);
        }

        .orb {
          position: relative;
          width: 112px;
          height: 112px;
          border-radius: 50%;
          background:
            radial-gradient(
              circle at 35% 30%,
              #ffb38f,
              #ff6b2c 35%,
              #7b2104 72%,
              #140603
            );
          box-shadow:
            0 0 45px rgba(255, 107, 44, 0.3),
            inset 0 0 20px rgba(255,255,255,0.18);
          transition: transform 0.3s ease;
        }

        .orb.active {
          animation: breathe 1.6s ease-in-out infinite;
        }

        .orb.active + .pulse {
          animation: pulse 1.6s ease-out infinite;
        }

        .pulse {
          position: absolute;
          width: 112px;
          height: 112px;
          border: 1px solid rgba(255, 107, 44, 0.5);
          border-radius: 50%;
          opacity: 0;
        }

        @keyframes breathe {
          0%, 100% {
            transform: scale(0.96);
            box-shadow: 0 0 35px rgba(255,107,44,0.28);
          }
          50% {
            transform: scale(1.06);
            box-shadow: 0 0 65px rgba(255,107,44,0.55);
          }
        }

        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.65);
            opacity: 0;
          }
        }

        .status {
          min-height: 24px;
          color: #c6ccd4;
          font-size: 14px;
        }

        .status[data-state="active"] {
          color: #ff8b59;
        }

        .status[data-state="error"] {
          color: #ff7777;
        }

        .timer {
          margin-top: 8px;
          color: #747d89;
          font-family: monospace;
          font-size: 13px;
        }

        .controls {
          display: flex;
          gap: 12px;
          margin-top: 28px;
          flex-wrap: wrap;
          justify-content: center;
        }

        button {
          min-width: 150px;
          min-height: 50px;
          padding: 0 24px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            opacity 0.2s ease,
            background 0.2s ease;
        }

        button:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        button:focus-visible {
          outline: 2px solid #ffffff;
          outline-offset: 3px;
        }

        #startButton {
          background: #ff6b2c;
          color: #090909;
        }

        #endButton {
          background: transparent;
          color: #ffffff;
          border-color: rgba(255,255,255,0.25);
        }

        button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .footer {
          margin-top: auto;
          padding-top: 44px;
          color: #626a75;
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        @media (max-width: 600px) {
          .bot {
            min-height: 640px;
            padding-top: 54px;
          }

          .orb-area {
            margin-top: 34px;
          }

          .controls {
            width: 100%;
          }

          button {
            width: 100%;
            max-width: 320px;
          }
        }
      </style>

      <section class="bot">
        <div class="eyebrow">UXN AI System</div>

        <h1>
          How can I help you create your
          Utopian Experience?
        </h1>

        <p class="subtitle">Ask me anything.</p>

        <div class="orb-area" aria-hidden="true">
          <div class="ring"></div>
          <div class="ring"></div>
          <div class="orb" id="orb"></div>
          <div class="pulse"></div>
        </div>

        <div
          class="status"
          id="statusText"
          aria-live="polite"
          data-state="ready"
        >
          Ready when you are.
        </div>

        <div class="timer" id="timer">00:00</div>

        <div class="controls">
          <button id="startButton" type="button">
            Start Talking
          </button>

          <button id="endButton" type="button" disabled>
            End
          </button>
        </div>

        <div class="footer">
          UXN AI System by House Utopian Experience
        </div>
      </section>
    `;
  }
}

if (!customElements.get("uxn-voice-bot")) {
  customElements.define("uxn-voice-bot", UXNVoiceBot);
}
