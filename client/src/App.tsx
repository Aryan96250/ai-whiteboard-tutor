import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, CircleHelp, Clock3, GraduationCap, Headphones, Lightbulb, LoaderCircle, MessageCircle, Pause, Play, Plus, RotateCcw, Send, Settings2, Sparkles, Volume2, VolumeX, WandSparkles, X } from 'lucide-react';
import { analyseImprovement, askTutor, generateLesson, reviseLesson, type ImprovementProposal } from './api';
import Whiteboard from './Whiteboard';
import type { BoardElement, Lesson } from './types';

interface ChatMessage { role: 'user' | 'assistant'; text: string; }\ninterface SavedLesson { id: string; topic: string; savedAt: number; lesson: Lesson; messages: ChatMessage[]; }
const suggestions = [
  { icon: '∑', label: 'How does calculus work?', meta: 'Mathematics', topic: 'How does calculus work?' },
  { icon: '◉', label: 'The human circulatory system', meta: 'Biology', topic: 'The human circulatory system' },
  { icon: '⌘', label: 'How neural networks learn', meta: 'Artificial intelligence', topic: 'How neural networks learn' },
];
const fmt = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function App() {
  const [savedSession] = useState<{ lesson: Lesson | null; messages: ChatMessage[] }>(() => {
    try {
      return JSON.parse(localStorage.getItem('learnboard-last-session') || '{"lesson":null,"messages":[]}');
    } catch {
      return { lesson: null, messages: [] };
    }
  });
  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>(() => { try { return JSON.parse(localStorage.getItem('learnboard-history') || '[]'); } catch { return []; } });\n  const [topic, setTopic] = useState(savedSession.lesson?.topic || '');
  const [lesson, setLesson] = useState<Lesson | null>(savedSession.lesson);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>(savedSession.messages);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceRate, setVoiceRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showImprove, setShowImprove] = useState(false);
  const [improveRequest, setImproveRequest] = useState('');
  const [proposal, setProposal] = useState<ImprovementProposal | null>(null);
  const [analysingImprovement, setAnalysingImprovement] = useState(false);
  const [applyingImprovement, setApplyingImprovement] = useState(false);
  const [showDiagramEditor, setShowDiagramEditor] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('#5256d8');
  const [editX, setEditX] = useState(100);
  const [editY, setEditY] = useState(100);
  const timerRef = useRef<number | null>(null);
  const lastSpokenRef = useRef<string>('');

  const activeSegment = useMemo(() => lesson?.segments.find((s) => elapsed >= s.start && elapsed < s.end) || lesson?.segments.filter((s) => elapsed >= s.start).at(-1) || null, [lesson, elapsed]);
  const visibleElements = useMemo(() => lesson?.segments.filter((s) => elapsed >= s.start).flatMap((s) => s.board) || [], [lesson, elapsed]);
  const editorSegment = lesson?.segments.find((s) => s.id === (activeSegment?.id || lesson.segments[0]?.id));
  const editorElements = editorSegment?.board || [];
  const selectedElement = editorElements.find((item) => item.id === selectedElementId) || editorElements[0] || null;
  const loadingStages = ['Analysing your topic', 'Planning the lesson', 'Designing visual diagrams', 'Preparing narration', 'Checking lesson quality'];

  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const timer = window.setInterval(() => setLoadingStep((step) => Math.min(step + 1, 4)), 2600);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!playing || !lesson) return;
    timerRef.current = window.setInterval(() => {
      setElapsed((current) => {
        const next = Math.min(current + 0.25, lesson.duration);
        if (next >= lesson.duration) { setPlaying(false); window.speechSynthesis?.cancel(); }
        return next;
      });
    }, 250);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [playing, lesson]);

  useEffect(() => {
    if (!playing || !activeSegment || muted || !('speechSynthesis' in window)) return;
    if (lastSpokenRef.current === activeSegment.id) return;
    lastSpokenRef.current = activeSegment.id;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(activeSegment.narration);
    utterance.rate = voiceRate; utterance.pitch = 1.02;
    utterance.onerror = (event) => { if (event.error !== 'canceled' && event.error !== 'interrupted') setError('Voice playback is unavailable in this browser.'); };
    window.speechSynthesis.speak(utterance);
  }, [activeSegment, playing, muted, voiceRate]);

  useEffect(() => () => { window.speechSynthesis?.cancel(); if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  useEffect(() => {
    try { localStorage.setItem('learnboard-last-session', JSON.stringify({ lesson, messages })); }
    catch { /* Storage may be unavailable or full; the current lesson remains usable. */ }
  }, [lesson, messages]);

  useEffect(() => {
    if (!selectedElement) return;
    setEditLabel('text' in selectedElement ? selectedElement.text : ('label' in selectedElement ? selectedElement.label || '' : ''));
    setEditColor(selectedElement.color || '#5256d8');
    setEditX('x' in selectedElement ? selectedElement.x : selectedElement.x1);
    setEditY('y' in selectedElement ? selectedElement.y : selectedElement.y1);
  }, [selectedElementId, activeSegment?.id, lesson, showDiagramEditor]);

  const stopPlayback = () => { setPlaying(false); window.speechSynthesis?.cancel(); };
  const startPlayback = () => {
    if (!lesson) return;
    if (elapsed >= lesson.duration) { setElapsed(0); lastSpokenRef.current = ''; }
    setPlaying(true);
  };
  const restart = () => { stopPlayback(); setElapsed(0); lastSpokenRef.current = ''; };
  const seek = (value: number) => {
    const next = Math.max(0, Math.min(value, lesson?.duration || 0));
    setElapsed(next); lastSpokenRef.current = '';
    if (playing) window.speechSynthesis?.cancel();
  };

  const createLesson = async (value = topic) => {
    const clean = value.trim();
    if (!clean) { setError('Enter a topic to start your lesson.'); return; }
    if (clean.length > 180) { setError('Please keep your topic under 180 characters.'); return; }
    setLoading(true); setLoadingStep(0); setError(''); stopPlayback(); setElapsed(0); setMessages([]); lastSpokenRef.current = '';
    try {
      const result = await generateLesson(clean);
      setLesson(result); setTopic(clean); setElapsed(0);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not generate your lesson. Please try again.'); }
    finally { setLoading(false); }
  };

  const submitQuestion = async (value = question) => {
    const clean = value.trim(); if (!clean || !lesson || asking) return;
    setMessages((old) => [...old, { role: 'user', text: clean }]); setQuestion(''); setAsking(true);
    try {
      const response = await askTutor(lesson.topic, lesson, clean);
      setMessages((old) => [...old, { role: 'assistant', text: response.answer }]);
    } catch (err) {
      setMessages((old) => [...old, { role: 'assistant', text: err instanceof Error ? err.message : 'I could not answer that just now. Please try again.' }]);
    } finally { setAsking(false); }
  };

  const analyseRequestedImprovement = async () => {
    if (!lesson || improveRequest.trim().length < 8) return;
    setAnalysingImprovement(true); setProposal(null); setError('');
    try {
      const result = await analyseImprovement(improveRequest, 'Lesson topic: ' + lesson.topic + '. Summary: ' + lesson.summary + '. Segments: ' + lesson.segments.length + '.');
      setProposal(result);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not analyse that improvement.'); }
    finally { setAnalysingImprovement(false); }
  };

  const applyRequestedImprovement = async () => {
    if (!lesson || !improveRequest.trim()) return;
    setApplyingImprovement(true); setError('');
    try {
      const revised = await reviseLesson(lesson, improveRequest);
      setLesson(revised); setElapsed(0); stopPlayback(); lastSpokenRef.current = '';
      setMessages((old) => [...old, { role: 'assistant', text: 'I updated the lesson: ' + improveRequest }]);
      setProposal(null); setImproveRequest('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not apply the improvement.'); }
    finally { setApplyingImprovement(false); }
  };

  const saveDiagramEdit = () => {
    if (!lesson || !selectedElement || !editorSegment) return;
    const updated = { ...selectedElement, ...(('text' in selectedElement) ? { text: editLabel } : ('label' in selectedElement) ? { label: editLabel } : {}), color: editColor, ...(('x' in selectedElement) ? { x: editX, y: editY } : { x1: editX, y1: editY }) } as BoardElement;
    setLesson({ ...lesson, segments: lesson.segments.map((segment) => segment.id !== editorSegment.id ? segment : { ...segment, board: segment.board.map((item) => item.id === selectedElement.id ? updated : item) }) });
  };

  const addDiagramLabel = () => {
    if (!lesson || !editorSegment) return;
    const id = 'manual-' + Date.now();
    const item: BoardElement = { id, type: 'text', x: 110, y: 120, text: 'New label', color: '#344054', size: 24 };
    setLesson({ ...lesson, segments: lesson.segments.map((segment) => segment.id !== editorSegment.id ? segment : { ...segment, board: [...segment.board, item] }) });
    setSelectedElementId(id);
  };

  const deleteDiagramElement = () => {
    if (!lesson || !selectedElement || !editorSegment) return;
    setLesson({ ...lesson, segments: lesson.segments.map((segment) => segment.id !== editorSegment.id ? segment : { ...segment, board: segment.board.filter((item) => item.id !== selectedElement.id) }) });
    setSelectedElementId('');
  };

  const saveCurrentLesson = () => {\n    if (!lesson) return;\n    const entry: SavedLesson = { id: String(Date.now()), topic: lesson.topic, savedAt: Date.now(), lesson, messages };\n    setSavedLessons((old) => [entry, ...old.filter((item) => item.topic.toLowerCase() !== lesson.topic.toLowerCase())].slice(0, 30));\n  };\n  const openSavedLesson = (entry: SavedLesson) => { stopPlayback(); setLesson(entry.lesson); setTopic(entry.topic); setMessages(entry.messages || []); setElapsed(0); setError(''); lastSpokenRef.current = ''; };\n  const removeSavedLesson = (id: string) => setSavedLessons((old) => old.filter((item) => item.id !== id));\n  const openSuggestions = () => { setLesson(null); stopPlayback(); setMessages([]); setElapsed(0); setError(''); };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><WandSparkles size={19} /></div><span>learnboard<span className="brand-ai">.ai</span></span></div>
        <button className="new-lesson" onClick={openSuggestions}><Plus size={17} /> New lesson <span className="shortcut">⌘ K</span></button>
        <div className="side-label">WORKSPACE</div>
        <button className="side-item selected" onClick={openSuggestions}><BookOpen size={17} /> My lessons <span className="history-count">{savedLessons.length}</span></button>\n        <div className="history-heading">SAVED HISTORY</div>\n        <div className="history-list">{savedLessons.length === 0 ? <p className="history-empty">Your saved lessons will appear here.</p> : savedLessons.map((entry) => <div className="history-row" key={entry.id}><button className="history-open" onClick={() => openSavedLesson(entry)} title={entry.topic}>{entry.topic}</button><button className="history-remove" onClick={() => removeSavedLesson(entry.id)} title="Remove saved lesson" aria-label={"Remove " + entry.topic}><X size={12}/></button></div>)}</div>
        <button className="side-item" onClick={() => setShowSettings(!showSettings)}><Settings2 size={17} /> Preferences <ChevronDown size={14} className="side-chevron" /></button>
        {showSettings && <div className="settings-pop"><div className="setting-title">Narration speed</div><div className="speed-options">{[0.8, 1, 1.2, 1.4].map((rate) => <button className={voiceRate === rate ? 'speed active' : 'speed'} key={rate} onClick={() => setVoiceRate(rate)}>{rate}×</button>)}</div><div className="setting-note">Uses your browser's available voice.</div></div>}
        <div className="side-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={16} /></div><strong>Learning, made visual.</strong><p>Turn big ideas into little lightbulb moments.</p></div><div className="profile-row"><div className="avatar">A</div><div className="profile-info"><strong>Aryan's workspace</strong><span>Free workspace</span></div><ChevronDown size={15} /></div></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="crumb">Workspace <span>/</span> <strong>{lesson ? lesson.topic : 'New lesson'}</strong></div><div className="top-actions"><span className="status-pill"><span className="status-dot" /> AI tutor ready</span><button className="icon-button" title="Help"><CircleHelp size={18} /></button></div></header>
        {!lesson ? (
          <section className="welcome-view"><div className="welcome-content"><div className="eyebrow"><Sparkles size={14} /> YOUR PERSONAL AI CLASSROOM</div><h1>Understand anything.<br /><span>See the big picture.</span></h1><p className="welcome-sub">A little less scrolling. A lot more understanding.<br />What would you like to learn today?</p>
            <form className="topic-form" onSubmit={(e) => { e.preventDefault(); void createLesson(); }}><div className="input-icon"><WandSparkles size={19} /></div><input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ask me anything... e.g. How do black holes work?" aria-label="Topic to learn" /><button className="generate-btn" disabled={loading || !topic.trim()}>{loading ? <LoaderCircle className="spin" size={18} /> : <>Create lesson <ArrowRight size={17} /></>}</button></form>
            {loading && <div className="generation-progress"><div className="progress-head"><LoaderCircle className="spin" size={18}/><strong>{loadingStages[loadingStep]}</strong><span>{loadingStep + 1}/5</span></div><div className="progress-track"><span style={{ width: ((loadingStep + 1) * 20) + '%' }}/></div><div className="progress-steps">{loadingStages.map((stage, index) => <span className={index <= loadingStep ? 'done' : ''} key={stage}>{index < loadingStep ? '✓ ' : ''}{stage}</span>)}</div><small>Creating your lesson, diagrams and narration. Please keep this page open.</small></div>}{error && <div className="error-banner"><X size={15} /> {error}</div>}
            <div className="suggest-heading"><span>NOT SURE WHERE TO START?</span><div /></div><div className="suggestions">{suggestions.map((item) => <button className="suggestion" key={item.label} onClick={() => { setTopic(item.topic); void createLesson(item.topic); }}><span className="suggest-icon">{item.icon}</span><span className="suggest-copy"><strong>{item.label}</strong><small>{item.meta}</small></span><ArrowUpRight size={16} className="suggest-arrow" /></button>)}</div>
            <div className="trust-line"><div className="trust-avatars"><span>✳</span><span>✦</span><span>◈</span></div><span>Curiosity looks good on you.</span><span className="trust-sep">·</span><span>Powered by AI, designed for humans.</span></div>
          </div><div className="welcome-orb orb-one"/><div className="welcome-orb orb-two"/></section>
        ) : (
          <section className="lesson-view">
            <div className="lesson-heading"><div><button className="back-link" onClick={openSuggestions}><ArrowLeft size={15} /> All lessons</button><div className="lesson-title-row"><h1>{lesson.topic}</h1><span className="ai-tag"><Sparkles size={12} /> AI GENERATED</span></div><p>{lesson.summary}</p></div><div className="lesson-actions"><button className="more-btn save-lesson-btn" onClick={saveCurrentLesson}><BookOpen size={16} /> Save lesson</button><button className="more-btn" onClick={() => setShowDiagramEditor(!showDiagramEditor)}><Settings2 size={16} /> Edit diagram</button><button className="more-btn" onClick={() => { setShowImprove(!showImprove); setProposal(null); }}><Sparkles size={16} /> Improve lesson</button><button className="more-btn" onClick={restart}><RotateCcw size={16} /> Restart</button></div></div>
            <div className="teaching-layout"><div className="board-column"><Whiteboard elements={visibleElements} activeTitle={activeSegment?.title || ''} />{showDiagramEditor && <div className="editor-card"><div className="editor-title"><strong>Edit this diagram</strong><span>Changes apply to the current chapter and are saved in this browser.</span></div><button className="add-label-btn" onClick={addDiagramLabel}>+ Add text label</button>{editorElements.length === 0 ? <p>No diagram elements in this chapter yet.</p> : <><label>Element<select value={selectedElement?.id || ''} onChange={(e) => setSelectedElementId(e.target.value)}>{editorElements.map((item) => <option key={item.id} value={item.id}>{item.type} · {item.id}</option>)}</select></label><label>Text / label<input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Text or shape label" /></label><div className="editor-fields"><label>Canvas X<input type="number" min="20" max="950" value={editX} onChange={(e) => setEditX(Number(e.target.value))} /></label><label>Canvas Y<input type="number" min="30" max="570" value={editY} onChange={(e) => setEditY(Number(e.target.value))} /></label><label>Color<input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} /></label></div><div className="editor-actions"><button onClick={saveDiagramEdit}>Save diagram edit</button><button className="danger-action" onClick={deleteDiagramElement}>Delete element</button></div></>}</div>}<div className="narration-card"><div className="tutor-avatar"><GraduationCap size={21} /></div><div className="narration-content"><div className="narration-meta"><strong>AI Tutor</strong><span className="speaking"><span /> {playing ? 'Teaching' : 'Ready'}</span></div><p>{activeSegment?.narration || 'Press play to begin your visual lesson. Your tutor will explain each step as the whiteboard comes to life.'}</p></div><button className="voice-toggle" onClick={() => setMuted(!muted)} title={muted ? 'Enable voice' : 'Mute voice'}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button></div>
                <div className="player"><div className="player-top"><div className="player-controls"><button className="skip-btn" onClick={() => seek(elapsed - 10)} title="Back 10 seconds"><RotateCcw size={15} /><small>10</small></button><button className="play-btn" onClick={playing ? stopPlayback : startPlayback} title={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><button className="skip-btn" onClick={() => seek(elapsed + 10)} title="Forward 10 seconds"><RotateCcw size={15} className="flip-icon" /><small>10</small></button><button className="replay-btn" onClick={restart}><RotateCcw size={15} /> Restart</button></div><div className="time-display"><strong>{fmt(elapsed)}</strong><span> / {fmt(lesson.duration)}</span></div></div><input className="timeline" type="range" min="0" max={lesson.duration} step="0.25" value={elapsed} onChange={(e) => seek(Number(e.target.value))} aria-label="Lesson progress" style={{ '--progress': `${(elapsed / lesson.duration) * 100}%` } as React.CSSProperties} /><div className="segment-labels">{lesson.segments.map((seg) => <button key={seg.id} className={activeSegment?.id === seg.id ? 'segment-label active' : 'segment-label'} onClick={() => seek(seg.start)}>{seg.title}</button>)}</div></div>
              </div>
              <aside className="lesson-aside">{showImprove && <div className="improve-card"><div className="improve-heading"><Sparkles size={17}/><div><strong>Improve this lesson</strong><small>Describe what you want changed.</small></div></div><textarea value={improveRequest} onChange={(e) => setImproveRequest(e.target.value)} placeholder="Make diagrams simpler, add examples, explain in Hinglish..." maxLength={800}/><button className="analyse-btn" disabled={analysingImprovement || improveRequest.trim().length < 8} onClick={() => void analyseRequestedImprovement()}>{analysingImprovement ? <><LoaderCircle className="spin" size={15}/> Analysing request…</> : 'Preview improvement'}</button>{proposal && <div className="proposal-preview"><strong>{proposal.title}</strong><span>{proposal.category} · {proposal.impact} impact</span><p>{proposal.summary}</p><b>Plan</b><ul>{proposal.implementationPlan.map((step, i) => <li key={i}>{step}</li>)}</ul><b>Success checks</b><ul>{proposal.acceptanceCriteria.map((item, i) => <li key={i}>{item}</li>)}</ul>{proposal.risks.length > 0 && <p className="risk-note">Considerations: {proposal.risks.join('; ')}</p>}<button className="apply-improvement" disabled={applyingImprovement} onClick={() => void applyRequestedImprovement()}>{applyingImprovement ? 'Applying lesson update…' : 'Apply to this lesson'}</button></div>}</div>}<div className="outline-card"><div className="aside-heading"><div><span className="aside-kicker">YOUR LEARNING PATH</span><h3>Lesson outline</h3></div><span className="duration-chip"><Clock3 size={13} /> 2 min</span></div><div className="outline-list">{lesson.segments.map((seg, index) => <button key={seg.id} onClick={() => seek(seg.start)} className={activeSegment?.id === seg.id ? 'outline-item current' : 'outline-item'}><span className="outline-number">{elapsed >= seg.start ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span><span><strong>{seg.title}</strong><small>{fmt(seg.start)} – {fmt(seg.end)}</small></span><ArrowRight size={14} className="outline-arrow" /></button>)}</div><div className="outline-foot"><Lightbulb size={16} /><span>Tip: You can jump to any chapter using this outline.</span></div></div>
                <div className="chat-card"><div className="chat-header"><div className="chat-icon"><MessageCircle size={16} /></div><div><strong>Ask your tutor</strong><small>Have a question? Go deeper.</small></div><span className="online-dot" /></div><div className="chat-messages">{messages.length === 0 ? <div className="chat-empty"><span>✦</span><p>Curiosity is always welcome.</p><small>Ask anything about this lesson.</small></div> : messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${index}-${message.text.slice(0, 10)}`}><span>{message.role === 'assistant' ? '✦ Tutor' : 'You'}</span><p>{message.text}</p></div>)}{asking && <div className="typing"><span/><span/><span/></div>}</div><form className="chat-input" onSubmit={(e) => { e.preventDefault(); void submitQuestion(); }}><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a follow-up..." aria-label="Ask a question" /><button disabled={!question.trim() || asking} title="Send question"><Send size={16} /></button></form></div>
              </aside></div>
          </section>
        )}
        <footer className="footer"><span>© 2026 LearnBoard AI</span><span>Made for the endlessly curious <span className="heart">♥</span></span><span className="footer-help"><Headphones size={14} /> Help center</span></footer>
      </main>
    </div>
  );
}