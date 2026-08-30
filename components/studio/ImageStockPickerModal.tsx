'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Image as ImageIcon, 
  Upload, 
  Search, 
  Sparkles, 
  X, 
  Check, 
  Film, 
  Tv, 
  Popcorn, 
  Mic, 
  Trophy,
  Layers,
  Download,
  ExternalLink,
  FolderOpen,
  RotateCw,
  Copy,
  AlertCircle,
  HardDrive
} from 'lucide-react';
import { 
  getBunnyConfig, 
  saveBunnyConfig,
  testBunnyStorageConnection,
  listBunnyStorageFiles, 
  uploadBlobToBunny, 
  BunnyFileItem, 
  BunnyConfig,
  DEFAULT_BUNNY_CONFIG
} from '@/lib/bunny/bunnyClient';

export interface StockImageItem {
  id: string;
  title: string;
  category: 'movies' | 'tv' | 'cinema_mood' | 'podcast_studio' | 'awards';
  url: string;
  badge?: string;
}

export const STOCK_IMAGES_LIBRARY: StockImageItem[] = [
  // 1. Movies & Blockbusters
  {
    id: 'dune2',
    title: 'חולית: חלק 2 (Dune: Part Two)',
    category: 'movies',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&q=80',
    badge: 'Sci-Fi'
  },
  {
    id: 'oppenheimer',
    title: 'אופנהיימר (Oppenheimer)',
    category: 'movies',
    url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&q=80',
    badge: 'דרמה / היסטוריה'
  },
  {
    id: 'inception',
    title: 'התחלה (Inception)',
    category: 'movies',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&q=80',
    badge: 'קלאסיקה'
  },
  {
    id: 'dark_knight',
    title: 'האביר האפל (The Dark Knight)',
    category: 'movies',
    url: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=800&q=80',
    badge: 'אקשן'
  },
  {
    id: 'matrix',
    title: 'מטריקס (The Matrix)',
    category: 'movies',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80',
    badge: 'סייברפאנק'
  },
  {
    id: 'pulp_fiction',
    title: 'ספרות זולה (Pulp Fiction)',
    category: 'movies',
    url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80',
    badge: 'קלאסיקת פשע'
  },

  // 2. TV Shows
  {
    id: 'stranger_things',
    title: 'דברים מוזרים (Stranger Things)',
    category: 'tv',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80',
    badge: 'נטפליקס'
  },
  {
    id: 'breaking_bad',
    title: 'שובר שורות (Breaking Bad)',
    category: 'tv',
    url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80',
    badge: 'סדרת מופת'
  },
  {
    id: 'succession',
    title: 'יורשים (Succession)',
    category: 'tv',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
    badge: 'HBO'
  },
  {
    id: 'last_of_us',
    title: 'האחרונים מבינינו (The Last of Us)',
    category: 'tv',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&q=80',
    badge: 'פוסט-אפוקליפסה'
  },

  // 3. Cinema Mood & Popcorn
  {
    id: 'popcorn_classic',
    title: 'דלי פופקורן קולנועי חם',
    category: 'cinema_mood',
    url: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=800&q=80',
    badge: 'פופקורן'
  },
  {
    id: 'film_clapper',
    title: 'קלאפר במאי וקולנוע',
    category: 'cinema_mood',
    url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80',
    badge: 'קולנוע'
  },
  {
    id: 'cinema_seats',
    title: 'אולם קולנוע יוקרתי (Red Seats)',
    category: 'cinema_mood',
    url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80',
    badge: 'אולם קולנוע'
  },
  {
    id: 'projector_lens',
    title: 'מקרן קולנוע ואלומת אור',
    category: 'cinema_mood',
    url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80',
    badge: 'מקרן'
  },

  // 4. Studio & Microphones
  {
    id: 'studio_mic',
    title: 'מיקרופון אולפן שידור מקצועי',
    category: 'podcast_studio',
    url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&q=80',
    badge: 'אולפן'
  },
  {
    id: 'headphones_neon',
    title: 'אוזניות אולפן וניאון סגול',
    category: 'podcast_studio',
    url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=80',
    badge: 'סאונד'
  },
  {
    id: 'on_air_neon',
    title: 'שלט ניאון ON AIR באולפן',
    category: 'podcast_studio',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
    badge: 'שידור חי'
  },

  // 5. Awards & Oscars
  {
    id: 'oscar_statue',
    title: 'טקס פרסי האוסקר והשטיח האדום',
    category: 'awards',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80',
    badge: 'אוסקר'
  }
];

interface ImageStockPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string, title?: string) => void;
  initialTarget?: 'background' | 'poster' | 'logo';
}

export default function ImageStockPickerModal({
  isOpen,
  onClose,
  onSelectImage,
  initialTarget = 'poster'
}: ImageStockPickerModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>('bunny'); // Default to BunnyCDN
  const [searchQuery, setSearchQuery] = useState('');
  const [customUploadedImages, setCustomUploadedImages] = useState<StockImageItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bunnyUploadRef = useRef<HTMLInputElement>(null);

  // Bunny.net State
  const [bunnyConfig, setBunnyConfig] = useState<BunnyConfig>(DEFAULT_BUNNY_CONFIG);
  const [bunnyFiles, setBunnyFiles] = useState<BunnyFileItem[]>([]);
  const [isLoadingBunny, setIsLoadingBunny] = useState(false);
  const [bunnyError, setBunnyError] = useState<string | null>(null);
  const [bunnyFolder, setBunnyFolder] = useState('');
  const [isUploadingToBunny, setIsUploadingToBunny] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [showConfigSettings, setShowConfigSettings] = useState(false);
  const [fileFilterMode, setFileFilterMode] = useState<'images_only' | 'all_files'>('images_only');

  // Form config state for inline Bunny settings
  const [editZoneName, setEditZoneName] = useState('');
  const [editAccessKey, setEditAccessKey] = useState('');
  const [editPullDomain, setEditPullDomain] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [isTestingConfig, setIsTestingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const conf = getBunnyConfig();
      setBunnyConfig(conf);
      setEditZoneName(conf.storageZoneName || '');
      setEditAccessKey(conf.accessKey || '');
      setEditPullDomain(conf.pullZoneUrl || '');
      setEditRegion(conf.storageRegion || '');

      if (conf.storageZoneName && conf.accessKey) {
        loadBunnyFiles(conf, bunnyFolder);
      } else {
        setShowConfigSettings(true);
      }
    }
  }, [isOpen, bunnyFolder]);

  // Load files from Bunny.net
  const loadBunnyFiles = async (conf: BunnyConfig, folder: string = '') => {
    setIsLoadingBunny(true);
    setBunnyError(null);
    try {
      const res = await listBunnyStorageFiles(conf, folder);
      if (res.success) {
        setBunnyFiles(res.files);
      } else {
        setBunnyError(res.error || 'לא הצלחנו לקרוא את קבצי Bunny Storage');
        setShowConfigSettings(true);
      }
    } catch (e: any) {
      setBunnyError(e.message || 'שגיאת תקשורת עם Bunny Storage');
      setShowConfigSettings(true);
    } finally {
      setIsLoadingBunny(false);
    }
  };

  // Test and save Bunny configuration inline
  const handleSaveAndTestBunny = async () => {
    if (!editZoneName.trim() || !editAccessKey.trim()) {
      alert('נא להזין שם Storage Zone ומפתח Access Key');
      return;
    }

    setIsTestingConfig(true);
    setConfigSuccessMsg(null);
    setBunnyError(null);

    const newConf: BunnyConfig = {
      enabled: true,
      storageZoneName: editZoneName.trim(),
      accessKey: editAccessKey.trim(),
      pullZoneUrl: editPullDomain.trim() || `${editZoneName.trim()}.b-cdn.net`,
      storageRegion: editRegion.trim(),
      folderName: 'podcasts'
    };

    try {
      saveBunnyConfig(newConf);
      setBunnyConfig(newConf);

      const testRes = await testBunnyStorageConnection(newConf);
      if (testRes.success) {
        setConfigSuccessMsg('החיבור ל-Bunny Storage הצליח ונשמר בהצלחה! מושך קבצים...');
        setTimeout(() => {
          setShowConfigSettings(false);
          setConfigSuccessMsg(null);
        }, 1500);
        await loadBunnyFiles(newConf, bunnyFolder);
      } else {
        setBunnyError(testRes.message);
      }
    } catch (err: any) {
      setBunnyError(err.message || 'שגיאה בבדיקת חיבור');
    } finally {
      setIsTestingConfig(false);
    }
  };

  // Folder navigation helper
  const navigateToFolder = (folderPath: string) => {
    setBunnyFolder(folderPath);
  };

  const navigateUp = () => {
    if (!bunnyFolder) return;
    const parts = bunnyFolder.replace(/\/+$/, '').split('/');
    parts.pop();
    setBunnyFolder(parts.join('/'));
  };

  if (!isOpen) return null;

  // Handle Direct Download of Image to User's PC
  const handleDownloadImage = async (e: React.MouseEvent, url: string, filename: string) => {
    e.stopPropagation();
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'bunny_image.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(url, '_blank');
    }
  };

  // Copy CDN link helper
  const handleCopyLink = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // Handle Local File Upload (Memory / DataURL)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
      const newItem: StockImageItem = {
        id: `upload_${Date.now()}`,
        title: cleanTitle,
        category: 'movies',
        url: dataUrl,
        badge: 'העלאה מהמחשב'
      };

      setCustomUploadedImages(prev => [newItem, ...prev]);
      onSelectImage(dataUrl, cleanTitle);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  // Upload file directly to Bunny.net Storage
  const handleUploadToBunny = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingToBunny(true);
    try {
      const res = await uploadBlobToBunny(bunnyConfig, file, file.name, bunnyFolder || 'images');
      if (res.success && res.cdnUrl) {
        await loadBunnyFiles(bunnyConfig, bunnyFolder);
        onSelectImage(res.cdnUrl, file.name.replace(/\.[^/.]+$/, ''));
        onClose();
      } else {
        alert(res.error || 'שגיאה בהעלאת הקובץ ל-Bunny');
      }
    } catch (err: any) {
      alert('שגיאה בהעלאה: ' + err.message);
    } finally {
      setIsUploadingToBunny(false);
    }
  };

  const allPresetItems = [...customUploadedImages, ...STOCK_IMAGES_LIBRARY];

  const filteredPresetItems = allPresetItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = searchQuery === '' || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.badge && item.badge.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const filteredBunnyFiles = bunnyFiles.filter(file => {
    if (fileFilterMode === 'images_only' && !file.isImage && !file.isDirectory) return false;
    if (!searchQuery) return true;
    return file.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const categories = [
    { id: 'bunny', label: '🐰 המאגר שלי ב-BunnyCDN', icon: HardDrive, count: bunnyFiles.filter(f => f.isImage).length },
    { id: 'all', label: 'כל המאגר המובנה', icon: Layers },
    { id: 'movies', label: 'סרטים ובלוקבסטרים', icon: Film },
    { id: 'tv', label: 'סדרות טלוויזיה', icon: Tv },
    { id: 'cinema_mood', label: 'פופקורן ואווירה', icon: Popcorn },
    { id: 'podcast_studio', label: 'אולפן ומיקרופונים', icon: Mic },
    { id: 'awards', label: 'פרסים ואוסקר', icon: Trophy }
  ];

  // Breadcrumbs items
  const folderBreadcrumbs = bunnyFolder ? bunnyFolder.split('/').filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in font-sans">
      <div className="w-full max-w-5xl max-h-[90vh] rounded-3xl bg-[#121620] border border-slate-800 p-5 sm:p-7 shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-pink-500/20 text-amber-400 border border-amber-500/30">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>מאגר פוסטרים, תמונות ו-BunnyCDN</span>
                {bunnyConfig.storageZoneName && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
                    🐰 {bunnyConfig.storageZoneName}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">בחרו מתוך ה-Storage של BunnyCDN, העלו פוסטר מהמחשב או ממאגר הסרטים</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Upload to Bunny / Local Buttons */}
            {activeCategory === 'bunny' && bunnyConfig.storageZoneName ? (
              <>
                <button
                  onClick={() => bunnyUploadRef.current?.click()}
                  disabled={isUploadingToBunny}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all active:scale-98 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingToBunny ? 'מעלה ל-Bunny...' : 'העלה ל-Bunny Storage'}</span>
                </button>
                <input
                  ref={bunnyUploadRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadToBunny}
                  className="hidden"
                />
              </>
            ) : null}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 transition-all active:scale-98"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>העלאה מהמחשב</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="py-4 space-y-3 shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש לפי שם סרט, קובץ, או תיקייה..."
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Bunny Controls: Toggle Credentials Settings & Filter Mode */}
            {activeCategory === 'bunny' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFileFilterMode(prev => prev === 'images_only' ? 'all_files' : 'images_only')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    fileFilterMode === 'all_files' 
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow' 
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="הצג את כל סוגי הקבצים כולל פורמטים מיוחדים"
                >
                  {fileFilterMode === 'all_files' ? '📁 כל הקבצים' : '🖼️ תמונות בלבד'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfigSettings(prev => !prev)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    showConfigSettings 
                      ? 'bg-amber-500 border-amber-400 text-black shadow font-black' 
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <span>⚙️ הגדרות CDN</span>
                </button>

                <button
                  onClick={() => loadBunnyFiles(bunnyConfig, bunnyFolder)}
                  disabled={isLoadingBunny}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
                  title="רענן קבצים מ-BunnyCDN"
                >
                  <RotateCw className={`w-4 h-4 ${isLoadingBunny ? 'animate-spin text-amber-400' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* Categories Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isBunny = cat.id === 'bunny';
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeCategory === cat.id
                      ? (isBunny 
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-600/30 font-bold' 
                          : 'bg-pink-600 text-white shadow')
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  {isBunny && cat.count !== undefined && cat.count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 text-amber-200 font-mono">
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bunny Folder Breadcrumbs Bar (if in Bunny tab) */}
          {activeCategory === 'bunny' && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none font-mono">
                <button
                  type="button"
                  onClick={() => navigateToFolder('')}
                  className={`px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold ${
                    !bunnyFolder ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>🏠 ראשי (Root)</span>
                </button>

                {folderBreadcrumbs.map((crumb, idx) => {
                  const currentPath = folderBreadcrumbs.slice(0, idx + 1).join('/');
                  const isLast = idx === folderBreadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb}>
                      <span className="text-slate-600">/</span>
                      <button
                        type="button"
                        onClick={() => navigateToFolder(currentPath)}
                        className={`px-2 py-0.5 rounded-lg font-bold ${
                          isLast ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        📁 {crumb}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {bunnyFolder && (
                <button
                  type="button"
                  onClick={navigateUp}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  <span>⬆️ תיקייה למעלה</span>
                </button>
              )}
            </div>
          )}

          {/* INLINE BUNNY CDN CONFIGURATION DRAWER */}
          {activeCategory === 'bunny' && showConfigSettings && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  <span>הגדרות חיבור ל-Bunny Storage & CDN:</span>
                </span>
                <span className="text-[10px] text-slate-400">הפרטים נשמרים מקומית בדפדפן</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 block">Storage Zone Name:</label>
                  <input
                    type="text"
                    value={editZoneName}
                    onChange={(e) => setEditZoneName(e.target.value)}
                    placeholder="שם ה-Storage Zone (למשל: mypodcast)"
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 block">Access Key (Password):</label>
                  <input
                    type="password"
                    value={editAccessKey}
                    onChange={(e) => setEditAccessKey(e.target.value)}
                    placeholder="סיסמת ה-Access Key"
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 block">Pull Zone Domain (אופציונלי):</label>
                  <input
                    type="text"
                    value={editPullDomain}
                    onChange={(e) => setEditPullDomain(e.target.value)}
                    placeholder="mypodcast.b-cdn.net"
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 block">Storage Region:</label>
                  <select
                    value={editRegion}
                    onChange={(e) => setEditRegion(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="">גרמניה / גלובלי (Main)</option>
                    <option value="uk">לונדון (UK)</option>
                    <option value="ny">ניו יורק (US East - NY)</option>
                    <option value="la">לוס אנג'לס (US West - LA)</option>
                    <option value="sg">סינגפור (Singapore)</option>
                    <option value="syd">סידני (Sydney)</option>
                    <option value="se">שטוקהולם (Stockholm)</option>
                    <option value="jh">יוהנסבורג (Johannesburg)</option>
                    <option value="br">סאו פאולו (Sao Paulo)</option>
                  </select>
                </div>
              </div>

              {configSuccessMsg && (
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center">
                  ✓ {configSuccessMsg}
                </div>
              )}

              {bunnyError && (
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold text-center">
                  ⚠️ {bunnyError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfigSettings(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  סגור
                </button>
                <button
                  type="button"
                  disabled={isTestingConfig}
                  onClick={handleSaveAndTestBunny}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isTestingConfig ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isTestingConfig ? 'בודק חיבור...' : 'שמור ובדוק חיבור ✓'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Images Grid Container */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* TAB 1: Bunny.net Storage Images */}
          {activeCategory === 'bunny' ? (
            <div>
              {!bunnyConfig.storageZoneName || !bunnyConfig.accessKey ? (
                <div className="py-16 px-6 text-center rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4 max-w-md mx-auto">
                  <HardDrive className="w-12 h-12 mx-auto text-amber-400" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">הגדרות Bunny.net עדיין לא הוזנו</h4>
                    <p className="text-xs text-slate-400">
                      הזינו את שם ה-Storage Zone ומפתח ה-Access Key כדי לגשת לכל קבצי המדיה והפוסטרים שהעליתם.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowConfigSettings(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg transition-all"
                  >
                    ⚙️ פתח הגדרות BunnyCDN
                  </button>
                </div>
              ) : isLoadingBunny ? (
                <div className="py-20 text-center text-slate-400 space-y-3">
                  <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-semibold text-amber-300">מושך את הקבצים מ-Bunny Storage Zone ({bunnyConfig.storageZoneName})...</p>
                </div>
              ) : bunnyError ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
                  <span>{bunnyError}</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowConfigSettings(true)}
                      className="px-3 py-1 bg-amber-500 text-black rounded-lg font-bold"
                    >
                      ⚙️ ערוך הגדרות
                    </button>
                    <button 
                      onClick={() => loadBunnyFiles(bunnyConfig, bunnyFolder)}
                      className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg font-bold"
                    >
                      נסה שוב
                    </button>
                  </div>
                </div>
              ) : filteredBunnyFiles.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredBunnyFiles.map((file) => {
                    // DIRECTORY CARD
                    if (file.isDirectory) {
                      return (
                        <div
                          key={file.guid}
                          onClick={() => navigateToFolder(file.path)}
                          className="group rounded-2xl overflow-hidden border border-amber-500/30 bg-slate-900 hover:bg-slate-850 hover:border-amber-400 p-4 transition-all flex flex-col items-center justify-center text-center cursor-pointer shadow-lg aspect-[3/4] space-y-2.5"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FolderOpen className="w-8 h-8" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-white group-hover:text-amber-300 truncate max-w-[130px]" title={file.name}>
                              {file.name}
                            </p>
                            <span className="text-[10px] text-amber-400 font-bold block">תיקייה (לחץ לפתיחה)</span>
                          </div>
                        </div>
                      );
                    }

                    // FILE / IMAGE CARD
                    return (
                      <div
                        key={file.guid}
                        className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 hover:border-amber-500/80 transition-all flex flex-col shadow-lg"
                      >
                        {/* Image Thumbnail */}
                        <div 
                          onClick={() => {
                            onSelectImage(file.cdnUrl, file.name.replace(/\.[^/.]+$/, ''));
                            onClose();
                          }}
                          className="aspect-[3/4] w-full relative bg-black overflow-hidden cursor-pointer flex items-center justify-center"
                        >
                          {file.isImage ? (
                            <img
                              src={file.cdnUrl}
                              alt={file.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="text-center p-3 space-y-1">
                              <ImageIcon className="w-10 h-10 mx-auto text-slate-500" />
                              <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[110px]">{file.name}</span>
                            </div>
                          )}

                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-bold text-amber-300 border border-amber-400/30">
                            🐰 BunnyCDN
                          </span>

                          {/* Hover Overlay with Select */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                            <span className="px-3 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-black shadow-lg flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>בחר פוסטר זה</span>
                            </span>
                          </div>
                        </div>

                        {/* File Details & Download Actions Bar */}
                        <div className="p-3 bg-slate-900 border-t border-slate-800/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-white truncate max-w-[130px]" title={file.name}>
                              {file.name}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {file.size > 0 ? `${(file.size / 1024).toFixed(0)} KB` : ''}
                            </span>
                          </div>

                          {/* Download & Copy Buttons */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
                            <button
                              onClick={(e) => handleDownloadImage(e, file.cdnUrl, file.name)}
                              className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                              title="הורד קובץ תמונה למחשב"
                            >
                              <Download className="w-3 h-3 text-amber-400" />
                              <span>הורדה</span>
                            </button>

                            <button
                              onClick={(e) => handleCopyLink(e, file.cdnUrl)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                              title="העתק קישור CDN"
                            >
                              {copiedUrl === file.cdnUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-500 space-y-3">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs">לא נמצאו קבצים בתיקייה זו ב-Bunny Storage Zone.</p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => bunnyUploadRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all"
                    >
                      העלו תמונה עכשיו ל-BunnyCDN
                    </button>
                    {bunnyFolder && (
                      <button
                        onClick={() => navigateToFolder('')}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
                      >
                        חזרה לתיקייה הראשית
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: Curated Stock Library */
            <div>
              {filteredPresetItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                  {filteredPresetItems.map((item) => (
                    <div
                      key={item.id}
                      className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 hover:border-pink-500/80 transition-all flex flex-col shadow-lg"
                    >
                      <div 
                        onClick={() => {
                          onSelectImage(item.url, item.title);
                          onClose();
                        }}
                        className="aspect-[3/4] w-full relative bg-slate-950 overflow-hidden cursor-pointer"
                      >
                        <img
                          src={item.url}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        {item.badge && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
                            {item.badge}
                          </span>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                          <span className="px-3 py-1.5 rounded-xl bg-pink-600 text-white text-xs font-bold shadow-lg flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>בחר תמונה זו</span>
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between">
                        <p className="text-xs font-bold text-white truncate group-hover:text-pink-300 transition-colors">
                          {item.title}
                        </p>
                        <button
                          onClick={(e) => handleDownloadImage(e, item.url, `${item.title}.jpg`)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                          title="הורד תמונה למחשב"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs">לא נמצאו תמונות התואמות לחיפוש זה.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
