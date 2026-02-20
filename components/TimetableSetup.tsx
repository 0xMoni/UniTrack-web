'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Subject, Timetable } from '@/lib/types';
import { getSubjectKey } from '@/lib/utils';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface TimetableSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (timetable: Timetable) => void;
  subjects: Subject[];
  currentTimetable: Timetable;
  isPremium?: boolean;
  onUpgradeClick?: () => void;
}

export default function TimetableSetup({ isOpen, onClose, onSave, subjects, currentTimetable, isPremium, onUpgradeClick }: TimetableSetupProps) {
  const [activeDay, setActiveDay] = useState(0);
  const [draft, setDraft] = useState<Timetable>({});
  const [showUpload, setShowUpload] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(JSON.parse(JSON.stringify(currentTimetable)));
      const jsDay = new Date().getDay();
      const mapped = jsDay === 0 ? 5 : jsDay - 1;
      setActiveDay(Math.min(mapped, 5));
      setShowUpload(false);
      setParseError(null);
      setPreviewUrl(null);
    }
  }, [isOpen, currentTimetable]);

  if (!isOpen) return null;

  const daySubjects = draft[activeDay] || [];

  const toggleSubject = (code: string) => {
    setDraft(prev => {
      const current = prev[activeDay] || [];
      const next = current.includes(code)
        ? current.filter(c => c !== code)
        : [...current, code];
      return { ...prev, [activeDay]: next };
    });
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleImageUpload = async (file: File) => {
    setParsing(true);
    setParseError(null);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const subjectCodes = subjects.map(s => getSubjectKey(s));

      const res = await fetch('/api/parse-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          mimeType: file.type,
          subjectCodes,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setDraft(result.timetable);
        setShowUpload(false);
        setPreviewUrl(null);
      } else {
        setParseError(result.error || 'Failed to parse timetable');
      }
    } catch {
      setParseError('Network error — could not reach the server');
    } finally {
      setParsing(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const totalConfigured = Object.values(draft).reduce((sum, codes) => sum + codes.length, 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-700/50 flex flex-col max-h-[80vh]">
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Weekly Timetable
            </h2>
            <button
              onClick={() => {
                if (!isPremium && !showUpload) {
                  onUpgradeClick?.();
                  return;
                }
                setShowUpload(!showUpload);
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                showUpload
                  ? 'bg-indigo-500 text-white'
                  : 'text-indigo-500 hover:bg-indigo-500/10'
              }`}
            >
              {!isPremium && !showUpload ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              {showUpload ? 'Manual' : 'Scan image'}
              {!isPremium && !showUpload && <span className="text-[10px] text-indigo-400">PRO</span>}
            </button>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            {showUpload ? 'Upload a photo of your timetable to auto-fill.' : 'Select which subjects you have on each day.'}
          </p>

          {/* Image upload section */}
          {showUpload && (
            <div className="mb-4 space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="hidden"
              />

              {previewUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600">
                  <Image src={previewUrl} alt="Timetable" width={400} height={192} className="w-full max-h-48 object-contain bg-slate-100 dark:bg-slate-700" />
                  {parsing && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-lg">
                        <svg className="w-4 h-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">Analyzing...</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={parsing}
                  className="w-full py-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-colors flex flex-col items-center gap-2"
                >
                  <svg className="w-8 h-8 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm text-slate-400 dark:text-slate-500">Tap to upload timetable photo</span>
                </button>
              )}

              {parseError && (
                <p className="text-xs text-red-500 font-medium">{parseError}</p>
              )}

              {previewUrl && !parsing && (
                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    fileRef.current?.click();
                  }}
                  className="text-xs text-indigo-500 hover:text-indigo-600 font-medium"
                >
                  Try a different image
                </button>
              )}
            </div>
          )}

          {/* Day tabs */}
          {!showUpload && (
            <div className="flex gap-1">
              {DAY_NAMES.map((name, i) => {
                const count = (draft[i] || []).length;
                return (
                  <button
                    key={name}
                    onClick={() => setActiveDay(i)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeDay === i
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <span>{name}</span>
                    {count > 0 && (
                      <span className={`ml-1 ${activeDay === i ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Subject checklist */}
        {!showUpload && (
          <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-1">
            {subjects.map(subject => {
              const key = getSubjectKey(subject);
              const checked = daySubjects.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleSubject(key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    checked
                      ? 'bg-indigo-500/10 border border-indigo-500/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/30 border border-transparent'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    checked
                      ? 'bg-indigo-500 border-indigo-500'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {checked && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {subject.name}
                    </p>
                    {subject.code && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{subject.code}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-slate-100 dark:border-slate-700/50">
          {totalConfigured > 0 && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3 text-center">
              {totalConfigured} class{totalConfigured !== 1 ? 'es' : ''} configured across the week
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm text-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
