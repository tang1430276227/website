import { useState, useRef, useCallback } from 'react';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Sparkles, Image as ImageIcon, Download, MessageSquare, Video, Music, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

// ---------- Types ----------

interface ModelCard {
  id: string;
  name: string;
  provider: string;
  description: string;
  highlights: string[];
  gradient: string;
  category: 'text' | 'image' | 'video' | 'audio';
  supportImgInput?: boolean;
}

interface GenerationRecord {
  id: string;
  prompt: string;
  result: string;
  model: string;
  category: string;
  timestamp: number;
  referenceImage?: string;
}

// ---------- Model Data ----------

const TEXT_MODELS: ModelCard[] = [
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI', description: '最新一代通用大语言模型，具备卓越的多模态理解、结构化写作和逻辑推理能力', highlights: ['多模态理解', '结构化写作', '逻辑推理', '创意生成'], gradient: 'from-emerald-500 to-teal-600', category: 'text' },
  { id: 'claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'Anthropic', description: '代码专家级模型，擅长复杂代码生成、深度分析和高质量多模态内容创作', highlights: ['代码专家', '深度分析', '高质量输出', '长上下文'], gradient: 'from-purple-500 to-pink-600', category: 'text' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'DeepSeek', description: '高性价比推理模型，适合批量文本处理、数据分析和日常对话场景', highlights: ['成本优化', '快速响应', '批量处理', '中文优化'], gradient: 'from-cyan-500 to-blue-600', category: 'text' },
];

const IMAGE_MODELS: ModelCard[] = [
  { id: 'gpt-image-2', name: 'GPT Image 2', provider: 'OpenAI', description: '新一代图像生成模型，超高细节还原和精准文字渲染，支持文生图和图生图', highlights: ['超高细节', '精准文字', '多风格', '图生图'], gradient: 'from-emerald-500 to-teal-600', category: 'image', supportImgInput: true },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', provider: 'Google', description: '最佳画质图像生成模型，精确文字嵌入和多种艺术风格支持', highlights: ['最佳画质', '文字嵌入', '艺术风格', '语义理解'], gradient: 'from-blue-500 to-indigo-600', category: 'image', supportImgInput: true },
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image', provider: 'Google', description: '高质量且高性价比的图像生成模型，快速响应适合批量创作', highlights: ['高性价比', '快速生成', '高质量', '批量创作'], gradient: 'from-amber-500 to-orange-600', category: 'image', supportImgInput: true },
];

const VIDEO_MODELS: ModelCard[] = [
  { id: 'veo-3.1-generate-001', name: 'Veo 3.1', provider: 'Google', description: '电影级视频生成模型，支持文生视频和图生视频，画面逼真细腻', highlights: ['电影级画质', '文生视频', '图生视频', '长时长'], gradient: 'from-rose-500 to-pink-600', category: 'video', supportImgInput: true },
  { id: 'seedance-2.0', name: 'Seedance 2.0', provider: 'ByteDance', description: '参考图生视频模型，支持角色一致性和复杂场景动画生成', highlights: ['角色一致', '参考图驱动', '复杂场景', '高清输出'], gradient: 'from-violet-500 to-purple-600', category: 'video', supportImgInput: true },
  { id: 'seedance-2.0-fast', name: 'Seedance 2.0 Fast', provider: 'ByteDance', description: '快速参考图生视频，闪电般的生成速度适合快速迭代', highlights: ['极速生成', '参考图驱动', '快速迭代', '高效率'], gradient: 'from-sky-500 to-blue-600', category: 'video', supportImgInput: true },
  { id: 'seedance-1-5-pro', name: 'Seedance 1.5 Pro', provider: 'ByteDance', description: '文生视频和图生视频模型，闪电般速度，支持多语言提示词', highlights: ['闪电速度', '多语言', '文生视频', '图生视频'], gradient: 'from-teal-500 to-emerald-600', category: 'video', supportImgInput: true },
  { id: 'wan2.6-t2v', name: 'Wan 2.6 T2V', provider: 'Alibaba', description: '文本生成视频模型，高性价比，支持最长15秒视频生成', highlights: ['文生视频', '高性价比', '15秒时长', '场景丰富'], gradient: 'from-orange-500 to-red-600', category: 'video' },
  { id: 'wan2.6-i2v', name: 'Wan 2.6 I2V', provider: 'Alibaba', description: '图片生成视频模型，将静态图片转化为生动视频动画', highlights: ['图生视频', '动画流畅', '高性价比', '创意转化'], gradient: 'from-indigo-500 to-violet-600', category: 'video', supportImgInput: true },
];

const AUDIO_MODELS: ModelCard[] = [
  { id: 'eleven_v3', name: 'ElevenLabs V3', provider: 'ElevenLabs', description: '高质量文本转语音模型，支持70+语言，自然流畅的语音合成', highlights: ['70+语言', '自然语音', '高质量', '情感丰富'], gradient: 'from-pink-500 to-rose-600', category: 'audio' },
  { id: 'qwen3-tts-flash', name: 'Qwen3 TTS Flash', provider: 'Alibaba', description: '闪电般的文本转语音，极低延迟适合实时场景', highlights: ['极速合成', '低延迟', '中文优化', '实时场景'], gradient: 'from-cyan-500 to-teal-600', category: 'audio' },
  { id: 'gemini-2.5-pro-preview-tts', name: 'Gemini 2.5 Pro TTS', provider: 'Google', description: '自然语音合成模型，支持30+语言，语调自然富有表现力', highlights: ['30+语言', '自然语调', '表现力强', '多场景'], gradient: 'from-amber-500 to-yellow-600', category: 'audio' },
  { id: 'scribe_v2', name: 'Scribe V2', provider: 'ElevenLabs', description: '高精度语音识别模型，支持90+语言的音频转文字', highlights: ['语音识别', '90+语言', '高精度', '长音频'], gradient: 'from-green-500 to-emerald-600', category: 'audio' },
];

// ---------- Petal Categories ----------

interface PetalCategory {
  key: string;
  name: string;
  subtitle: string;
  gradient: string;
  icon: typeof MessageSquare;
  models: ModelCard[];
  rotation: string;
  position: string;
}

const PETALS: PetalCategory[] = [
  { key: 'text', name: '心灵对话', subtitle: '文生文 · 与AI深度交流', gradient: 'from-emerald-400 to-teal-500', icon: MessageSquare, models: TEXT_MODELS, rotation: '-rotate-45', position: '-translate-x-1/2 -translate-y-1/2' },
  { key: 'image', name: '创作空间', subtitle: '文生图 · 图生图 · 视觉创造', gradient: 'from-blue-400 to-indigo-500', icon: ImageIcon, models: IMAGE_MODELS, rotation: 'rotate-45', position: 'translate-x-1/2 -translate-y-1/2' },
  { key: 'video', name: '盗梦空间', subtitle: '文生视频 · 图生视频 · 动态世界', gradient: 'from-purple-400 to-pink-500', icon: Video, models: VIDEO_MODELS, rotation: '-rotate-45', position: '-translate-x-1/2 translate-y-1/2' },
  { key: 'audio', name: '心灵声处', subtitle: '文生音频 · 语音识别 · 声音魔法', gradient: 'from-orange-400 to-rose-500', icon: Music, models: AUDIO_MODELS, rotation: 'rotate-45', position: 'translate-x-1/2 translate-y-1/2' },
];

// ---------- Utility ----------

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function generateId(): string {
  return `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Sub-components ----------

function PetalButton({ petal, onClick, delay = 0 }: { petal: PetalCategory; onClick: () => void; delay?: number }) {
  const Icon = petal.icon;
  return (
    <div className="animate-petal-bloom" style={{ animationDelay: `${delay}ms` }}>
      <button
        onClick={onClick}
        className="group relative w-40 h-40 transition-transform duration-300 hover:scale-110 hover:z-10"
        style={{ borderRadius: '50% 50% 50% 10%' }}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${petal.gradient} opacity-80 group-hover:opacity-100 transition-opacity`} style={{ borderRadius: 'inherit' }} />
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" style={{ borderRadius: 'inherit' }} />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white p-3">
          <Icon className="w-7 h-7 mb-1.5 group-hover:scale-110 transition-transform" />
          <h3 className="font-bold text-sm">{petal.name}</h3>
          <p className="text-[10px] text-white/80 text-center mt-0.5 leading-tight">{petal.subtitle}</p>
        </div>
      </button>
    </div>
  );
}

function ModelCardItem({ model, onSelect, index = 0 }: { model: ModelCard; onSelect: () => void; index?: number }) {
  const Icon = model.category === 'text' ? MessageSquare : model.category === 'image' ? ImageIcon : model.category === 'video' ? Video : Music;
  return (
    <Card className="group cursor-pointer hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 animate-slide-in"
      style={{ animationDelay: `${index * 100}ms` }} onClick={onSelect}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${model.gradient} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold group-hover:text-blue-400 transition-colors truncate">{model.name}</h3>
            <Badge variant="outline" className="text-xs">{model.provider}</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{model.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {model.highlights.map((h) => (
            <Badge key={h} variant="secondary" className="text-[11px] font-normal">
              <Sparkles className="w-2.5 h-2.5 mr-0.5" />{h}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LazyImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const onLoad = useCallback(() => setLoaded(true), []);
  const onError = useCallback(() => setError(true), []);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-secondary/50 ${className}`}>
        <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/50">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <img ref={imgRef} src={src} alt={alt} loading="lazy" onLoad={onLoad} onError={onError}
        className={`w-full h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}

// ---------- Generation Views ----------

function TextGenerationView({ model, onBack, onSave }: { model: ModelCard; onBack: () => void; onSave: (record: GenerationRecord) => void }) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState('');

  const generate = async () => {
    if (!prompt.trim()) { toast.error('请输入内容'); return; }
    setGenerating(true);
    setOutput('');
    try {
      let result = '';
      await client.ai.gentxt(
        { messages: [{ role: 'user', content: prompt.trim() }], model: model.id },
        { onStream: (chunk: string) => { result += chunk; setOutput(result); } }
      );
      onSave({ id: generateId(), prompt: prompt.trim(), result, model: model.id, category: 'text', timestamp: Date.now() });
      toast.success('生成完成');
    } catch (e: any) { toast.error(e?.message || '生成失败'); }
    setGenerating(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <ViewHeader model={model} onBack={onBack} categoryLabel="文本生成" />
      <div className="space-y-4">
        <div><Label>输入提示词</Label><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="输入你想问的问题或创作需求..." rows={4} className="resize-none mt-1" /></div>
        <Button onClick={generate} disabled={generating || !prompt.trim()} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600">
          {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 生成中...</> : <><Sparkles className="w-4 h-4 mr-2" /> 开始对话</>}
        </Button>
        {output && (
          <div className="bg-secondary/50 border border-border rounded-xl p-4 whitespace-pre-wrap text-sm max-h-96 overflow-auto">{output}</div>
        )}
      </div>
    </div>
  );
}

function ImageGenerationView({ model, onBack, onSave }: { model: ModelCard; onBack: () => void; onSave: (record: GenerationRecord) => void }) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [referenceImage, setReferenceImage] = useState<string>('');
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('图片大小不能超过10MB'); return; }
    const base64 = await fileToBase64(file);
    setReferenceImage(base64);
    toast.success('参考图片已上传');
  };

  const generate = async () => {
    if (!prompt.trim()) { toast.error('请输入图片描述'); return; }
    setGenerating(true);
    setImageUrl('');
    try {
      const params: any = { prompt: prompt.trim(), model: model.id, size: '1024x1024', quality: 'standard', n: 1 };
      if (referenceImage) params.image = referenceImage;
      const response = await client.ai.genimg(params, { timeout: 600_000 });
      const url = response.data?.images?.[0] || '';
      setImageUrl(url);
      if (url) {
        const record: GenerationRecord = { id: generateId(), prompt: prompt.trim(), result: url, model: model.id, category: 'image', timestamp: Date.now(), referenceImage: referenceImage || undefined };
        onSave(record);
        setHistory((prev) => [record, ...prev]);
      }
      toast.success('图片生成成功');
    } catch (e: any) { toast.error(e?.message || '生成失败'); }
    setGenerating(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <ViewHeader model={model} onBack={onBack} categoryLabel="图像生成" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div><Label>图片描述</Label><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="描述你想生成的图片..." rows={4} className="resize-none mt-1" /></div>
          {model.supportImgInput && (
            <div className="space-y-2">
              <Label>参考图片（图生图）</Label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              {referenceImage ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                  <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                  <button onClick={() => setReferenceImage('')} className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> 上传参考图
                </Button>
              )}
            </div>
          )}
          <Button onClick={generate} disabled={generating || !prompt.trim()} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600">
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 生成中...</> : <><Sparkles className="w-4 h-4 mr-2" /> 生成图片</>}
          </Button>
        </div>
        <div className="space-y-4">
          <div className="border border-border rounded-xl overflow-hidden bg-secondary/20 min-h-[380px] flex items-center justify-center">
            {generating ? (
              <div className="text-center space-y-3"><Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto" /><p className="text-sm text-muted-foreground">正在生成...</p></div>
            ) : imageUrl ? (
              <LazyImage src={imageUrl} alt="Generated" className="w-full h-full max-h-[500px]" />
            ) : (
              <div className="text-center space-y-2 p-8"><ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto" /><p className="text-sm text-muted-foreground">输入描述后点击生成</p></div>
            )}
          </div>
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" download><Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" /> 下载图片</Button></a>
          )}
        </div>
      </div>
      {history.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">历史生成</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {history.map((item) => (
              <div key={item.id} className="group relative rounded-lg overflow-hidden border border-border cursor-pointer" onClick={() => setImageUrl(item.result)}>
                <LazyImage src={item.result} alt={item.prompt} className="w-full h-32" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <p className="text-xs text-white line-clamp-2">{item.prompt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VideoGenerationView({ model, onBack, onSave }: { model: ModelCard; onBack: () => void; onSave: (record: GenerationRecord) => void }) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [referenceImage, setReferenceImage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('图片大小不能超过10MB'); return; }
    const base64 = await fileToBase64(file);
    setReferenceImage(base64);
    toast.success('参考图片已上传');
  };

  const generate = async () => {
    if (!prompt.trim()) { toast.error('请输入视频描述'); return; }
    setGenerating(true);
    setVideoUrl('');
    try {
      const params: any = { prompt: prompt.trim(), model: model.id };
      if (referenceImage && model.supportImgInput) params.image = referenceImage;
      const response = await client.ai.genvideo(params, { timeout: 600_000 });
      const url = response.data?.videos?.[0] || response.data?.video || '';
      setVideoUrl(url);
      if (url) {
        onSave({ id: generateId(), prompt: prompt.trim(), result: url, model: model.id, category: 'video', timestamp: Date.now(), referenceImage: referenceImage || undefined });
      }
      toast.success('视频生成成功');
    } catch (e: any) { toast.error(e?.message || '生成失败'); }
    setGenerating(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <ViewHeader model={model} onBack={onBack} categoryLabel="视频生成" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div><Label>视频描述</Label><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="描述你想生成的视频场景..." rows={4} className="resize-none mt-1" /></div>
          {model.supportImgInput && (
            <div className="space-y-2">
              <Label>参考图片（图生视频）</Label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              {referenceImage ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                  <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                  <button onClick={() => setReferenceImage('')} className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> 上传参考图
                </Button>
              )}
            </div>
          )}
          <Button onClick={generate} disabled={generating || !prompt.trim()} className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 生成中（可能需要几分钟）...</> : <><Video className="w-4 h-4 mr-2" /> 生成视频</>}
          </Button>
        </div>
        <div className="border border-border rounded-xl overflow-hidden bg-secondary/20 min-h-[380px] flex items-center justify-center">
          {generating ? (
            <div className="text-center space-y-3"><Loader2 className="w-10 h-10 animate-spin text-purple-400 mx-auto" /><p className="text-sm text-muted-foreground">正在生成视频...</p></div>
          ) : videoUrl ? (
            <video src={videoUrl} controls className="w-full h-full max-h-[500px] object-contain" />
          ) : (
            <div className="text-center space-y-2 p-8"><Video className="w-12 h-12 text-muted-foreground/30 mx-auto" /><p className="text-sm text-muted-foreground">输入描述后点击生成</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

function AudioGenerationView({ model, onBack, onSave }: { model: ModelCard; onBack: () => void; onSave: (record: GenerationRecord) => void }) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');

  const isTranscription = model.id === 'scribe_v2';

  const generate = async () => {
    if (!prompt.trim()) { toast.error(isTranscription ? '请输入音频URL' : '请输入文本内容'); return; }
    setGenerating(true);
    setAudioUrl('');
    try {
      if (isTranscription) {
        const response = await client.ai.transcribe({ audio_url: prompt.trim(), model: model.id }, { timeout: 300_000 });
        const text = response.data?.text || '转录完成';
        setAudioUrl(text);
        onSave({ id: generateId(), prompt: prompt.trim(), result: text, model: model.id, category: 'audio', timestamp: Date.now() });
      } else {
        const response = await client.ai.genaudio({ text: prompt.trim(), model: model.id }, { timeout: 300_000 });
        const url = response.data?.audio || response.data?.url || '';
        setAudioUrl(url);
        if (url) onSave({ id: generateId(), prompt: prompt.trim(), result: url, model: model.id, category: 'audio', timestamp: Date.now() });
      }
      toast.success(isTranscription ? '转录完成' : '音频生成成功');
    } catch (e: any) { toast.error(e?.message || '生成失败'); }
    setGenerating(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <ViewHeader model={model} onBack={onBack} categoryLabel={isTranscription ? '语音识别' : '音频生成'} />
      <div className="space-y-4">
        <div>
          <Label>{isTranscription ? '音频URL' : '文本内容'}</Label>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder={isTranscription ? '输入音频文件URL...' : '输入要转换为语音的文本...'}
            rows={4} className="resize-none mt-1" />
        </div>
        <Button onClick={generate} disabled={generating || !prompt.trim()} className="w-full bg-gradient-to-r from-orange-600 to-rose-600">
          {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 处理中...</> : <><Music className="w-4 h-4 mr-2" /> {isTranscription ? '开始转录' : '生成音频'}</>}
        </Button>
        {audioUrl && (
          isTranscription ? (
            <div className="bg-secondary/50 border border-border rounded-xl p-4 whitespace-pre-wrap text-sm max-h-64 overflow-auto">{audioUrl}</div>
          ) : (
            <div className="border border-border rounded-xl p-4">
              <audio src={audioUrl} controls className="w-full" />
              <a href={audioUrl} target="_blank" rel="noopener noreferrer" download className="block mt-2">
                <Button variant="outline" size="sm" className="w-full"><Download className="w-4 h-4 mr-1" /> 下载音频</Button>
              </a>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ViewHeader({ model, onBack, categoryLabel }: { model: ModelCard; onBack: () => void; categoryLabel: string }) {
  const Icon = model.category === 'text' ? MessageSquare : model.category === 'image' ? ImageIcon : model.category === 'video' ? Video : Music;
  return (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${model.gradient} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">{model.name}</h2>
          <p className="text-xs text-muted-foreground">{model.provider} · {categoryLabel}</p>
        </div>
      </div>
    </div>
  );
}

// ---------- Category View ----------

function CategoryView({ petal, onBack, onSelectModel }: { petal: PetalCategory; onBack: () => void; onSelectModel: (model: ModelCard) => void }) {
  const Icon = petal.icon;
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${petal.gradient} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">{petal.name}</h2>
            <p className="text-xs text-muted-foreground">{petal.subtitle}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {petal.models.map((model, i) => (
          <ModelCardItem key={model.id} model={model} index={i} onSelect={() => onSelectModel(model)} />
        ))}
      </div>
    </div>
  );
}

// ---------- Main Component ----------

type ViewState = { type: 'home' } | { type: 'category'; petal: PetalCategory } | { type: 'generate'; model: ModelCard };

export default function ModelExperiencePage() {
  const [view, setView] = useState<ViewState>({ type: 'home' });

  const saveRecord = (record: GenerationRecord) => {
    // Save to database for history
    client.entities.messages.create({
      data: {
        conversation_id: 0,
        role: 'assistant',
        content: JSON.stringify(record),
        model: record.model,
        tokens_used: 0,
      },
    }).catch(() => { /* silent fail for history save */ });
  };

  if (view.type === 'generate') {
    const model = view.model;
    const onBack = () => setView({ type: 'category', petal: PETALS.find((p) => p.key === model.category)! });
    const viewMap: Record<string, JSX.Element> = {
      text: <TextGenerationView model={model} onBack={onBack} onSave={saveRecord} />,
      image: <ImageGenerationView model={model} onBack={onBack} onSave={saveRecord} />,
      video: <VideoGenerationView model={model} onBack={onBack} onSave={saveRecord} />,
      audio: <AudioGenerationView model={model} onBack={onBack} onSave={saveRecord} />,
    };
    return viewMap[model.category] || viewMap.text;
  }

  if (view.type === 'category') {
    return <CategoryView petal={view.petal} onBack={() => setView({ type: 'home' })} onSelectModel={(model) => setView({ type: 'generate', model })} />;
  }

  // Home - 2x2 grid layout with bloom animation (no rotation)
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          模型体验中心
        </h1>
        <p className="text-muted-foreground text-sm mt-2">选择一个领域，开启AI创作之旅</p>
      </div>

      {/* 2x2 grid with bloom animation */}
      <div className="grid grid-cols-2 gap-6 place-items-center">
        {PETALS.map((petal, i) => (
          <PetalButton key={petal.key} petal={petal} delay={i * 150} onClick={() => setView({ type: 'category', petal })} />
        ))}
      </div>
    </div>
  );
}