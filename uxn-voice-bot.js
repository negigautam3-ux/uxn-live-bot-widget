class UXNVoiceBot extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.microphoneStream = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.timer = null;
    this.sessionTimeout = null;
    this.seconds = 0;
    this.sessionActive = false;
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
    this.remoteAudio =
      this.shadowRoot.querySelector("#remoteAudio");

    this.startButton.addEventListener(
      "click",
      () => this.startConversation()
    );

    this.endButton.addEventListener(
      "click",
      () => this.endConversation()
    );
  }

  disconnectedCallback() {
    this.endConversation();
  }

  getTokenEndpoint() {
    // Use the latest Wix test-site backend while UXN AI is being tested.
    // Remove "?rc=test-site" when publishing the final production version.
return "https://www.utopianxn.com/_functions-dev/uxnRealtimeToken";  }

  async startConversation() {
    if (this.sessionActive) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.setStatus(
        "Microphone access is not supported by this browser.",
        "error"
      );
      return;
    }

    this.setStatus("Requesting microphone permission...", "waiting");

    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.setStatus("Connecting to UXN AI...", "waiting");

      const tokenResponse = await fetch(this.getTokenEndpoint(), {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.value) {
        throw new Error(
          tokenData.error || "Unable to create a secure voice session."
        );
      }

      this.peerConnection = new RTCPeerConnection();

      this.peerConnection.ontrack = (event) => {
        this.remoteAudio.srcObject = event.streams[0];
        this.remoteAudio.play().catch(() => {});
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;

        if (state === "connected") {
          this.setStatus("Listening...", "active");
        }

        if (state === "failed" || state === "disconnected") {
          this.endConversation(
            "The voice connection ended. Please try again.",
            "error"
          );
        }
      };

      this.microphoneStream
        .getTracks()
        .forEach((track) => {
          this.peerConnection.addTrack(track, this.microphoneStream);
        });

      this.dataChannel =
        this.peerConnection.createDataChannel("oai-events");

      this.dataChannel.addEventListener("message", (event) => {
        this.handleRealtimeEvent(event);
      });

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      const realtimeResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${tokenData.value}`,
            "Content-Type": "application/sdp"
          }
        }
      );

      if (!realtimeResponse.ok) {
        const details = await realtimeResponse.text();
        throw new Error(`Realtime connection failed: ${details}`);
      }

      const answer = {
        type: "answer",
        sdp: await realtimeResponse.text()
      };

      await this.peerConnection.setRemoteDescription(answer);

      this.startButton.disabled = true;
      this.endButton.disabled = false;
      this.orb.classList.add("active");
      this.sessionActive = true;

      this.setStatus("Listening...", "active");
      this.startTimer();

      this.sessionTimeout = setTimeout(() => {
        this.endConversation(
          "Your five-minute session has ended.",
          "ready"
        );
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error("UXN voice session error:", error);

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
          "UXN AI could not connect. Please try again.",
          "error"
        );
      }

      this.cleanUpConnection();
    }
  }

  handleRealtimeEvent(messageEvent) {
    try {
      const event = JSON.parse(messageEvent.data);

      switch (event.type) {
        case "input_audio_buffer.speech_started":
          this.setStatus("Listening...", "active");
          break;

        case "input_audio_buffer.speech_stopped":
        case "response.created":
          this.setStatus("Thinking...", "waiting");
          break;

        case "response.output_audio.delta":
          this.setStatus("Speaking...", "active");
          break;

        case "response.done":
          this.setStatus("Listening...", "active");
          break;

        case "error":
          console.error("OpenAI Realtime error:", event.error);
          this.setStatus(
            "There was a voice-session error. Please try again.",
            "error"
          );
          break;
      }
    } catch (error) {
      console.error("Could not read a Realtime event:", error);
    }
  }

  cleanUpConnection() {
    if (this.microphoneStream) {
      this.microphoneStream
        .getTracks()
        .forEach((track) => track.stop());

      this.microphoneStream = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
    }

    clearTimeout(this.sessionTimeout);
    this.sessionTimeout = null;

    this.sessionActive = false;
  }

  endConversation(
    finalMessage = "Ready when you are.",
    finalState = "ready"
  ) {
    this.cleanUpConnection();

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
      this.setStatus(finalMessage, finalState);
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
        <audio id="remoteAudio" autoplay playsinline hidden></audio>

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
