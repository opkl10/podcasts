// Real-time Dual-Screen Studio Clock Synchronizer using BroadcastChannel

export interface ClockSyncState {
  episodeId: string;
  isRecording: boolean;
  isPaused: boolean;
  recordedSeconds: number;
  activeTopicSeconds: number;
  activeTopicIndex: number;
  targetDurationMinutes: number;
  episodeTitle: string;
  season: number;
  episodeNumber: number;
  topics: { id: string; title: string; talkingPoints: string[] }[];
}

export type ClockControlAction = 
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'STOP_RECORDING' }
  | { type: 'NEXT_TOPIC' }
  | { type: 'PREV_TOPIC' }
  | { type: 'HIGHLIGHT_MARKER' };

export class StudioClockBroadcaster {
  private channel: BroadcastChannel | null = null;
  private channelName: string;

  constructor(episodeId: string, onActionReceived?: (action: ClockControlAction) => void) {
    this.channelName = `castflow_clock_${episodeId}`;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(this.channelName);
      if (onActionReceived) {
        this.channel.onmessage = (event) => {
          if (event.data && event.data._isAction) {
            onActionReceived(event.data.action);
          }
        };
      }
    }
  }

  // Primary Studio -> Second Screen
  public broadcastState(state: ClockSyncState): void {
    if (this.channel) {
      this.channel.postMessage({ _isState: true, state });
    }
    // Also save to localStorage for cross-device polling
    try {
      localStorage.setItem(`castflow_clock_state_${state.episodeId}`, JSON.stringify(state));
    } catch (e) {}
  }

  // Second Screen -> Primary Studio Control
  public sendAction(action: ClockControlAction): void {
    if (this.channel) {
      this.channel.postMessage({ _isAction: true, action });
    }
  }

  public close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}
