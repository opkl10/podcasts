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
}

export default function ImageStockPickerModal({
  isOpen,
  onClose,
  onSelectImage
}: ImageStockPickerModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>('bunny'); // Default to BunnyCDN if available or all
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

  useEffect(() => {
    if (isOpen) {
      const conf = getBunnyConfig();
      setBunnyConfig(conf);
      if (conf.storageZoneName && conf.accessKey) {
        loadBunnyFiles(conf, bunnyFolder);
      } else {
        setActiveCategory('all');
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
      }
    } catch (e: any) {
      setBunnyError(e.message || 'שגיאת תקשורת עם Bunny Storage');
    } finally {
      setIsLoadingBunny(false);
    }
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
    if (!file.isImage && file.isDirectory) return false;
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
                <span>מאגר פוסטרים ותמונות קולנוע ו-BunnyCDN</span>
                {bunnyConfig.storageZoneName && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
                    🐰 {bunnyConfig.storageZoneName}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">בחרו מתוך ה-Storage של BunnyCDN, הורידו למחשב, או העלו קובץ חדש</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Upload to Bunny / Local */}
            {activeCategory === 'bunny' && bunnyConfig.storageZoneName ? (
              <>
                <button
                  onClick={() => bunnyUploadRef.current?.click()}
                  disabled={isUploadingToBunny}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all active:scale-98 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingToBunny ? 'מעלה ל-Bunny...' : 'העלה תמונה ל-BunnyCDN'}</span>
                </button>
                <input
                  ref={bunnyUploadRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadToBunny}
                  className="hidden"
                />
              </>
            ) : (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 transition-all active:scale-98"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>העלאת תמונה מהמחשב</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </>
            )}

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
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש לפי שם סרט, קובץ, או תגית..."
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Bunny Folder Selector (if in Bunny tab) */}
            {activeCategory === 'bunny' && bunnyConfig.storageZoneName && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 px-3 py-2 rounded-xl text-xs">
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <input
                  type="text"
                  value={bunnyFolder}
                  onChange={(e) => setBunnyFolder(e.target.value)}
                  placeholder="תיקייה ב-Bunny (למשל: images)..."
                  className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-36"
                />
                <button
                  onClick={() => loadBunnyFiles(bunnyConfig, bunnyFolder)}
                  disabled={isLoadingBunny}
                  className="p-1 text-slate-400 hover:text-white"
                  title="רענן קבצים"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isLoadingBunny ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* Categories */}
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
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-600/30' 
                          : 'bg-pink-600 text-white shadow')
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  {isBunny && cat.count !== undefined && cat.count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 text-amber-200">
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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
                    <h4 className="text-sm font-bold text-white">חיבור Bunny.net אינו מוגדר עדיין</h4>
                    <p className="text-xs text-slate-400">
                      הזינו את פרטי ה-Storage Zone ומפתח ה-Access Key בהגדרות כדי למשוך ולהוריד את כל קבצי המדיה שלכם ישירות לתוך האולפן.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      // Event to open Cloud Integrations Modal
                      window.dispatchEvent(new CustomEvent('open-cloud-modal'));
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg transition-all"
                  >
                    הגדרת BunnyCDN עכשיו
                  </button>
                </div>
              ) : isLoadingBunny ? (
                <div className="py-20 text-center text-slate-400 space-y-3">
                  <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-semibold text-amber-300">מושך את התמונות מ-Bunny Storage Zone ({bunnyConfig.storageZoneName})...</p>
                </div>
              ) : bunnyError ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
                  <span>{bunnyError}</span>
                  <button 
                    onClick={() => loadBunnyFiles(bunnyConfig, bunnyFolder)}
                    className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg font-bold"
                  >
                    נסה שוב
                  </button>
                </div>
              ) : filteredBunnyFiles.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredBunnyFiles.map((file) => (
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
                        className="aspect-[3/4] w-full relative bg-black overflow-hidden cursor-pointer"
                      >
                        <img
                          src={file.cdnUrl}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-bold text-amber-300 border border-amber-400/30">
                          🐰 BunnyCDN
                        </span>

                        {/* Hover Overlay with Select */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                          <span className="px-3 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-black shadow-lg flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>בחר פוסטר לאולפן</span>
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
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-500 space-y-3">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs">לא נמצאו תמונות בתיקייה זו ב-Bunny Storage Zone.</p>
                  <button
                    onClick={() => bunnyUploadRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
                  >
                    העלו תמונה ראשונה ל-BunnyCDN
                  </button>
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
