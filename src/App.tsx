/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { QARun, CalibrationRun } from "./types";
import { initialQARuns, initialCalibrationRuns } from "./data/defaults";
import QARunner from "./components/QARunner";
import DepthAnalytics from "./components/DepthAnalytics";
import { 
  Gauge, 
  ListTodo, 
  Compass, 
  RotateCcw, 
  AlertTriangle, 
  Info, 
  HelpCircle,
  Activity,
  Layers,
  Sparkles
} from "lucide-react";

export default function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<'qa-runner' | 'depth-analytics'>('qa-runner');

  // Multi-app states
  const [qaState, setQAState] = useState<{ runs: QARun[]; activeRunId: string | null }>(() => {
    try {
      const saved = localStorage.getItem('sali_qa_workspace_qaState');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.runs) && parsed.runs.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return { runs: initialQARuns, activeRunId: "seeded_run_1" };
  });

  const [appState, setAppState] = useState<{ tests: CalibrationRun[] }>(() => {
    try {
      const saved = localStorage.getItem('sali_qa_workspace_appState');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.tests) && parsed.tests.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return { tests: initialCalibrationRuns };
  });

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('sali_qa_workspace_qaState', JSON.stringify(qaState));
  }, [qaState]);

  useEffect(() => {
    localStorage.setItem('sali_qa_workspace_appState', JSON.stringify(appState));
  }, [appState]);

  // Alert Dialog States
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isError: boolean;
  } | null>(null);

  // Confirmation Dialog States
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Common Dialog triggers
  const showAlert = (title: string, message: string, isError = false) => {
    setAlertDialog({ isOpen: true, title, message, isError });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  };

  const flushSessionCache = () => {
    showConfirm(
      "Reset Session Cache?",
      "This will erase all uploaded test data results and reseed the default metrics. Are you sure?",
      () => {
        localStorage.removeItem('sali_qa_workspace_qaState');
        localStorage.removeItem('sali_qa_workspace_appState');
        setQAState({ runs: initialQARuns, activeRunId: "seeded_run_1" });
        setAppState({ tests: initialCalibrationRuns });
        showAlert("Cache Cleared", "Successfully reseeded all baseline verify datasets!");
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      {/* Dynamic Navigation Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-4 border-b border-slate-800 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white flex items-center justify-center shadow-lg">
            <Gauge className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              SALI Integrated QA Workspace
            </h1>
            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Pre-Production Verification & Analytics Terminal</p>
          </div>
        </div>

        {/* Master Switcher */}
        <div className="flex bg-slate-850 p-1 rounded-xl items-center gap-1 text-sm border border-slate-800/80">
          <button 
            onClick={() => setActiveWorkspace('qa-runner')}
            className={`px-5 py-2.5 font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeWorkspace === 'qa-runner' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ListTodo className="h-4.5 w-4.5" /> QA Verification Suite
          </button>
          <button 
            onClick={() => setActiveWorkspace('depth-analytics')}
            className={`px-5 py-2.5 font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeWorkspace === 'depth-analytics' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Compass className="h-4.5 w-4.5" /> Depth Calculation Analytics
          </button>
        </div>

        {/* Action button & Profile stats */}
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={flushSessionCache}
            className="bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            title="Wipe persistent session storage and reseed default metrics"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Flush Session Cache
          </button>
          
          <div className="flex items-center border border-slate-800 rounded-xl divide-x divide-slate-850 text-xs bg-slate-950/40">
            <div className="px-4 py-1.5 text-right">
              <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Tester</p>
              <p className="font-bold text-slate-200 text-sm">Kenneth Silagan</p>
            </div>
            <div className="px-4 py-1.5">
              <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Testing Date</p>
              <p className="font-bold text-blue-400 text-sm">2026-07-17</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main workspace container */}
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-[1600px] mx-auto">
          {activeWorkspace === 'qa-runner' ? (
            <QARunner 
              qaState={qaState} 
              setQAState={setQAState} 
              onShowAlert={showAlert} 
              onShowConfirm={showConfirm} 
            />
          ) : (
            <DepthAnalytics 
              appState={appState} 
              setAppState={setAppState} 
              onShowAlert={showAlert} 
              onShowConfirm={showConfirm} 
            />
          )}
        </div>
      </main>

      {/* Global alert modal */}
      {alertDialog && alertDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform transition-all border border-slate-100 animate-fade-in">
            <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-4 ${alertDialog.isError ? 'bg-red-100' : 'bg-blue-100'}`}>
              {alertDialog.isError ? (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              ) : (
                <Info className="h-6 w-6 text-blue-600" />
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{alertDialog.title}</h3>
            <p className="text-slate-600 mb-6 leading-relaxed text-sm font-medium">{alertDialog.message}</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setAlertDialog(null)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors w-full text-sm shadow-sm cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global confirm modal */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform transition-all border border-slate-100 animate-fade-in">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-4 bg-amber-100">
              <HelpCircle className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 mb-6 leading-relaxed text-sm font-medium">{confirmDialog.message}</p>
            <div className="flex justify-center gap-3 w-full">
              <button 
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-all w-1/2 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all w-1/2 cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
