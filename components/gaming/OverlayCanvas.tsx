'use client';

import React, { useRef } from 'react';
import { OverlayItem as OverlayItemType, OverlayType, OVERLAY_CATALOG } from './overlays/overlayTypes';
import OverlayItemWrapper from './OverlayItem';

// Dynamic imports for each overlay type
import LiveBadge from './overlays/LiveBadge';
import SessionTimer from './overlays/SessionTimer';
import AchievementPopup from './overlays/AchievementPopup';
import HealthBar from './overlays/HealthBar';
import ChatBubble from './overlays/ChatBubble';
import ScoreCounter from './overlays/ScoreCounter';
import GameTitleCard from './overlays/GameTitleCard';
import ReactionSticker from './overlays/ReactionSticker';
import LowerThird from './overlays/LowerThird';
import ReviewScore from './overlays/ReviewScore';
import VerdictBadge from './overlays/VerdictBadge';
import ProConCard from './overlays/ProConCard';
import SceneLabel from './overlays/SceneLabel';
import RatingMeter from './overlays/RatingMeter';
import TipCard from './overlays/TipCard';
import SocialBar from './overlays/SocialBar';
import Watermark from './overlays/Watermark';

interface OverlayCanvasProps {
  overlays: OverlayItemType[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPositionChange: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  onToggleVisible: (id: string) => void;
  isEditing: boolean;
  timerSeconds: number; // live elapsed/remaining seconds for session timer overlays
}

function renderOverlayContent(overlay: OverlayItemType, timerSeconds: number): React.ReactNode {
  const cfg = overlay.config as any;
  switch (overlay.type) {
    case 'live_badge':        return <LiveBadge config={cfg} />;
    case 'session_timer':     return <SessionTimer config={{ ...cfg, elapsedSeconds: timerSeconds }} />;
    case 'achievement':       return <AchievementPopup config={cfg} />;
    case 'health_bar':        return <HealthBar config={cfg} />;
    case 'chat_bubble':       return <ChatBubble config={cfg} />;
    case 'score_counter':     return <ScoreCounter config={cfg} />;
    case 'game_title':        return <GameTitleCard config={cfg} />;
    case 'reaction':          return <ReactionSticker config={cfg} />;
    case 'lower_third':       return <LowerThird config={cfg} />;
    case 'review_score':      return <ReviewScore config={cfg} />;
    case 'verdict':           return <VerdictBadge config={cfg} />;
    case 'pro_con':           return <ProConCard config={cfg} />;
    case 'scene_label':       return <SceneLabel config={cfg} />;
    case 'rating_meter':      return <RatingMeter config={cfg} />;
    case 'tip_card':          return <TipCard config={cfg} />;
    case 'social_bar':        return <SocialBar config={cfg} />;
    case 'watermark':         return <Watermark config={cfg} />;
    default:                  return null;
  }
}

export default function OverlayCanvas({
  overlays,
  containerRef,
  onPositionChange,
  onRemove,
  onToggleVisible,
  isEditing,
  timerSeconds,
}: OverlayCanvasProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 20 }}>
      {overlays.map((overlay) => (
        <div key={overlay.id} className={isEditing ? 'pointer-events-auto' : ''}>
          <OverlayItemWrapper
            overlay={overlay}
            containerRef={containerRef}
            onPositionChange={onPositionChange}
            onRemove={onRemove}
            onToggleVisible={onToggleVisible}
            isEditing={isEditing}
          >
            {renderOverlayContent(overlay, timerSeconds)}
          </OverlayItemWrapper>
        </div>
      ))}
    </div>
  );
}

export { OVERLAY_CATALOG };
export type { OverlayItemType as OverlayItem, OverlayType };
