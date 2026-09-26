import React from 'react';
import VideoToScriptStudio from '@/components/video-script/VideoToScriptStudio';

export const metadata = {
  title: 'מנתח סרטונים ותסריטאי בעברית | CastFlow Studio',
  description: 'מנתח סרטונים באנגלית, מתמלל, מתרגם ומייצר תסריט הפקה מלא בעברית עם בימוי וטלפרומפטר.'
};

export default function VideoScriptPage() {
  return <VideoToScriptStudio />;
}
