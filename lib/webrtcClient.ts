// WebRTC Client & Frame Streamer for connecting iPhone to Studio
// Supports direct P2P streaming + dual-signaling (Local API + Cloud Relay)

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

// Cloud Pub/Sub relay for serverless Vercel & cross-network environments (zero setup, free, instant)
function getCloudTopic(roomId: string): string {
  return `castflow_sig_${roomId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

async function publishSignal(roomId: string, payload: any) {
  // 1. Post to local API route
  try {
    fetch('/api/signaling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (e) {}

  // 2. Post to cloud pub/sub relay (ntfy.sh)
  try {
    const topic = getCloudTopic(roomId);
    fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Title': payload.action },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (e) {}
}

// Studio Side: Receiver that listens for incoming camera stream from iPhone
export class StudioWebRTCReceiver {
  private peer: RTCPeerConnection | null = null;
  private roomId: string;
  private pollInterval: NodeJS.Timeout | null = null;
  private onStreamReceived: (stream: MediaStream) => void;
  private onStatusChange: (status: 'idle' | 'connecting' | 'connected' | 'disconnected') => void;
  private processedCandidates = new Set<string>();
  private answerSent = false;
  private lastCloudTimestamp = 0;

  constructor(
    roomId: string,
    onStreamReceived: (stream: MediaStream) => void,
    onStatusChange: (status: 'idle' | 'connecting' | 'connected' | 'disconnected') => void
  ) {
    this.roomId = roomId;
    this.onStreamReceived = onStreamReceived;
    this.onStatusChange = onStatusChange;
    this.lastCloudTimestamp = Math.floor(Date.now() / 1000) - 10;
  }

  public async start() {
    this.stop();
    this.onStatusChange('connecting');
    this.answerSent = false;
    this.processedCandidates.clear();

    try {
      this.peer = new RTCPeerConnection(RTC_CONFIG);

      // Track handler: When iPhone's video/audio track is received
      this.peer.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.onStreamReceived(event.streams[0]);
          this.onStatusChange('connected');
        }
      };

      // Local ICE candidate generation
      this.peer.onicecandidate = (event) => {
        if (event.candidate) {
          publishSignal(this.roomId, {
            action: 'send-candidate',
            roomId: this.roomId,
            role: 'host',
            data: event.candidate
          });
        }
      };

      this.peer.onconnectionstatechange = () => {
        if (!this.peer) return;
        const state = this.peer.connectionState;
        if (state === 'connected') {
          this.onStatusChange('connected');
        } else if (state === 'disconnected' || state === 'failed') {
          this.onStatusChange('disconnected');
        }
      };

      // Announce host presence
      publishSignal(this.roomId, {
        action: 'join',
        roomId: this.roomId,
        role: 'host'
      });

      // Polling loop: check for incoming offer from iPhone and exchange candidates
      this.pollInterval = setInterval(async () => {
        if (!this.peer) return;

        // 1. Check for Offer from iPhone (Sender)
        if (!this.answerSent && this.peer.signalingState === 'stable') {
          let offerData: any = null;

          // Check local signaling first
          try {
            const res = await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'get-offer', roomId: this.roomId })
            });
            const json = await res.json();
            if (json.offer) offerData = json.offer;
          } catch (e) {}

          // Check cloud relay if local didn't return
          if (!offerData) {
            try {
              const topic = getCloudTopic(this.roomId);
              const cloudRes = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=${this.lastCloudTimestamp}`);
              const text = await cloudRes.text();
              const lines = text.trim().split('\n');
              for (const line of lines) {
                if (!line) continue;
                try {
                  const item = JSON.parse(line);
                  if (item.time) this.lastCloudTimestamp = Math.max(this.lastCloudTimestamp, item.time);
                  if (item.message) {
                    const parsed = JSON.parse(item.message);
                    if (parsed.action === 'send-offer' && parsed.data) {
                      offerData = parsed.data;
                      break;
                    }
                  }
                } catch (pe) {}
              }
            } catch (ce) {}
          }

          if (offerData && this.peer && this.peer.signalingState === 'stable') {
            try {
              await this.peer.setRemoteDescription(new RTCSessionDescription(offerData));
              const answer = await this.peer.createAnswer();
              await this.peer.setLocalDescription(answer);

              publishSignal(this.roomId, {
                action: 'send-answer',
                roomId: this.roomId,
                role: 'host',
                data: answer
              });

              this.answerSent = true;
            } catch (oe) {
              console.warn('Error handling incoming offer on host:', oe);
            }
          }
        }

        // 2. Fetch candidates from iPhone (client)
        try {
          const candRes = await fetch('/api/signaling', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-candidates', roomId: this.roomId, role: 'host' })
          });
          const candJson = await candRes.json();
          if (candJson.candidates && Array.isArray(candJson.candidates)) {
            for (const c of candJson.candidates) {
              const key = JSON.stringify(c);
              if (!this.processedCandidates.has(key) && this.peer && this.peer.remoteDescription) {
                this.processedCandidates.add(key);
                try {
                  await this.peer.addIceCandidate(new RTCIceCandidate(c));
                } catch {}
              }
            }
          }
        } catch (e) {}
      }, 900);

    } catch (err) {
      console.error('Error starting WebRTC receiver:', err);
      this.onStatusChange('idle');
    }
  }

  public stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.peer) {
      this.peer.close();
      this.peer = null;
    }
    this.onStatusChange('idle');
  }
}

// iPhone Side: Sender that captures camera stream and publishes offer to Studio
export class RemoteCameraSender {
  private peer: RTCPeerConnection | null = null;
  private roomId: string;
  private stream: MediaStream | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private onStatusChange: (status: 'idle' | 'waiting' | 'connected' | 'disconnected' | 'error', message?: string) => void;
  private processedCandidates = new Set<string>();
  private lastCloudTimestamp = 0;
  private answerReceived = false;

  constructor(
    roomId: string,
    onStatusChange: (status: 'idle' | 'waiting' | 'connected' | 'disconnected' | 'error', message?: string) => void
  ) {
    this.roomId = roomId;
    this.onStatusChange = onStatusChange;
    this.lastCloudTimestamp = Math.floor(Date.now() / 1000) - 10;
  }

  public async start(stream: MediaStream) {
    this.stop();
    this.stream = stream;
    this.onStatusChange('waiting', 'מתחבר לאולפן...');
    this.answerReceived = false;
    this.processedCandidates.clear();

    try {
      this.peer = new RTCPeerConnection(RTC_CONFIG);

      // Add local iPhone camera tracks
      stream.getTracks().forEach(track => {
        if (this.peer && this.stream) {
          this.peer.addTrack(track, this.stream);
        }
      });

      this.peer.onicecandidate = (event) => {
        if (event.candidate) {
          publishSignal(this.roomId, {
            action: 'send-candidate',
            roomId: this.roomId,
            role: 'client',
            data: event.candidate
          });
        }
      };

      this.peer.onconnectionstatechange = () => {
        if (!this.peer) return;
        const state = this.peer.connectionState;
        if (state === 'connected') {
          this.onStatusChange('connected', 'מחובר לאולפן ומשדר ב-WebRTC!');
        } else if (state === 'disconnected' || state === 'failed') {
          this.onStatusChange('disconnected', 'החיבור לאולפן נותק');
        }
      };

      // Create Offer with real camera tracks
      const offer = await this.peer.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      await this.peer.setLocalDescription(offer);

      publishSignal(this.roomId, {
        action: 'send-offer',
        roomId: this.roomId,
        role: 'client',
        data: offer
      });

      // Poll for answer from Studio
      let reOfferCount = 0;
      this.pollInterval = setInterval(async () => {
        if (!this.peer) return;

        // If no answer yet, re-publish offer every 3 seconds to ensure delivery
        reOfferCount++;
        if (!this.answerReceived && reOfferCount % 3 === 0 && this.peer.localDescription) {
          publishSignal(this.roomId, {
            action: 'send-offer',
            roomId: this.roomId,
            role: 'client',
            data: this.peer.localDescription
          });
        }

        // 1. Check for Answer
        if (!this.answerReceived && this.peer.signalingState === 'have-local-offer') {
          let answerData: any = null;

          // Check local signaling
          try {
            const res = await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'get-answer', roomId: this.roomId })
            });
            const json = await res.json();
            if (json.answer) answerData = json.answer;
          } catch (e) {}

          // Check cloud relay if local didn't return
          if (!answerData) {
            try {
              const topic = getCloudTopic(this.roomId);
              const cloudRes = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=${this.lastCloudTimestamp}`);
              const text = await cloudRes.text();
              const lines = text.trim().split('\n');
              for (const line of lines) {
                if (!line) continue;
                try {
                  const item = JSON.parse(line);
                  if (item.time) this.lastCloudTimestamp = Math.max(this.lastCloudTimestamp, item.time);
                  if (item.message) {
                    const parsed = JSON.parse(item.message);
                    if (parsed.action === 'send-answer' && parsed.data) {
                      answerData = parsed.data;
                      break;
                    }
                  }
                } catch (pe) {}
              }
            } catch (ce) {}
          }

          if (answerData && this.peer && this.peer.signalingState === 'have-local-offer') {
            try {
              await this.peer.setRemoteDescription(new RTCSessionDescription(answerData));
              this.answerReceived = true;
              this.onStatusChange('connected', 'מחובר לאולפן ומשדר בשידור חי!');
            } catch (ae) {
              console.warn('Error setting answer on mobile:', ae);
            }
          }
        }

        // 2. Fetch candidates from host (Studio)
        try {
          const candRes = await fetch('/api/signaling', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-candidates', roomId: this.roomId, role: 'client' })
          });
          const candJson = await candRes.json();
          if (candJson.candidates && Array.isArray(candJson.candidates)) {
            for (const c of candJson.candidates) {
              const key = JSON.stringify(c);
              if (!this.processedCandidates.has(key) && this.peer && this.peer.remoteDescription) {
                this.processedCandidates.add(key);
                try {
                  await this.peer.addIceCandidate(new RTCIceCandidate(c));
                } catch {}
              }
            }
          }
        } catch (e) {}
      }, 900);

    } catch (err: any) {
      console.error('Remote sender error:', err);
      this.onStatusChange('error', err.message || 'שגיאת חיבור');
    }
  }

  public stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.peer) {
      this.peer.close();
      this.peer = null;
    }
    this.onStatusChange('idle');
  }
}
