'use client';

import React, { useState } from 'react';
import { PodcastShow } from '@/lib/types';
import { savePodcast, deletePodcast } from '@/lib/storage';
import { 
  X, 
  Plus, 
  Radio, 
  Trash2, 
  Edit3, 
  Check, 
  Sparkles, 
  FolderPlus,
  Layers
} from 'lucide-react';

interface PodcastManagerModalProps {
  podcasts: PodcastShow[];
  isOpen: boolean;
  onClose: () => void;
  onUpdatePodcasts: (podcasts: PodcastShow[]) => void;
  onSelectPodcast: (id: string) => void;
}

const COLOR_OPTIONS = [
  { label: 'אינדיגו וסגול', value: 'from-indigo-600 to-purple-600' },
  { label: 'ענבר ורוז', value: 'from-amber-600 to-rose-600' },
  { label: 'אזמרגד וטורקיז', value: 'from-emerald-600 to-teal-600' },
  { label: 'כחול וציאן', value: 'from-blue-600 to-cyan-600' },
  { label: 'ורוד ופוקסיה', value: 'from-pink-600 to-fuchsia-600' },
];

export default function PodcastManagerModal({
  podcasts,
  isOpen,
  onClose,
  onUpdatePodcasts,
  onSelectPodcast
}: PodcastManagerModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('כללי');
  const [hostName, setHostName] = useState('');
  const [coverColor, setCoverColor] = useState(COLOR_OPTIONS[0].value);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setTitle('');
    setDescription('');
    setCategory('טכנולוגיה');
    setHostName('');
    setCoverColor(COLOR_OPTIONS[0].value);
    setEditingId(null);
    setIsCreating(true);
  };

  const handleStartEdit = (podcast: PodcastShow) => {
    setTitle(podcast.title);
    setDescription(podcast.description);
    setCategory(podcast.category || 'כללי');
    setHostName(podcast.hostName || '');
    setCoverColor(podcast.coverColor || COLOR_OPTIONS[0].value);
    setEditingId(podcast.id);
    setIsCreating(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const showToSave: PodcastShow = {
      id: editingId || `pod-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      hostName: hostName.trim(),
      coverColor,
      createdAt: editingId ? (podcasts.find(p => p.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    savePodcast(showToSave);

    let updatedList: PodcastShow[];
    if (editingId) {
      updatedList = podcasts.map(p => p.id === editingId ? showToSave : p);
    } else {
      updatedList = [...podcasts, showToSave];
      onSelectPodcast(showToSave.id);
    }

    onUpdatePodcasts(updatedList);
    setIsCreating(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('האם למחוק פודקאסט זה מרשימת התוכניות?')) {
      deletePodcast(id);
      const filtered = podcasts.filter(p => p.id !== id);
      onUpdatePodcasts(filtered);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl bg-[#121620] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">קטלוג וניהול תוכניות פודקאסט</h3>
              <p className="text-xs text-slate-400">צרו ונהלו מספר פודקאסטים שונים במערכת אחת</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create / Edit Form vs List */}
        {isCreating ? (
          <form onSubmit={handleSave} className="space-y-4 relative z-10 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-bold text-indigo-300">
                {editingId ? 'עריכת פודקאסט' : 'הוספת פודקאסט חדש'}
              </h4>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ביטול
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                שם הפודקאסט <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="למשל: יזמות בגובה העיניים"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">קטגוריה</label>
                <input
                  type="text"
                  placeholder="למשל: טכנולוגיה, עסקים, מדע"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">שם המגיש/ה</label>
                <input
                  type="text"
                  placeholder="למשל: ישראל ישראלי"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">תיאור הפודקאסט</label>
              <textarea
                rows={2}
                placeholder="על מה הפודקאסט, מה המטרה וקהל היעד..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Cover Color theme */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">צבע מיתוג</label>
              <div className="flex items-center gap-2">
                {COLOR_OPTIONS.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCoverColor(c.value)}
                    className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${c.value} transition-transform ${coverColor === c.value ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
              >
                ביטול
              </button>
              <button
                type="submit"
                className="flex items-center gap-1 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30"
              >
                <Check className="w-3.5 h-3.5" />
                <span>שמור פודקאסט</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">הפודקאסטים שלך ({podcasts.length}):</span>
              <button
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>פודקאסט חדש</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {podcasts.map(pod => (
                <div
                  key={pod.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${pod.coverColor || 'from-indigo-600 to-purple-600'} flex items-center justify-center text-white shrink-0 shadow-md`}>
                      <Radio className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">{pod.title}</h4>
                        {pod.category && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                            {pod.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-sm mt-0.5">
                        {pod.description || 'אין תיאור'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        onSelectPodcast(pod.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition-all"
                    >
                      סנן לפי פודקאסט זה
                    </button>

                    <button
                      onClick={() => handleStartEdit(pod)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                      title="ערוך"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {podcasts.length > 1 && (
                      <button
                        onClick={() => handleDelete(pod.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="מחק"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
