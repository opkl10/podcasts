'use client';

import React, { useState } from 'react';
import { TopicItem, ResourceLink } from '@/lib/types';
import { runAIResearch } from '@/lib/aiClient';
import { 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Clock, 
  Sparkles, 
  HelpCircle, 
  ListChecks, 
  Link as LinkIcon, 
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  FileText,
  Lightbulb,
  PlusCircle,
  Zap
} from 'lucide-react';

interface TopicManagerProps {
  topics: TopicItem[];
  episodeTitle: string;
  targetDurationMinutes: number;
  onUpdateTopics: (topics: TopicItem[]) => void;
  onOpenDeepResearch?: () => void;
}

export default function TopicManager({
  topics,
  episodeTitle,
  targetDurationMinutes,
  onUpdateTopics,
  onOpenDeepResearch
}: TopicManagerProps) {
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [newPointInput, setNewPointInput] = useState<{ [key: string]: string }>({});
  const [newQuestionInput, setNewQuestionInput] = useState<{ [key: string]: string }>({});
  const [newResourceTitle, setNewResourceTitle] = useState<{ [key: string]: string }>({});
  const [newResourceUrl, setNewResourceUrl] = useState<{ [key: string]: string }>({});
  
  // AI Suggestions State
  const [aiLoadingForTopic, setAiLoadingForTopic] = useState<string | null>(null);

  const totalEstimatedMinutes = topics.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);

  // Add new topic
  const handleAddTopic = () => {
    const newTopic: TopicItem = {
      id: `top-${Date.now()}`,
      title: `נושא חדש ${topics.length + 1}`,
      estimatedMinutes: 10,
      notes: '',
      talkingPoints: ['נקודה ראשונה לדיון', 'נקודה שניה לדיון'],
      questions: ['שאלה מעניינת לפתיחת הנושא?'],
      resources: [],
      completed: false,
      order: topics.length + 1
    };
    const updated = [...topics, newTopic];
    onUpdateTopics(updated);
    setEditingTopicId(newTopic.id);
  };

  // Delete topic
  const handleDeleteTopic = (id: string) => {
    if (confirm('האם למחוק נושא זה?')) {
      const updated = topics.filter(t => t.id !== id).map((t, idx) => ({ ...t, order: idx + 1 }));
      onUpdateTopics(updated);
    }
  };

  // Move topic Up / Down
  const handleMoveTopic = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= topics.length) return;

    const newTopics = [...topics];
    const temp = newTopics[index];
    newTopics[index] = newTopics[targetIndex];
    newTopics[targetIndex] = temp;

    const updated = newTopics.map((t, idx) => ({ ...t, order: idx + 1 }));
    onUpdateTopics(updated);
  };

  // Update specific topic field
  const handleTopicChange = (id: string, updates: Partial<TopicItem>) => {
    const updated = topics.map(t => (t.id === id ? { ...t, ...updates } : t));
    onUpdateTopics(updated);
  };

  // Add talking point
  const handleAddTalkingPoint = (topicId: string) => {
    const text = newPointInput[topicId]?.trim();
    if (!text) return;
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    handleTopicChange(topicId, {
      talkingPoints: [...topic.talkingPoints, text]
    });
    setNewPointInput(prev => ({ ...prev, [topicId]: '' }));
  };

  // Remove talking point
  const handleRemoveTalkingPoint = (topicId: string, pIdx: number) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const points = topic.talkingPoints.filter((_, idx) => idx !== pIdx);
    handleTopicChange(topicId, { talkingPoints: points });
  };

  // Add guest question
  const handleAddQuestion = (topicId: string) => {
    const text = newQuestionInput[topicId]?.trim();
    if (!text) return;
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    handleTopicChange(topicId, {
      questions: [...topic.questions, text]
    });
    setNewQuestionInput(prev => ({ ...prev, [topicId]: '' }));
  };

  // Remove question
  const handleRemoveQuestion = (topicId: string, qIdx: number) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const questions = topic.questions.filter((_, idx) => idx !== qIdx);
    handleTopicChange(topicId, { questions });
  };

  // Add resource
  const handleAddResource = (topicId: string) => {
    const title = newResourceTitle[topicId]?.trim();
    const url = newResourceUrl[topicId]?.trim();
    if (!title || !url) return;
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    const newRes: ResourceLink = {
      id: `res-${Date.now()}`,
      title,
      url: url.startsWith('http') ? url : `https://${url}`
    };

    handleTopicChange(topicId, {
      resources: [...topic.resources, newRes]
    });
    setNewResourceTitle(prev => ({ ...prev, [topicId]: '' }));
    setNewResourceUrl(prev => ({ ...prev, [topicId]: '' }));
  };

  // Remove resource
  const handleRemoveResource = (topicId: string, resId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    handleTopicChange(topicId, {
      resources: topic.resources.filter(r => r.id !== resId)
    });
  };

  // Live AI Generator for a specific topic
  const handleGenerateAiSuggestions = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    setAiLoadingForTopic(topicId);

    try {
      const apiKey = typeof window !== 'undefined' ? localStorage.getItem('castflow_gemini_api_key') || '' : '';
      
      const result = await runAIResearch({
        topic: topic.title,
        singleTopicTitle: topic.title,
        episodeTitle,
        mode: 'single_topic',
        apiKey: apiKey.trim() || undefined
      });

      if (result && result.data) {
        handleTopicChange(topicId, {
          notes: topic.notes ? `${topic.notes}\n\n${result.data.notes}` : result.data.notes,
          talkingPoints: [...new Set([...topic.talkingPoints, ...(result.data.talkingPoints || [])])],
          questions: [...new Set([...topic.questions, ...(result.data.questions || [])])],
          resources: [
            ...topic.resources,
            ...(result.data.resources || []).map((r: any, idx: number) => ({
              id: `res-${Date.now()}-${idx}`,
              title: r.title,
              url: r.url || 'https://google.com'
            }))
          ]
        });
      }
    } catch (err) {
      console.error('AI Suggestion error:', err);
    } finally {
      setAiLoadingForTopic(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with stats, Deep Research AI and Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-[#121620] border border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">נושאי מחקר וראשי פרקים לדיון</h2>
            <p className="text-xs text-slate-400">
              בנו את האג'נדה לפרק, הגדירו זמנים והכינו שאלות מפתח לאורח.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Duration Summary */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">זמן מתוכנן:</span>
            <span className={`font-bold ${totalEstimatedMinutes > targetDurationMinutes ? 'text-rose-400' : 'text-emerald-400'}`}>
              {totalEstimatedMinutes} מתוך {targetDurationMinutes} דק'
            </span>
          </div>

          {/* Deep Research Button */}
          {onOpenDeepResearch && (
            <button
              onClick={onOpenDeepResearch}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-purple-900/30 active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>מחקר מעמיק עם AI</span>
            </button>
          )}

          {/* Add Topic Button */}
          <button
            onClick={handleAddTopic}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700/60 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>הוסף נושא ידנית</span>
          </button>
        </div>
      </div>

      {/* Topics List */}
      <div className="space-y-4">
        {topics.map((topic, index) => {
          return (
            <div
              key={topic.id}
              className="rounded-2xl bg-[#121620] border border-slate-800/90 hover:border-slate-700 p-5 transition-all shadow-md"
            >
              {/* Top row: Order, Title, Minutes, Up/Down, Delete */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 border border-slate-700">
                    {index + 1}
                  </span>

                  <input
                    type="text"
                    value={topic.title}
                    onChange={(e) => handleTopicChange(topic.id, { title: e.target.value })}
                    className="flex-1 bg-transparent text-sm sm:text-base font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1 py-0.5"
                    placeholder="כותרת הנושא..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  {/* Estimated minutes */}
                  <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-xl text-xs">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={topic.estimatedMinutes}
                      onChange={(e) => handleTopicChange(topic.id, { estimatedMinutes: Math.max(1, Number(e.target.value)) })}
                      className="w-10 bg-transparent text-white font-bold text-center focus:outline-none"
                    />
                    <span className="text-slate-400">דק'</span>
                  </div>

                  {/* AI Assistant Generator */}
                  <button
                    onClick={() => handleGenerateAiSuggestions(topic.id)}
                    disabled={aiLoadingForTopic === topic.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 text-xs font-medium transition-all"
                    title="הצעות AI לשאלות ונקודות דיון"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-purple-400 ${aiLoadingForTopic === topic.id ? 'animate-spin' : ''}`} />
                    <span>{aiLoadingForTopic === topic.id ? 'מייצר...' : 'הרחב עם AI'}</span>
                  </button>

                  {/* Move Up/Down */}
                  <button
                    onClick={() => handleMoveTopic(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-800"
                    title="הזז למעלה"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMoveTopic(index, 'down')}
                    disabled={index === topics.length - 1}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-800"
                    title="הזז למטה"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteTopic(topic.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="מחק נושא"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Topic Notes */}
              <div className="mb-4">
                <textarea
                  rows={2}
                  value={topic.notes}
                  onChange={(e) => handleTopicChange(topic.id, { notes: e.target.value })}
                  placeholder="הערות רקע, דגשים מיוחדים, הקשר או אנקדוטה על הנושא..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Grid: Talking Points & Guest Questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Talking Points */}
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <ListChecks className="w-3.5 h-3.5" />
                      נקודות מפתח לדיון ({topic.talkingPoints.length})
                    </span>
                  </div>

                  <ul className="space-y-1.5">
                    {topic.talkingPoints.map((point, pIdx) => (
                      <li key={pIdx} className="group/item flex items-start justify-between gap-2 p-1.5 rounded-lg bg-slate-800/50 text-xs text-slate-200">
                        <div className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
                          <span className="leading-relaxed">{point}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveTalkingPoint(topic.id, pIdx)}
                          className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-rose-400 p-0.5 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Add Talking Point input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="הוסף נקודה לדיון..."
                      value={newPointInput[topic.id] || ''}
                      onChange={(e) => setNewPointInput(prev => ({ ...prev, [topic.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTalkingPoint(topic.id);
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handleAddTalkingPoint(topic.id)}
                      className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                      title="הוסף נקודה"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Guest Questions */}
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      שאלות לאורח ({topic.questions.length})
                    </span>
                  </div>

                  <ul className="space-y-1.5">
                    {topic.questions.map((question, qIdx) => (
                      <li key={qIdx} className="group/item flex items-start justify-between gap-2 p-1.5 rounded-lg bg-slate-800/50 text-xs text-slate-200">
                        <div className="flex items-start gap-2">
                          <span className="text-purple-400 font-bold shrink-0">❓</span>
                          <span className="leading-relaxed">{question}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveQuestion(topic.id, qIdx)}
                          className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-rose-400 p-0.5 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Add Question input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="הוסף שאלה לאורח..."
                      value={newQuestionInput[topic.id] || ''}
                      onChange={(e) => setNewQuestionInput(prev => ({ ...prev, [topic.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddQuestion(topic.id);
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handleAddQuestion(topic.id)}
                      className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                      title="הוסף שאלה"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Reference Links and Resources */}
              <div className="mt-3 pt-3 border-t border-slate-800/50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 text-slate-500" />
                    מקורות ומחקר:
                  </span>

                  {topic.resources.map(res => (
                    <div key={res.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-[11px] text-indigo-300 border border-slate-700/60">
                      <a href={res.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                        {res.title}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      <button
                        onClick={() => handleRemoveResource(topic.id, res.id)}
                        className="text-slate-500 hover:text-rose-400 mr-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* Add Resource Inline Form */}
                  <div className="inline-flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="שם מקור"
                      value={newResourceTitle[topic.id] || ''}
                      onChange={(e) => setNewResourceTitle(prev => ({ ...prev, [topic.id]: e.target.value }))}
                      className="w-24 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="https://..."
                      value={newResourceUrl[topic.id] || ''}
                      onChange={(e) => setNewResourceUrl(prev => ({ ...prev, [topic.id]: e.target.value }))}
                      className="w-32 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handleAddResource(topic.id)}
                      className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[11px] text-slate-200 font-medium"
                    >
                      + הוסף קישור
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
