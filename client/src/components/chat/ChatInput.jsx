import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Square, Globe, ImagePlus, X, FileText, Image, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { uploadFile, transcribeAudio } from '@/api/client';

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
    setAttachments(prev => [...prev, { id, type, name: file.name, url: null, uploading: true }]);
    try {
      const { url } = await uploadFile(file);
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, url, uploading: false } : a));
    } catch (err) {
      toast.error('Upload failed');
      setAttachments(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleFileChange = (e) => {
    Array.from(e.target.files).forEach(f => uploadFile(f, 'file'));
    e.target.value = '';
  };

  const handleImageChange = (e) => {
    Array.from(e.target.files).forEach(f => uploadFile(f, 'image'));
    e.target.value = '';
  };

  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));

  // Voice recording → OpenAI Whisper transcription
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
                    <div key={att.id} className="flex items-center gap-1.5 bg-secondary/60 rounded-lg px-2.5 py-1.5 text-xs max-w-[180px]">
                      {att.type === 'image' ? <Image className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      <span className="truncate">{att.uploading ? 'Uploading...' : att.name}</span>
                      {att.uploading ? (
                        <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin flex-shrink-0" />
                      ) : (
                        <button onClick={() => removeAttachment(att.id)} className="flex-shrink-0 hover:text-destructive transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${webSearch ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={onToggleWebSearch}
                    >
                      <Globe className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{webSearch ? 'Web search on' : 'Web search off'}</TooltipContent>
                </Tooltip>

                {/* Voice */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 transition-colors ${isRecording ? 'text-red-500 bg-red-500/10 animate-pulse' : isTranscribing ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isTranscribing}
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Voice input'}</TooltipContent>
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
