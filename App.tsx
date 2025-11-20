import React, { useState, useRef, useEffect } from 'react';
import { AppState, NoteSession } from './types';
import { Visualizer } from './components/Visualizer';
import { Button } from './components/Button';
import { generateNotesFromAudio } from './services/geminiService';

// Icons
const MicIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>;
const StopIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>;
const SparklesIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 3.214L13 21l-2.286-6.857L5 12l5.714-3.214L13 3z" /></svg>;
const TrashIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const DownloadIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const ArrowLeftIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>;

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [session, setSession] = useState<NoteSession | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  // Format seconds into MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setError(null);
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);
      
      mediaRecorderRef.current = new MediaRecorder(audioStream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); // Use webm for general compatibility
        const url = URL.createObjectURL(blob);
        setSession({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          audioBlob: blob,
          audioUrl: url,
          duration: duration,
          notes: null
        });
        
        // Cleanup stream tracks
        audioStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };

      mediaRecorderRef.current.start();
      setAppState(AppState.RECORDING);
      
      // Start timer
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error(err);
      setError("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && appState === AppState.RECORDING) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setAppState(AppState.REVIEW);
    }
  };

  const generateNotes = async () => {
    if (!session?.audioBlob) return;

    setAppState(AppState.PROCESSING);
    try {
      const notes = await generateNotesFromAudio(session.audioBlob);
      setSession(prev => prev ? { ...prev, notes } : null);
      setAppState(AppState.COMPLETED);
    } catch (e) {
      setError("Failed to generate notes. Please try again.");
      setAppState(AppState.REVIEW);
    }
  };

  const reset = () => {
    setAppState(AppState.IDLE);
    setSession(null);
    setDuration(0);
    setError(null);
  };

  // Markdown renderer (simple version)
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    // Basic parsing for headers and bullet points to render semantic HTML
    // Note: For production, use 'react-markdown'. Here we do simple mapping for safety and zero-deps.
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) return <h3 key={idx} className="text-lg font-semibold text-slate-800 mt-4 mb-2">{line.replace('### ', '')}</h3>;
      if (line.startsWith('## ')) return <h2 key={idx} className="text-xl font-bold text-slate-900 mt-6 mb-3 border-b pb-1">{line.replace('## ', '')}</h2>;
      if (line.startsWith('# ')) return <h1 key={idx} className="text-2xl font-bold text-indigo-700 mt-6 mb-4">{line.replace('# ', '')}</h1>;
      if (line.startsWith('- ') || line.startsWith('* ')) return <li key={idx} className="ml-4 text-slate-700 mb-1">{line.substring(2)}</li>;
      if (line.match(/^\d+\. /)) return <li key={idx} className="ml-4 text-slate-700 mb-1 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
      if (line.startsWith('**') && line.endsWith('**')) return <p key={idx} className="font-bold text-slate-800 mt-2 mb-1">{line.replace(/\*\*/g, '')}</p>;
      if (line.trim() === '') return <div key={idx} className="h-2"></div>;
      return <p key={idx} className="text-slate-700 mb-2 leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">L</div>
            <h1 className="font-bold text-xl text-slate-800 tracking-tight">LectureLogic</h1>
          </div>
          <div className="text-sm font-medium text-slate-500">
            {appState === AppState.IDLE && "Ready to record"}
            {appState === AppState.RECORDING && <span className="text-red-500 flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> Recording</span>}
            {appState === AppState.REVIEW && "Review Audio"}
            {appState === AppState.PROCESSING && "AI is thinking..."}
            {appState === AppState.COMPLETED && "Notes Ready"}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 flex flex-col">
        
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             {error}
          </div>
        )}

        {/* Initial State / Recording State */}
        {(appState === AppState.IDLE || appState === AppState.RECORDING) && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            
            {appState === AppState.RECORDING && (
              <div className="w-full mb-8">
                <Visualizer stream={stream} isRecording={true} />
                <div className="text-center mt-4 text-3xl font-mono font-medium text-slate-700">
                  {formatTime(duration)}
                </div>
              </div>
            )}

            {appState === AppState.IDLE && (
               <div className="text-center mb-12">
                 <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
                    <MicIcon />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900 mb-2">Capture your lecture</h2>
                 <p className="text-slate-500">Press the button below to start recording.</p>
               </div>
            )}

            <div className="flex items-center gap-6">
               {appState === AppState.IDLE ? (
                  <button 
                    onClick={startRecording}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xl transition-transform hover:scale-105 active:scale-95 focus:outline-none ring-4 ring-red-100"
                  >
                    <div className="w-8 h-8 bg-white rounded-sm"></div>
                  </button>
               ) : (
                 <button 
                   onClick={stopRecording}
                   className="w-20 h-20 rounded-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center shadow-xl transition-transform hover:scale-105 active:scale-95 focus:outline-none animate-pulse-ring"
                 >
                   <div className="w-8 h-8 bg-white rounded-sm"></div>
                 </button>
               )}
            </div>
            <p className="mt-8 text-sm text-slate-400">
               {appState === AppState.RECORDING ? "Tap to stop" : "Tap to record"}
            </p>
          </div>
        )}

        {/* Review & Processing State */}
        {(appState === AppState.REVIEW || appState === AppState.PROCESSING) && session && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Recording Review</h2>
            
            <div className="bg-slate-50 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center gap-4">
               <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
               </div>
               <div className="flex-1 w-full">
                 <audio 
                   src={session.audioUrl!} 
                   controls 
                   className="w-full h-10 accent-indigo-600" 
                 />
               </div>
               <div className="text-sm font-mono text-slate-500 shrink-0">
                 {formatTime(session.duration)}
               </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-slate-100 pt-6">
               <Button variant="ghost" onClick={reset} disabled={appState === AppState.PROCESSING}>
                 Discard
               </Button>
               <Button 
                 onClick={generateNotes} 
                 icon={appState === AppState.PROCESSING ? undefined : <SparklesIcon />}
                 disabled={appState === AppState.PROCESSING}
               >
                 {appState === AppState.PROCESSING ? "Transcribing & Summarizing..." : "Generate Notes"}
               </Button>
            </div>
          </div>
        )}

        {/* Completed / Notes View */}
        {appState === AppState.COMPLETED && session && (
          <div className="animate-slide-up">
             {/* Actions Bar */}
             <div className="flex items-center justify-between mb-6">
                <Button variant="secondary" onClick={reset} icon={<ArrowLeftIcon />} className="!px-4 !py-2 text-sm">
                  New Recording
                </Button>
                <div className="flex gap-2">
                  {/* Placeholder for actual download logic if implemented, currently just UI */}
                  <Button 
                    variant="ghost" 
                    className="!px-3 !py-2" 
                    onClick={() => window.print()}
                    title="Print or Save to PDF"
                  >
                    <DownloadIcon />
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="!px-3 !py-2 text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={reset}
                    title="Delete"
                  >
                    <TrashIcon />
                  </Button>
                </div>
             </div>

             {/* Audio Player Mini */}
             <div className="bg-white border border-slate-200 rounded-xl p-3 mb-6 flex items-center gap-3 shadow-sm">
               <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" /></svg>
               </div>
               <audio src={session.audioUrl!} controls className="flex-1 h-8" />
             </div>

             {/* Notes Content */}
             <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
               <div className="h-2 bg-indigo-600 w-full"></div>
               <div className="p-8">
                 <div className="prose prose-indigo prose-lg max-w-none">
                   {session.notes ? renderMarkdown(session.notes) : (
                     <p className="text-slate-500 italic">No notes generated.</p>
                   )}
                 </div>
               </div>
               <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-xs text-slate-400">
                 Generated by LectureLogic & Gemini
               </div>
             </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;