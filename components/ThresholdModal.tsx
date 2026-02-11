'use client';

import { useState, useEffect } from 'react';

interface ThresholdModalProps {
  isOpen: boolean;
  currentThreshold: number;
  onClose: () => void;
  onSave: (threshold: number) => void;
}

export default function ThresholdModal({ isOpen, currentThreshold, onClose, onSave }: ThresholdModalProps) {
  const [threshold, setThreshold] = useState(currentThreshold);

  useEffect(() => {
    setThreshold(currentThreshold);
  }, [currentThreshold]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(threshold);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-700/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
          Default Threshold
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
          Set the default minimum attendance percentage. You can also set a custom threshold per subject on each card.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="threshold" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              Threshold: <span className="text-indigo-500 font-bold">{threshold}%</span>
            </label>
            <input
              type="range"
              id="threshold"
              min="50"
              max="95"
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="slider"
            />
          </div>

          <div className="flex gap-3 pt-4">
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
