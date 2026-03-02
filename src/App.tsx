/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Image as ImageIcon, 
  Sparkles, 
  Copy, 
  Download, 
  Eye, 
  Upload, 
  X, 
  Check, 
  Loader2,
  Clipboard,
  Maximize2,
  User,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileArchive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Tab = 'describe' | 'generate' | 'pose';

interface PosePlan {
  title: string;
  description: string;
  cameraAngle: string;
}

interface PoseResult {
  id: string;
  plan: PosePlan;
  imageUrl: string | null;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
}

const CAMERA_ANGLES = [
  'Eye Level', 'High Angle', 'Low Angle', 'Bird’s Eye View', 
  'Worm’s Eye View', 'Over the Shoulder', 'Close-up', 
  'Wide Shot', 'Dutch Angle', 'Profile Side Angle'
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('describe');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Studio Pose States
  const [poseCount, setPoseCount] = useState(4);
  const [poseResults, setPoseResults] = useState<PoseResult[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Clipboard Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const newImages: string[] = [];
      let lastMimeType = imageMimeType;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            lastMimeType = blob.type;
            const reader = new FileReader();
            reader.onload = (event) => {
              const resultStr = event.target?.result as string;
              if (activeTab === 'generate') {
                setSelectedImages(prev => {
                  if (prev.length < 4) return [...prev, resultStr];
                  return prev;
                });
              } else {
                setSelectedImages([resultStr]);
              }
              setImageMimeType(lastMimeType);
              resetOutputs();
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab, imageMimeType]);

  const resetOutputs = () => {
    setResult(null);
    setGeneratedImageUrl(null);
    setPoseResults([]);
    setPreviewIndex(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList = Array.from(files) as File[];
      const limit = activeTab === 'generate' ? 4 - selectedImages.length : 1;
      const filesToProcess = fileList.slice(0, limit);

      filesToProcess.forEach((file: File) => {
        setImageMimeType(file.type);
        const reader = new FileReader();
        reader.onload = (event) => {
          const resultStr = event.target?.result as string;
          if (activeTab === 'generate') {
            setSelectedImages(prev => [...prev, resultStr]);
          } else {
            setSelectedImages([resultStr]);
          }
          resetOutputs();
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    const imageFiles = files.filter((f: File) => f.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      const limit = activeTab === 'generate' ? 4 - selectedImages.length : 1;
      const filesToProcess = imageFiles.slice(0, limit);

      filesToProcess.forEach((file: File) => {
        setImageMimeType(file.type);
        const reader = new FileReader();
        reader.onload = (event) => {
          const resultStr = event.target?.result as string;
          if (activeTab === 'generate') {
            setSelectedImages(prev => [...prev, resultStr]);
          } else {
            setSelectedImages([resultStr]);
          }
          resetOutputs();
        };
        reader.readAsDataURL(file);
      });
    }
  }, [activeTab, selectedImages]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const clearImages = () => {
    setSelectedImages([]);
    resetOutputs();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    resetOutputs();
  };

  const handleDescribe = async () => {
    if (selectedImages.length === 0) return;
    setLoading(true);
    setResult(null);

    try {
      const base64Data = selectedImages[0].split(',')[1];
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: imageMimeType,
                data: base64Data,
              },
            },
            {
              text: "Describe the image in detail. STRICT RULE: Do not describe ethnicity, hair, hair style, hair color, mustache, beard, or any facial/head features except for facial expressions. After the main subject, always add the phrase '(gambar referensi)'. Do not use any introductory phrases. Output the description directly in Indonesian.",
            },
          ],
        },
      });

      setResult(response.text || "Gagal mendeskripsikan gambar.");
    } catch (error) {
      console.error("Error describing image:", error);
      setResult("Terjadi kesalahan saat memproses gambar.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (selectedImages.length === 0 || !prompt) return;
    setLoading(true);
    setGeneratedImageUrl(null);

    try {
      const parts = selectedImages.map(img => ({
        inlineData: {
          data: img.split(',')[1],
          mimeType: imageMimeType,
        },
      }));

      parts.push({ text: prompt } as any);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: parts as any,
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setGeneratedImageUrl(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setLoading(false);
    }
  };

  // Studio Pose Logic
  const generatePoseWithRetry = async (plan: PosePlan, base64Data: string, attempt = 1): Promise<string> => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: imageMimeType } },
            { text: `Change the pose of the subject in the image to: ${plan.description}. Camera angle: ${plan.cameraAngle}. Keep the identity, clothing, and background consistent.` }
          ]
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("No image data in response");
    } catch (error: any) {
      if (attempt < 5 && (error?.status === 429 || error?.message?.includes('429'))) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
        return generatePoseWithRetry(plan, base64Data, attempt + 1);
      }
      throw error;
    }
  };

  const handleStudioPose = async () => {
    if (selectedImages.length === 0) return;
    setIsPlanning(true);
    setPoseResults([]);
    
    try {
      const base64Data = selectedImages[0].split(',')[1];
      
      // Phase 1: Planning (AI Stylist)
      const planningResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: imageMimeType, data: base64Data } },
            { text: `You are an AI Stylist. Create ${poseCount} creative pose variations for the subject in this image. 
              For each pose, provide:
              1. A short title.
              2. A detailed description of the pose.
              3. A professional camera angle from this list: ${CAMERA_ANGLES.join(', ')}.
              
              Return the result as a JSON array of objects with keys: "title", "description", "cameraAngle".` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                cameraAngle: { type: Type.STRING }
              },
              required: ["title", "description", "cameraAngle"]
            }
          }
        }
      });

      const plans: PosePlan[] = JSON.parse(planningResponse.text || "[]");
      setIsPlanning(false);

      const initialResults: PoseResult[] = plans.map((plan, i) => ({
        id: `pose-${i}-${Date.now()}`,
        plan,
        imageUrl: null,
        status: 'loading'
      }));
      setPoseResults(initialResults);

      // Phase 2: Generation (Simultaneous)
      plans.forEach((plan, index) => {
        processIndividualPose(plan, index, base64Data);
      });

    } catch (error) {
      console.error("Planning error:", error);
      setIsPlanning(false);
    }
  };

  const processIndividualPose = async (plan: PosePlan, index: number, base64Data: string) => {
    try {
      const imageUrl = await generatePoseWithRetry(plan, base64Data);
      setPoseResults(prev => {
        const next = [...prev];
        next[index] = { ...next[index], imageUrl, status: 'success' };
        return next;
      });
    } catch (error) {
      console.error(`Error generating pose ${index}:`, error);
      setPoseResults(prev => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'error', error: 'Gagal memproses pose.' };
        return next;
      });
    }
  };

  const regeneratePose = async (index: number) => {
    if (selectedImages.length === 0) return;
    const base64Data = selectedImages[0].split(',')[1];
    
    setPoseResults(prev => {
      const next = [...prev];
      next[index] = { ...next[index], status: 'loading', imageUrl: null, error: undefined };
      return next;
    });

    processIndividualPose(poseResults[index].plan, index, base64Data);
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder("n-rav-studio-pose");
    
    const successfulResults = poseResults.filter(r => r.status === 'success' && r.imageUrl);
    
    for (let i = 0; i < successfulResults.length; i++) {
      const res = successfulResults[i];
      const base64Data = res.imageUrl!.split(',')[1];
      folder?.file(`${res.plan.title.replace(/\s+/g, '_')}_${i + 1}.png`, base64Data, { base64: true });
    }

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `studio-pose-batch-${Date.now()}.zip`;
    link.click();
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadSingleImage = (url: string, title: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}.png`;
    link.click();
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full flex flex-col items-center mb-12"
      >
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 rounded-xl emerald-glow flex items-center justify-center bg-zinc-950 border border-emerald-500/20 text-emerald-500 font-black text-2xl">
            A5
          </div>
          <h1 className="text-4xl font-bold tracking-tighter">N-Rav</h1>
        </div>
        <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Professional Visual Intelligence</p>
      </motion.header>

      {/* Tabs */}
      <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 mb-8 w-full max-w-lg">
        <button
          onClick={() => { setActiveTab('describe'); clearImages(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'describe' 
              ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20' 
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ImageIcon size={18} />
          Deskripsi
        </button>
        <button
          onClick={() => { setActiveTab('generate'); clearImages(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'generate' 
              ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20' 
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles size={18} />
          Generate
        </button>
        <button
          onClick={() => { setActiveTab('pose'); clearImages(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'pose' 
              ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20' 
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <User size={18} />
          Studio Pose
        </button>
      </div>

      {/* Main Content */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Input (4 cols) */}
        <motion.div 
          layout
          className="lg:col-span-4 space-y-6"
        >
          <div 
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`relative aspect-square rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden ${
              isDragging 
                ? 'border-emerald-500 bg-emerald-500/5' 
                : selectedImages.length > 0 ? 'border-zinc-800' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30'
            }`}
          >
            {selectedImages.length > 0 ? (
              <div className={`w-full h-full p-2 grid ${selectedImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden">
                    <img src={img} alt={`Selected ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-zinc-950/80 hover:bg-zinc-950 rounded-full text-zinc-400 hover:text-white transition-colors border border-white/10 opacity-0 group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {activeTab === 'generate' && selectedImages.length < 4 && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center cursor-pointer bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-dashed border-zinc-700 transition-colors"
                  >
                    <Upload size={20} className="text-zinc-500" />
                    <span className="text-[10px] text-zinc-500 mt-1">Tambah</span>
                  </div>
                )}
                <button 
                  onClick={clearImages}
                  className="absolute top-4 right-4 p-2 bg-zinc-950/80 hover:bg-zinc-950 rounded-full text-zinc-400 hover:text-white transition-colors border border-white/10 z-10"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center cursor-pointer p-8 text-center"
              >
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 text-zinc-500">
                  <Upload size={28} />
                </div>
                <p className="text-zinc-300 font-medium mb-1">Klik atau Drag & Drop</p>
                <p className="text-zinc-500 text-xs">Mendukung Paste dari Clipboard (Ctrl+V)</p>
                {activeTab === 'generate' && <p className="text-emerald-500/60 text-[10px] mt-2 font-bold uppercase tracking-widest">Maksimal 4 Foto Referensi</p>}
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              multiple={activeTab === 'generate'}
              className="hidden" 
            />
          </div>

          {activeTab === 'generate' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Prompt Modifikasi</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Contoh: Ubah latar belakang menjadi cyberpunk neon..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors resize-none h-32"
              />
            </div>
          )}

          {activeTab === 'pose' && (
            <div className="space-y-4 glass-panel p-4 rounded-xl">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Jumlah Pose</label>
                <span className="text-emerald-500 font-bold">{poseCount}</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={poseCount} 
                onChange={(e) => setPoseCount(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                <span>1 POSE</span>
                <span>10 POSES</span>
              </div>
            </div>
          )}

          <button
            disabled={loading || isPlanning || selectedImages.length === 0 || (activeTab === 'generate' && !prompt)}
            onClick={activeTab === 'describe' ? handleDescribe : activeTab === 'generate' ? handleGenerate : handleStudioPose}
            className="w-full bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] emerald-glow-strong"
          >
            {loading || isPlanning ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              activeTab === 'describe' ? <ImageIcon size={20} /> : activeTab === 'generate' ? <Sparkles size={20} /> : <User size={20} />
            )}
            {activeTab === 'describe' ? 'Deskripsikan Gambar' : activeTab === 'generate' ? 'Generate Gambar' : `Hasilkan ${poseCount} Pose`}
          </button>
        </motion.div>

        {/* Right Column: Output (8 cols) */}
        <motion.div 
          layout
          className="lg:col-span-8 space-y-6"
        >
          {activeTab !== 'pose' ? (
            <div className="glass-panel rounded-2xl min-h-[400px] flex flex-col relative overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Hasil Output</span>
                {activeTab === 'describe' && result && (
                  <button 
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Tersalin' : 'Salin Teks'}
                  </button>
                )}
                {activeTab === 'generate' && generatedImageUrl && (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setPreviewIndex(0)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-100 transition-colors"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={() => downloadSingleImage(generatedImageUrl!, 'n-rav-gen')}
                      className="p-1.5 text-zinc-400 hover:text-zinc-100 transition-colors"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 p-6 overflow-y-auto">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                    <div className="relative">
                      <Loader2 className="animate-spin text-emerald-500" size={40} />
                      <div className="absolute inset-0 blur-xl bg-emerald-500/20 animate-pulse"></div>
                    </div>
                    <p className="text-sm animate-pulse">Sedang memproses kecerdasan buatan...</p>
                  </div>
                ) : activeTab === 'describe' ? (
                  result ? (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-zinc-300 leading-relaxed text-lg font-light"
                    >
                      {result}
                    </motion.p>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center">
                      <ImageIcon size={48} className="mb-4 opacity-20" />
                      <p className="text-sm">Belum ada deskripsi.<br/>Unggah gambar untuk memulai.</p>
                    </div>
                  )
                ) : (
                  generatedImageUrl ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full h-full relative group cursor-pointer"
                      onClick={() => setPreviewIndex(0)}
                    >
                      <img 
                        src={generatedImageUrl} 
                        alt="Generated" 
                        className="w-full h-full object-contain rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                        <Maximize2 className="text-white" size={32} />
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center">
                      <Sparkles size={48} className="mb-4 opacity-20" />
                      <p className="text-sm">Belum ada gambar.<br/>Masukkan prompt dan gambar referensi.</p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Layers className="text-emerald-500" size={20} />
                  Pose Batch Results
                </h2>
                {poseResults.some(r => r.status === 'success') && (
                  <button 
                    onClick={downloadAllAsZip}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
                  >
                    <FileArchive size={16} />
                    Unduh Semua Pose (ZIP)
                  </button>
                )}
              </div>

              {isPlanning ? (
                <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center gap-4 text-center">
                  <Loader2 className="animate-spin text-emerald-500" size={48} />
                  <div>
                    <h3 className="text-lg font-bold mb-1">AI Stylist Sedang Merencana</h3>
                    <p className="text-zinc-500 text-sm">Menyusun variasi pose kreatif dan sudut kamera terbaik...</p>
                  </div>
                </div>
              ) : poseResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {poseResults.map((res, idx) => (
                    <motion.div 
                      key={res.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="glass-panel rounded-xl overflow-hidden flex flex-col group"
                    >
                      <div className="aspect-[4/5] relative bg-zinc-950 flex items-center justify-center overflow-hidden">
                        {res.status === 'loading' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                            <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                            <p className="text-[10px] font-mono text-zinc-500 animate-pulse">GENERATING POSE...</p>
                          </div>
                        ) : res.status === 'error' ? (
                          <div className="flex flex-col items-center gap-3 p-4 text-center">
                            <X className="text-red-500" size={32} />
                            <p className="text-xs text-zinc-500">{res.error}</p>
                            <button 
                              onClick={() => regeneratePose(idx)}
                              className="flex items-center gap-2 text-xs font-bold text-emerald-500 hover:text-emerald-400"
                            >
                              <RefreshCw size={14} />
                              Coba Lagi
                            </button>
                          </div>
                        ) : (
                          <>
                            <img 
                              src={res.imageUrl!} 
                              alt={res.plan.title} 
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                              onClick={() => setPreviewIndex(idx)}
                            />
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setPreviewIndex(idx)}
                                className="p-2 bg-zinc-950/80 rounded-lg text-white hover:bg-emerald-500 transition-colors"
                              >
                                <Eye size={16} />
                              </button>
                              <button 
                                onClick={() => downloadSingleImage(res.imageUrl!, res.plan.title)}
                                className="p-2 bg-zinc-950/80 rounded-lg text-white hover:bg-emerald-500 transition-colors"
                              >
                                <Download size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="p-3 border-t border-zinc-800">
                        <h4 className="text-sm font-bold text-zinc-200 truncate">{res.plan.title}</h4>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{res.plan.cameraAngle}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-zinc-600 text-center">
                  <User size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">Belum ada pose yang dihasilkan.<br/>Unggah foto subjek untuk memulai transformasi pose.</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setPreviewIndex(null)}
          >
            <div className="absolute top-4 left-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded border border-emerald-500/20 bg-zinc-950 flex items-center justify-center text-emerald-500 font-black text-sm">
                A5
              </div>
              <span className="font-bold tracking-tighter text-xl">N-Rav</span>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); setPreviewIndex(null); }}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={32} />
            </button>

            {/* Navigation */}
            {activeTab === 'pose' && poseResults.length > 1 && (
              <>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setPreviewIndex(prev => prev! > 0 ? prev! - 1 : poseResults.length - 1); 
                  }}
                  className="absolute left-4 p-4 bg-zinc-900/50 hover:bg-emerald-500 rounded-full text-white transition-all border border-zinc-800"
                >
                  <ChevronLeft size={32} />
                </button>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setPreviewIndex(prev => prev! < poseResults.length - 1 ? prev! + 1 : 0); 
                  }}
                  className="absolute right-4 p-4 bg-zinc-900/50 hover:bg-emerald-500 rounded-full text-white transition-all border border-zinc-800"
                >
                  <ChevronRight size={32} />
                </button>
              </>
            )}

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full flex flex-col items-center gap-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative group">
                <img 
                  src={activeTab === 'pose' ? poseResults[previewIndex].imageUrl! : generatedImageUrl!} 
                  alt="Full Preview" 
                  className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-zinc-800"
                  referrerPolicy="no-referrer"
                />
              </div>

              {activeTab === 'pose' && (
                <div className="text-center max-w-2xl">
                  <h3 className="text-2xl font-bold text-white mb-2">{poseResults[previewIndex].plan.title}</h3>
                  <p className="text-zinc-400 text-sm mb-4">{poseResults[previewIndex].plan.description}</p>
                  <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-500 text-xs font-bold uppercase tracking-widest">
                    {poseResults[previewIndex].plan.cameraAngle}
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => downloadSingleImage(
                    activeTab === 'pose' ? poseResults[previewIndex].imageUrl! : generatedImageUrl!, 
                    activeTab === 'pose' ? poseResults[previewIndex].plan.title : 'n-rav-gen'
                  )}
                  className="flex items-center gap-2 bg-emerald-500 text-zinc-950 px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20"
                >
                  <Download size={20} />
                  Simpan Gambar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-auto py-8 text-zinc-600 text-xs font-mono tracking-widest uppercase">
        &copy; 2024 N-RAV AI Systems // Neural Vision Engine
      </footer>
    </div>
  );
}
