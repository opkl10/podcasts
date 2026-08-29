// WebRTC Client & Frame Streamer for connecting iPhone to Studio

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' }
  ]
};

// Studio Side: Host receiver that listens for incoming video from iPhone
export class StudioWebRTCReceiver {
  private peer: RTCPeerConnection | null = null;
  private roomId: string;
  private pollInterval: NodeJS.Timeout | null = null;
  private onStreamReceived: (stream: MediaStream) => void;
  private onStatusChange: (status: 'idle' | 'connecting' | 'connected' | 'disconnected') => void;

  constructor(
    roomId: string,
    onStreamReceived: (stream: MediaStream) => void,
    onStatusChange: (status: 'idle' | 'connecting' | 'connected' | 'disconnected') => void
  ) {
    this.roomId = roomId;
    this.onStreamReceived = onStreamReceived;
    this.onStatusChange = onStatusChange;
  }

  public async start() {
    this.stop();
    this.onStatusChange('connecting');

    try {
      this.peer = new RTCPeerConnection(RTC_CONFIG);

      this.peer.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.onStreamReceived(event.streams[0]);
          this.onStatusChange('connected');
        }
      };

      this.peer.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'send-candidate',
                roomId: this.roomId,
                role: 'host',
                data: event.candidate
              })
            });
          } catch {}
        }
      };

      this.peer.onconnectionstatechange = () => {
        if (!this.peer) return;
        if (this.peer.connectionState === 'connected') {
          this.onStatusChange('connected');
        } else if (this.peer.connectionState === 'disconnected' || this.peer.connectionState === 'failed') {
          this.onStatusChange('disconnected');
        }
      };

      // Create offer
      const offer = await this.peer.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      await this.peer.setLocalDescription(offer);

      await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-offer',
          roomId: this.roomId,
          role: 'host',
          data: offer
        })
      });

      // Poll for answer & candidates
      let answerApplied = false;
      this.pollInterval = setInterval(async () => {
        if (!this.peer) return;

        if (!answerApplied) {
          try {
            const res = await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'get-answer', roomId: this.roomId })
            });
            const json = await res.json();
            if (json.answer && this.peer.signalingState === 'have-local-offer') {
              await this.peer.setRemoteDescription(new RTCSessionDescription(json.answer));
              answerApplied = true;
            }
          } catch (e) {}
        }

        // Fetch candidates
        try {
          const candRes = await fetch('/api/signaling', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-candidates', roomId: this.roomId, role: 'host' })
          });
          const candJson = await candRes.json();
          if (candJson.candidates && Array.isArray(candJson.candidates)) {
            for (const c of candJson.candidates) {
              try {
                await this.peer.addIceCandidate(new RTCIceCandidate(c));
              } catch {}
            }
          }
        } catch (e) {}
      }, 1000);
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

// iPhone Side: Sender that captures camera stream and sends it to Studio
export class RemoteCameraSender {
  private peer: RTCPeerConnection | null = null;
  private roomId: string;
  private stream: MediaStream | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private onStatusChange: (status: 'idle' | 'waiting' | 'connected' | 'disconnected' | 'error', message?: string) => void;

  constructor(
    roomId: string,
    onStatusChange: (status: 'idle' | 'waiting' | 'connected' | 'disconnected' | 'error', message?: string) => void
  ) {
    this.roomId = roomId;
    this.onStatusChange = onStatusChange;
  }

  public async start(stream: MediaStream) {
    this.stop();
    this.stream = stream;
    this.onStatusChange('waiting', 'מתחבר לאולפן...');

    try {
      this.peer = new RTCPeerConnection(RTC_CONFIG);

      // Add local iPhone camera tracks
      stream.getTracks().forEach(track => {
        if (this.peer && this.stream) {
          this.peer.addTrack(track, this.stream);
        }
      });

      this.peer.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'send-candidate',
                roomId: this.roomId,
                role: 'client',
                data: event.candidate
              })
            });
          } catch {}
        }
      };

      this.peer.onconnectionstatechange = () => {
        if (!this.peer) return;
        if (this.peer.connectionState === 'connected') {
          this.onStatusChange('connected', 'מחובר לאולפן ומשדר באיכות גבוהה!');
        } else if (this.peer.connectionState === 'disconnected' || this.peer.connectionState === 'failed') {
          this.onStatusChange('disconnected', 'החיבור לאולפן נותק');
        }
      };

      // Poll for studio offer
      let offerAnswered = false;
      this.pollInterval = setInterval(async () => {
        if (!this.peer) return;

        if (!offerAnswered) {
          try {
            const res = await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'get-offer', roomId: this.roomId })
            });
            const json = await res.json();
            if (json.offer && this.peer.signalingState === 'stable') {
              await this.peer.setRemoteDescription(new RTCSessionDescription(json.offer));
              const answer = await this.peer.createAnswer();
              await this.peer.setLocalDescription(answer);

              await fetch('/api/signaling', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'send-answer',
                  roomId: this.roomId,
                  role: 'client',
                  data: answer
                })
              });
              offerAnswered = true;
            }
          } catch (e) {
            console.error('Signaling error on mobile:', e);
          }
        }

        // Fetch candidates from host
        try {
          const candRes = await fetch('/api/signaling', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-candidates', roomId: this.roomId, role: 'client' })
          });
          const candJson = await candRes.json();
          if (candJson.candidates && Array.isArray(candJson.candidates)) {
            for (const c of candJson.candidates) {
              try {
                await this.peer.addIceCandidate(new RTCIceCandidate(c));
              } catch {}
            }
          }
        } catch (e) {}
      }, 1000);
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
