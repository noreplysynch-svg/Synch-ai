import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Square, Globe, ImagePlus, X, FileText, Image, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { uploadFile as uploadFileApi, transcribeAudio } from '@/api/client';

export default function ChatInput({ onSend, isStreaming, onStop, webSearch, onToggleWebSearch }) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]); // { type: 'image'|'file', name, url, uploading }
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [text]);

  const handleSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if ((!text.trim() && attachments.length === 0) || isStreaming) return;
    const stillUploading = attachments.some(a => a.uploading);
    if (stillUploading) { toast.error('Please wait for uploads to finish'); return; }

    const fileUrls = attachments.map(a => a.url).filter(Boolean);
    onSend(text.trim(), fileUrls);
    setText('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const uploadFile = async (file, type) => {
    const id = Date.now() + Math.random();
    const previewUrl = type === 'image' ? URL.createObjectURL(file) : null;
    setAttachments(prev => [...prev, { id, type, name: file.name, url: null, previewUrl, uploading: true }]);
    try {
      const { url } = await uploadFileApi(file);
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, url, uploading: false } : a));
    } catch (err) {
      toast.error('Upload failed');
      setAttachments(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleFileChange = (e) => {
    Array.from(e.target.files).forEach(f => uploadFile(f, f.type.startsWith('image/') ? 'image' : 'file'));
    e.target.value = '';
  };

  const handleImageChange = (e) => {
    Array.from(e.target.files).forEach(f => uploadFile(f, 'image'));
    e.target.value = '';
  };

  const removeAttachment = (id) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
      return prev.filter(a => a.id !== id);
    });
  };

  // Voice recording → Whisper transcription (server-side, via Groq)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const text = await transcribeAudio(blob);
          if (text) {
            setText(prev => prev + (prev ? ' ' : '') + text);
          }
        } catch {
          toast.error('Transcription failed');
        }
        setIsTranscribing(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const canSend = (text.trim() || attachments.length > 0) && !isStreaming;

  return (
    <div className="px-3 md:px-0 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="relative bg-card border border-border rounded-2xl shadow-sm transition-shadow focus-within:shadow-md focus-within:border-primary/30">

          {/* Attachments preview */}
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-2 px-4 pt-3"
              >
                {attachments.map(att => (
                  att.type === 'image' ? (
                    <div key={att.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0 group">
                      <img
                        src={att.previewUrl || att.url}
                        alt={att.name}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      {att.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin pointer-events-none" />
                        </div>
                      )}
                      {!att.uploading && (
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
                          className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity touch-manipulation"
                        >
                          <X className="w-3 h-3 pointer-events-none" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div key={att.id} className="flex items-center gap-1.5 bg-secondary/60 rounded-lg px-2.5 py-1.5 text-xs max-w-[180px]">
                      <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0 pointer-events-none" />
                      <span className="truncate pointer-events-none">{att.uploading ? 'Uploading...' : att.name}</span>
                      {att.uploading ? (
                        <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin flex-shrink-0 pointer-events-none" />
                      ) : (
                        <button type="button" onClick={() => removeAttachment(att.id)} className="flex-shrink-0 hover:text-destructive transition-colors touch-manipulation">
                          <X className="w-3 h-3 pointer-events-none" />
                        </button>
                      )}
                    </div>
                  )
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={isTranscribing ? 'Transcribing...' : text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? '🎙️ Recording... click mic to stop' : 'Message Synch AI...'}
            rows={1}
            disabled={isTranscribing}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-14 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-60 touch-manipulation"
            style={{ maxHeight: 200 }}
          />

          {/* Bottom toolbar - z-20 so it is strictly above the textarea touch target */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20 pointer-events-auto">
            <div className="flex items-center gap-1">

              {/* File upload */}
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
              <button
                type="button"
                title="Attach file"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:scale-90 transition-all touch-manipulation cursor-pointer select-none"
              >
                <Paperclip className="w-4 h-4 pointer-events-none" />
              </button>

              {/* Image upload */}
              <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
              <button
                type="button"
                title="Upload image"
                onClick={() => imageInputRef.current?.click()}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:scale-90 transition-all touch-manipulation cursor-pointer select-none"
              >
                <ImagePlus className="w-4 h-4 pointer-events-none" />
              </button>

              {/* Web search */}
              <button
                type="button"
                title={webSearch ? 'Web search on — tap to turn off' : 'Web search off — tap to turn on'}
                onClick={onToggleWebSearch}
                aria-pressed={webSearch}
                className={`h-9 flex items-center gap-1.5 rounded-xl transition-all active:scale-95 touch-manipulation cursor-pointer select-none ${
                  webSearch
                    ? 'bg-primary text-primary-foreground px-3 font-medium'
                    : 'w-9 justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Globe className="w-4 h-4 pointer-events-none" />
                {webSearch && <span className="text-xs font-medium pointer-events-none">Search</span>}
              </button>

              {/* Voice */}
              <button
                type="button"
                title={isRecording ? 'Recording — tap to stop' : isTranscribing ? 'Transcribing...' : 'Voice input'}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
                aria-pressed={isRecording}
                className={`h-9 flex items-center gap-1.5 rounded-xl transition-all active:scale-95 touch-manipulation cursor-pointer select-none disabled:opacity-60 ${
                  isRecording
                    ? 'bg-destructive text-destructive-foreground px-3 animate-pulse'
                    : isTranscribing
                    ? 'w-9 justify-center text-primary'
                    : 'w-9 justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                {isRecording ? <MicOff className="w-4 h-4 pointer-events-none" /> : <Mic className="w-4 h-4 pointer-events-none" />}
                {isRecording && <span className="text-xs font-medium pointer-events-none">Recording</span>}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isStreaming ? (
                <motion.div key="stop" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                  <button
                    type="button"
                    onClick={onStop}
                    className="h-9 w-9 rounded-xl bg-destructive hover:bg-destructive/90 active:scale-90 text-white flex items-center justify-center transition-all touch-manipulation cursor-pointer shadow-sm"
                  >
                    <Square className="w-4 h-4 pointer-events-none" />
                  </button>
                </motion.div>
              ) : (
                <motion.div key="send" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSend}
                    className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 active:scale-90 text-primary-foreground flex items-center justify-center transition-all touch-manipulation cursor-pointer shadow-sm disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Send className="w-4 h-4 pointer-events-none" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2 pointer-events-none">
          Synch AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  );
}