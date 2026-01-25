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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Attendance Threshold
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Set the minimum attendance percentage required. Subjects below this will be marked as &quot;Low&quot;, and those near it as &quot;Critical&quot;.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Threshold: {threshold}%
            </label>
            <input
              type="range"
              id="threshold"
              min="50"
              max="90"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>50%</span>
              <span>75%</span>
              <span>90%</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
