import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Square, Globe, ImagePlus, X, FileText, Image, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
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

  const handleSubmit = () => {
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
    // Instant local preview via object URL — the thumbnail shows immediately,
    // it doesn't wait on the upload round-trip to appear.
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
    // The generic file picker isn't restricted to images, but if someone picks
    // a PNG/JPG through it anyway, it should still get the thumbnail treatment
    // instead of being stuck as a plain filename pill.
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
    <TooltipProvider>
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
                      // Small square image thumbnail with a remove button, like ChatGPT/Claude
                      <div key={att.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0 group">
                        <img
                          src={att.previewUrl || att.url}
                          alt={att.name}
                          className="w-full h-full object-cover"
                        />
                        {att.uploading && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          </div>
                        )}
                        {!att.uploading && (
                          <button
                            onClick={() => removeAttachment(att.id)}
                            className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div key={att.id} className="flex items-center gap-1.5 bg-secondary/60 rounded-lg px-2.5 py-1.5 text-xs max-w-[180px]">
                        <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="truncate">{att.uploading ? 'Uploading...' : att.name}</span>
                        {att.uploading ? (
                          <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin flex-shrink-0" />
                        ) : (
                          <button onClick={() => removeAttachment(att.id)} className="flex-shrink-0 hover:text-destructive transition-colors">
                            <X className="w-3 h-3" />
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
              className="w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
              style={{ maxHeight: 200 }}
            />

            {/* Bottom toolbar */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex items-center gap-0.5">

                {/* File upload */}
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file</TooltipContent>
                </Tooltip>

                {/* Image upload */}
                <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => imageInputRef.current?.click()}>
                      <ImagePlus className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Upload image</TooltipContent>
                </Tooltip>

                {/* Web search */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onToggleWebSearch}
                      aria-pressed={webSearch}
                      className={`h-8 flex items-center gap-1.5 rounded-full transition-colors ${
                        webSearch
                          ? 'bg-primary text-primary-foreground px-3'
                          : 'w-8 justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      {webSearch && <span className="text-xs font-medium">Search</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{webSearch ? 'Web search on — click to turn off' : 'Web search off — click to turn on'}</TooltipContent>
                </Tooltip>

                {/* Voice */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isTranscribing}
                      aria-pressed={isRecording}
                      className={`h-8 flex items-center gap-1.5 rounded-full transition-colors disabled:opacity-60 ${
                        isRecording
                          ? 'bg-destructive text-destructive-foreground px-3 animate-pulse'
                          : isTranscribing
                          ? 'w-8 justify-center text-primary'
                          : 'w-8 justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      {isRecording && <span className="text-xs font-medium">Recording</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isRecording ? 'Recording — click to stop' : isTranscribing ? 'Transcribing...' : 'Voice input'}</TooltipContent>
                </Tooltip>
              </div>

              <AnimatePresence mode="wait">
                {isStreaming ? (
                  <motion.div key="stop" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                    <Button onClick={onStop} size="icon" className="h-8 w-8 rounded-xl bg-destructive hover:bg-destructive/90">
                      <Square className="w-3.5 h-3.5" />
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div key="send" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                    <Button
                      onClick={handleSubmit}
                      disabled={!canSend}
                      size="icon"
                      className="h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-30"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Synch AI can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}