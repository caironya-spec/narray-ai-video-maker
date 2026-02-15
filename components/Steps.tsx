import React, { useCallback, useState } from 'react';
import { AppState, AspectRatio, Slide } from '../types';
import { STYLE_OPTIONS, VOICE_OPTIONS, TONE_OPTIONS, SPEEDS } from '../constants';
import { Check, Mic, Music, Layout, Upload, RefreshCw, Volume2, FileText, Loader2, Play, AudioLines, Sparkles, PencilLine, Wand2 } from 'lucide-react';
import { cn, convertPdfToImages } from '../utils';

// --- Step 0: Aspect Ratio ---
export const AspectRatioStep: React.FC<{
  value: AspectRatio;
  onChange: (val: AspectRatio) => void;
}> = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-8 h-full items-center justify-center p-8">
    <button onClick={() => onChange('16:9')} className={cn("flex flex-col items-center justify-center h-80 rounded-2xl border-4 transition-all hover:scale-105", value === '16:9' ? "border-blue-500 bg-blue-50 shadow-xl" : "border-gray-200 bg-white hover:border-blue-200")}>
      <div className="w-32 h-20 border-2 border-current rounded mb-4 bg-gray-200" />
      <span className="text-2xl font-bold">가로형 (16:9)</span>
    </button>
    <button onClick={() => onChange('9:16')} className={cn("flex flex-col items-center justify-center h-80 rounded-2xl border-4 transition-all hover:scale-105", value === '9:16' ? "border-blue-500 bg-blue-50 shadow-xl" : "border-gray-200 bg-white hover:border-blue-200")}>
      <div className="w-20 h-32 border-2 border-current rounded mb-4 bg-gray-200" />
      <span className="text-2xl font-bold">세로형 (9:16)</span>
    </button>
  </div>
);

// --- Step 1: Video Style ---
export const StyleStep: React.FC<{ selectedId: string; onChange: (id: string) => void; }> = ({ selectedId, onChange }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {STYLE_OPTIONS.map((style) => (
      <button key={style.id} onClick={() => onChange(style.id)} className={cn("text-left p-6 rounded-xl border-2 transition-all hover:shadow-md", selectedId === style.id ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-gray-200 bg-white")}>
        <div className="flex justify-between items-start mb-2"><h3 className="text-xl font-bold text-gray-800">{style.label}</h3>{selectedId === style.id && <Check className="text-blue-600" />}</div>
        <p className="text-gray-600">{style.description}</p>
      </button>
    ))}
  </div>
);

// --- Step 2: Voice & Speed ---
export const VoiceStep: React.FC<{ voiceId: string; speed: number; onVoiceChange: (id: string) => void; onSpeedChange: (speed: number) => void; }> = ({ voiceId, speed, onVoiceChange, onSpeedChange }) => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {VOICE_OPTIONS.map((voice) => (
        <button key={voice.id} onClick={() => onVoiceChange(voice.id)} className={cn("flex items-center p-4 rounded-xl border-2 transition-all", voiceId === voice.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50")}>
          <div className={cn("p-3 rounded-full mr-4", voice.gender === 'Male' ? "bg-indigo-100 text-indigo-600" : "bg-pink-100 text-pink-600")}><Mic className="w-6 h-6" /></div>
          <div className="text-left flex-1"><div className="font-bold text-lg">{voice.name}</div><div className="text-sm text-gray-500">{voice.description}</div></div>
          {voiceId === voice.id && <Check className="text-blue-600" />}
        </button>
      ))}
    </div>
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <h3 className="text-lg font-bold mb-4 flex items-center"><RefreshCw className="w-5 h-5 mr-2" /> 속도 조절</h3>
      <div className="flex gap-4">{SPEEDS.map((s) => (
        <button key={s} onClick={() => onSpeedChange(s)} className={cn("flex-1 py-3 px-4 rounded-lg font-medium border-2 transition-colors", speed === s ? "border-blue-500 bg-blue-600 text-white" : "border-gray-200 hover:border-blue-300 text-gray-700")}>{s}x</button>
      ))}</div>
    </div>
  </div>
);

// --- Step 3: Tone ---
export const ToneStep: React.FC<{ selectedId: string; onChange: (id: string) => void; }> = ({ selectedId, onChange }) => (
  <div className="space-y-4">
    {TONE_OPTIONS.map((tone) => (
      <button key={tone.id} onClick={() => onChange(tone.id)} className={cn("w-full flex items-center p-5 rounded-xl border-2 transition-all text-left", selectedId === tone.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50")}>
        <div className="p-3 bg-purple-100 text-purple-600 rounded-lg mr-4"><Music className="w-6 h-6" /></div>
        <div><h3 className="text-xl font-bold">{tone.label}</h3><p className="text-gray-500">{tone.description}</p></div>
        {selectedId === tone.id && <div className="ml-auto"><Check className="text-blue-600 w-6 h-6" /></div>}
      </button>
    ))}
  </div>
);

// --- Step 4: Upload ---
export const UploadStep: React.FC<{ slides: Slide[]; onAddSlides: (files: File[]) => void; onRemoveSlide: (id: string) => void; aspectRatio: AspectRatio; }> = ({ slides, onAddSlides, onRemoveSlide, aspectRatio }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing || !e.target.files) return;
    setIsProcessing(true);
    const rawFiles = Array.from(e.target.files) as File[];
    const files = rawFiles.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    const processed: File[] = [];
    for (const f of files) { 
      if (f.type === 'application/pdf') {
        const images = await convertPdfToImages(f);
        processed.push(...images);
      } else {
        processed.push(f);
      }
    }
    onAddSlides(processed);
    setIsProcessing(false);
    e.target.value = '';
  };
  return (
    <div className="h-full flex flex-col">
      <div className={cn("border-3 border-dashed border-gray-300 rounded-2xl p-10 text-center cursor-pointer mb-6", isProcessing ? "bg-gray-100 cursor-wait" : "hover:bg-gray-50")} onClick={() => !isProcessing && document.getElementById('file-upload')?.click()}>
        <input id="file-upload" type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessing} />
        {isProcessing ? <div className="animate-pulse"><Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />처리 중...</div> : <><Upload className="w-8 h-8 mx-auto mb-2 text-blue-500" /><h3 className="font-bold">이미지/PDF 업로드</h3></>}
      </div>
      <div className="grid grid-cols-4 gap-4 overflow-y-auto">{slides.map((s, i) => (
        <div key={s.id} className="relative group border rounded-lg overflow-hidden bg-white shadow-sm">
          <img src={s.previewUrl} className="w-full aspect-video object-cover" />
          <div className="p-2 flex justify-between text-xs font-bold"><span>#{i+1}</span><button onClick={() => onRemoveSlide(s.id)} className="text-red-500">삭제</button></div>
        </div>
      ))}</div>
    </div>
  );
};

// --- Step 5: Script Editor ---
export const ScriptStep: React.FC<{ 
  slides: Slide[]; 
  onUpdateScript: (id: string, text: string) => void; 
  aspectRatio: AspectRatio; 
  onPreviewAudio: (id: string, text: string) => void;
  onGenerateAll: () => void;
  onGenerateSingle: (id: string) => void;
  isGeneratingBatch: boolean;
}> = ({ slides, onUpdateScript, aspectRatio, onPreviewAudio, onGenerateAll, onGenerateSingle, isGeneratingBatch }) => {
  // Use a more stable initialization that doesn't trigger on partial state updates
  const [showChoices, setShowChoices] = useState(slides.length > 0 && slides.every(s => !s.script));

  const handleStartGenerateAll = () => {
    setShowChoices(false); // CRITICAL: Immediately hide choice screen
    onGenerateAll();
  };

  if (showChoices && !isGeneratingBatch) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-gray-800">스크립트 작성 방식을 선택하세요</h3>
          <p className="text-gray-500">AI의 도움을 받거나 직접 정성껏 작성할 수 있습니다.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button 
            onClick={() => setShowChoices(false)}
            className="flex flex-col items-center p-8 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
          >
            <div className="w-16 h-16 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 group-hover:text-blue-600">
              <PencilLine className="w-8 h-8" />
            </div>
            <span className="text-xl font-bold">직접 입력하기</span>
            <p className="text-sm text-gray-500 mt-2 text-center">원하는 내용을 자유롭게 작성합니다.</p>
          </button>
          
          <button 
            onClick={handleStartGenerateAll}
            className="flex flex-col items-center p-8 bg-white border-2 border-blue-500 rounded-2xl hover:bg-blue-600 hover:text-white transition-all group"
          >
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-700 group-hover:text-white">
              <Sparkles className="w-8 h-8" />
            </div>
            <span className="text-xl font-bold">AI로 자동 생성하기</span>
            <p className="text-sm text-gray-400 group-hover:text-blue-100 mt-2 text-center">모든 이미지를 분석하여 스크립트를 생성합니다.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2 text-blue-700 font-medium">
          <Wand2 className="w-5 h-5" /> 
          AI 스크립트 도우미
        </div>
        <div className="flex gap-2">
          <button 
            disabled={isGeneratingBatch}
            onClick={handleStartGenerateAll}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-bold shadow-md"
          >
            {isGeneratingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            전체 자동 생성
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {slides.map((s, i) => (
          <div key={s.id} className={cn(
            "flex flex-col md:flex-row gap-6 bg-white p-6 rounded-2xl shadow-sm border transition-all",
            s.isGeneratingScript ? "ring-2 ring-blue-400 border-blue-200" : "border-gray-200"
          )}>
            <div className="relative group flex-shrink-0 w-full md:w-48 aspect-video rounded-xl overflow-hidden bg-gray-100 border">
              <img src={s.previewUrl} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-bold bg-black/60 px-2 py-1 rounded">슬라이드 #{i+1}</span>
              </div>
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-700 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">{i+1}</span>
                  스크립트 내용
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onGenerateSingle(s.id)}
                    disabled={s.isGeneratingScript || isGeneratingBatch}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-gray-600 disabled:opacity-50"
                  >
                    {s.isGeneratingScript ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    AI 다시 쓰기
                  </button>
                  <button 
                    onClick={() => onPreviewAudio(s.id, s.script)} 
                    disabled={!s.script || s.isGeneratingScript}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 flex items-center gap-1.5 font-bold disabled:opacity-50"
                  >
                    <Play className="w-3 h-3 fill-current" /> 미리듣기
                  </button>
                </div>
              </div>

              {s.isGeneratingScript ? (
                <div className="h-32 bg-blue-50/50 border border-blue-100 rounded-xl flex flex-col items-center justify-center space-y-2 animate-pulse">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  <span className="text-sm text-blue-600 font-medium">AI가 이미지를 분석하여 스크립트를 작성 중입니다...</span>
                </div>
              ) : (
                <div className="relative">
                  <textarea 
                    value={s.script} 
                    onChange={e => onUpdateScript(s.id, e.target.value)} 
                    className="w-full h-32 p-4 bg-gray-50 border-2 border-gray-100 rounded-xl text-lg leading-relaxed focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none resize-none" 
                    placeholder="이곳에 나레이션 내용을 입력하거나, AI 버튼을 눌러보세요."
                  />
                  <div className={cn(
                    "absolute bottom-3 right-4 text-xs font-bold",
                    s.script.length > 130 ? "text-red-500" : "text-gray-400"
                  )}>
                    {s.script.length} / 130자
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Step 6: Sequential Audio Generation ---
export const AudioGenerationStep: React.FC<{
  slides: Slide[];
  isGenerating: boolean;
  onGenerate: () => void;
  progress: number;
}> = ({ slides, isGenerating, onGenerate, progress }) => {
  const completedCount = slides.filter(s => !!s.audioBytes).length;
  const isAllDone = completedCount === slides.length;
  return (
    <div className="max-w-md mx-auto py-10 space-y-8 text-center animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-lg border">
        <AudioLines className={cn("w-16 h-16 mx-auto mb-4", isGenerating ? "text-blue-500 animate-pulse" : "text-gray-400")} />
        <h3 className="text-2xl font-bold mb-2">나레이션 오디오 생성</h3>
        <p className="text-gray-500 mb-6">고품질 AI 음성 데이터를 1페이지씩 정성껏 생성합니다.</p>
        
        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-sm font-bold"><span>진행 상황</span><span>{completedCount} / {slides.length}</span></div>
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden"><div className="bg-blue-600 h-full transition-all duration-500 shadow-sm" style={{ width: `${progress}%` }} /></div>
        </div>

        {!isAllDone && !isGenerating && (
          <button onClick={onGenerate} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 shadow-xl transition-all">오디오 생성 시작</button>
        )}
        {isGenerating && <div className="text-blue-600 font-bold animate-pulse flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 생성 중... 잠시만 기다려주세요</div>}
        {isAllDone && <div className="text-green-600 font-bold flex items-center justify-center gap-2"><Check className="w-6 h-6" /> 모든 오디오가 준비되었습니다!</div>}
      </div>
      
      <div className="grid grid-cols-5 gap-2">{slides.map((s, i) => (
        <div key={s.id} className={cn("aspect-square rounded flex items-center justify-center border text-xs font-bold transition-colors", s.audioBytes ? "bg-green-50 border-green-200 text-green-600" : "bg-white text-gray-400 border-gray-100")}>{s.isGeneratingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : s.audioBytes ? i+1 : i+1}</div>
      ))}</div>
    </div>
  );
};

// --- Step 7: Final Preview & Video Stitching ---
export const PreviewStep: React.FC<{
  slides: Slide[];
  isGenerating: boolean;
  onGenerate: () => void;
  progress: number;
  videoUrl: string | null;
}> = ({ isGenerating, onGenerate, progress, videoUrl }) => (
  <div className="max-w-2xl mx-auto text-center space-y-6 animate-fade-in">
    {videoUrl ? (
      <div className="space-y-6">
        <div className="bg-green-50 text-green-700 p-4 rounded-lg font-bold flex items-center justify-center gap-2 border border-green-100 shadow-sm"><Check /> 동영상이 완성되었습니다!</div>
        <video src={videoUrl} controls className="w-full rounded-2xl shadow-2xl bg-black max-h-[60vh]" />
        <a href={videoUrl} download="narray_video.webm" className="block w-full py-5 bg-blue-600 text-white rounded-2xl text-xl font-bold hover:bg-blue-700 shadow-xl transition-all active:scale-[0.98]">파일 다운로드 (WebM)</a>
      </div>
    ) : (
      <div className="bg-white p-10 rounded-2xl shadow-lg border">
        <Layout className="w-16 h-16 mx-auto mb-4 text-blue-500" />
        <h3 className="text-2xl font-bold mb-4">동영상 인코딩</h3>
        <p className="text-gray-500 mb-8">모든 이미지와 오디오 데이터를 합쳐서 최종 영상을 만듭니다.</p>
        {isGenerating ? (
          <div className="space-y-4">
             <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden shadow-inner"><div className="bg-blue-600 h-full transition-all" style={{ width: `${progress}%` }} /></div>
             <p className="text-blue-600 font-bold">인코딩 진행 중... {Math.round(progress)}%</p>
          </div>
        ) : (
          <button onClick={onGenerate} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-xl hover:bg-blue-700 shadow-2xl transition-all active:scale-[0.98]">동영상 인코딩 시작</button>
        )}
      </div>
    )}
  </div>
);