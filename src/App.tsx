import React, { useState, useEffect, useCallback } from "react";
import { 
  BookOpen, 
  RotateCcw, 
  Sparkles, 
  Award, 
  Flame, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Trash2, 
  HelpCircle,
  Volume2,
  ListRestart,
  Check,
  ChevronRight,
  User,
  ExternalLink,
  Search,
  BookMarked,
  Eye,
  EyeOff
} from "lucide-react";
import { KANJI_QUESTIONS, KANJI_LEVELS, KanjiQuestion } from "./data/kanjiQuestions";

// Type definitions
interface ReviewItem {
  questionId: string;
  kanji: string;
  reading: string;
  questionText: string;
  levelName: string;
  levelId: string;
  mistakeCount: number;
  lastMistakeDate: string;
}

export default function App() {
  // --- STATE ---
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [quizState, setQuizState] = useState<"lobby" | "quiz" | "result">("lobby");
  
  const [activeQuestions, setActiveQuestions] = useState<KanjiQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [sessionScore, setSessionScore] = useState<number>(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState<number>(0);
  
  // Game metrics
  const [streak, setStreak] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [totalAnsweredCount, setTotalAnsweredCount] = useState<number>(0);
  
  // Review List (Persisted via LocalStorage)
  const [reviewList, setReviewList] = useState<ReviewItem[]>([]);
  
  // AI Explanation State
  const [aiExplainLoading, setAiExplainLoading] = useState<boolean>(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [explainingKanji, setExplainingKanji] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  
  // Sound effects toggler (Visual indicators for sound fallback)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [feedbackEffect, setFeedbackEffect] = useState<"correct" | "incorrect" | null>(null);

  // Practice Review Mode Indicator
  const [isReviewPracticeMode, setIsReviewPracticeMode] = useState<boolean>(false);

  // Keep track of which review items have revealed readings
  const [showReadings, setShowReadings] = useState<Record<string, boolean>>({});

  // --- LOCAL STORAGE PERSISTENCE ---
  useEffect(() => {
    // Load high score
    const savedHighScore = localStorage.getItem("kanji_high_score");
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
    
    // Load review list
    const savedReview = localStorage.getItem("kanji_review_list");
    if (savedReview) {
      try {
        setReviewList(JSON.parse(savedReview));
      } catch (e) {
        console.error("Failed to parse review list", e);
      }
    }

    // Load total stats
    const savedTotal = localStorage.getItem("kanji_total_answered");
    if (savedTotal) {
      setTotalAnsweredCount(parseInt(savedTotal, 10));
    }
  }, []);

  const saveReviewList = (newList: ReviewItem[]) => {
    setReviewList(newList);
    localStorage.setItem("kanji_review_list", JSON.stringify(newList));
  };

  const handleUpdateHighScore = (score: number) => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem("kanji_high_score", score.toString());
    }
  };

  // --- SOUND EFFECTS (Web Audio API synthesis for zero-external dependency reliability) ---
  const playSound = (type: "correct" | "incorrect" | "click" | "complete") => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === "correct") {
        // High pleasant ding
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1); // G5
        
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.4);
        osc2.stop(ctx.currentTime + 0.4);
      } else if (type === "incorrect") {
        // Low buzzer sound
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.25);
        
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === "click") {
        // Subtle pop
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
        gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "complete") {
        // Upward scale arpeggio
        const freqs = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
          gainNode.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.1);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.1 + 0.25);
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.1);
          osc.stop(ctx.currentTime + idx * 0.1 + 0.25);
        });
      }
    } catch (e) {
      console.warn("Web Audio API is blocked or unsupported in this frame browser config.", e);
    }
  };

  // --- START QUIZ SESSION ---
  const startNewQuiz = (levelId: string, customCount: number = 10, practiceReview: boolean = false) => {
    playSound("click");
    setIsReviewPracticeMode(practiceReview);
    
    let candidateQuestions: KanjiQuestion[] = [];
    
    if (practiceReview) {
      // Build dummy questions from Review List or try to match existing database questions
      if (reviewList.length === 0) return;
      
      // Match review items to our KANJI_QUESTIONS database
      const reviewIds = reviewList.map(item => item.questionId);
      candidateQuestions = KANJI_QUESTIONS.filter(q => reviewIds.includes(q.id));
      
      // If we have some manual review items that might not be in database (for safety)
      if (candidateQuestions.length === 0) {
        // Fallback construct from existing questions that have matching Kanji or level
        candidateQuestions = KANJI_QUESTIONS.filter(q => 
          reviewList.some(r => r.kanji === q.kanji)
        );
      }
      
      // If still empty, just use all review questions we can map
      if (candidateQuestions.length === 0) {
        // Map as much as we can find
        candidateQuestions = KANJI_QUESTIONS.slice(0, Math.min(reviewList.length, 10));
      }
    } else {
      if (levelId === "all") {
        candidateQuestions = [...KANJI_QUESTIONS];
      } else {
        candidateQuestions = KANJI_QUESTIONS.filter(q => q.level === levelId);
      }
    }

    // Shuffle and pick requested amount
    const shuffled = [...candidateQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(customCount, shuffled.length));
    
    if (selected.length === 0) {
      alert("選択された条件の問題が見つかりませんでした。別の設定をお試しください。");
      return;
    }

    // Shuffle options for each question so that choices appear in a random order
    const randomizedQuestions = selected.map(q => {
      const optionsWithIndex = q.options.map((opt, idx) => ({
        text: opt,
        originalIndex: idx
      }));
      // Shuffle choices
      const shuffledOptions = [...optionsWithIndex].sort(() => Math.random() - 0.5);
      // Find new correct answer index
      const newAnswerIndex = shuffledOptions.findIndex(item => item.originalIndex === q.answerIndex);
      
      return {
        ...q,
        options: shuffledOptions.map(item => item.text),
        answerIndex: newAnswerIndex
      };
    });

    setActiveQuestions(randomizedQuestions);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setSessionScore(0);
    setCorrectAnswersCount(0);
    setQuizState("quiz");
    setFeedbackEffect(null);
  };

  const currentQuestionObj = activeQuestions[currentIndex];

  // --- CHOOSE ANSWER ACTION ---
  const handleAnswerSelect = (optionIndex: number) => {
    if (isAnswered) return; // Prevent double answering
    playSound("click");
    setSelectedAnswer(optionIndex);
  };

  // --- SUBMIT / CONFIRM ANSWER ---
  const confirmAnswer = () => {
    if (selectedAnswer === null || isAnswered) return;
    
    const isCorrect = selectedAnswer === currentQuestionObj.answerIndex;
    setIsAnswered(true);
    setTotalAnsweredCount(prev => {
      const next = prev + 1;
      localStorage.setItem("kanji_total_answered", next.toString());
      return next;
    });

    if (isCorrect) {
      playSound("correct");
      setFeedbackEffect("correct");
      setSessionScore(prev => prev + 100 + (streak * 10)); // Bonus for streaks!
      setCorrectAnswersCount(prev => prev + 1);
      setStreak(prev => prev + 1);
    } else {
      playSound("incorrect");
      setFeedbackEffect("incorrect");
      setStreak(0); // Reset streak

      // Automatically add to review list
      const updatedReviewList = [...reviewList];
      const existingItemIndex = updatedReviewList.findIndex(
        item => item.questionId === currentQuestionObj.id
      );

      if (existingItemIndex > -1) {
        updatedReviewList[existingItemIndex].mistakeCount += 1;
        updatedReviewList[existingItemIndex].lastMistakeDate = new Date().toISOString();
      } else {
        updatedReviewList.push({
          questionId: currentQuestionObj.id,
          kanji: currentQuestionObj.kanji,
          reading: currentQuestionObj.reading,
          questionText: currentQuestionObj.question,
          levelName: currentQuestionObj.levelName,
          levelId: currentQuestionObj.level,
          mistakeCount: 1,
          lastMistakeDate: new Date().toISOString()
        });
      }
      saveReviewList(updatedReviewList);
    }
  };

  // --- NEXT QUESTION OR END ---
  const handleNextQuestion = useCallback(() => {
    playSound("click");
    setFeedbackEffect(null);
    
    if (currentIndex + 1 < activeQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      // End of round
      playSound("complete");
      setQuizState("result");
      handleUpdateHighScore(sessionScore);
    }
  }, [currentIndex, activeQuestions, sessionScore]);

  // --- KEYBOARD SHORTCUTS LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (quizState !== "quiz") return;

      // Select 1, 2, 3, 4
      if (["1", "2", "3", "4"].includes(e.key)) {
        const optionIdx = parseInt(e.key, 10) - 1;
        if (!isAnswered && currentQuestionObj && optionIdx < currentQuestionObj.options.length) {
          handleAnswerSelect(optionIdx);
        }
      }

      // Enter/Space to confirm or go next
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (selectedAnswer !== null && !isAnswered) {
          confirmAnswer();
        } else if (isAnswered) {
          handleNextQuestion();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [quizState, isAnswered, selectedAnswer, currentQuestionObj, handleNextQuestion]);

  // --- AI DETAILED EXPLANATION VIA GEMINI ---
  const requestAiExplanation = async (kanji: string, reading: string, type: string, question: string, context?: string) => {
    playSound("click");
    setExplainingKanji(kanji);
    setAiExplainLoading(true);
    setAiExplanation(null);
    setShowAiModal(true);

    try {
      const response = await fetch("/api/kanji/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kanji,
          reading,
          type,
          question,
          context
        })
      });

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      const data = await response.json();
      if (data.success) {
        setAiExplanation(data.markdown);
      } else {
        setAiExplanation("AI解説の読み込みに失敗しました。もう一度お試しください。");
      }
    } catch (e: any) {
      console.error(e);
      setAiExplanation("エラー：インターネットに接続されていないか、APIサーバーに接続できませんでした。");
    } finally {
      setAiExplainLoading(false);
    }
  };

  // Remove single item from Review List
  const handleRemoveReviewItem = (id: string) => {
    playSound("click");
    const filtered = reviewList.filter(item => item.questionId !== id);
    saveReviewList(filtered);
  };

  // Clear all Review List items
  const handleClearReviewList = () => {
    if (confirm("復習リストをすべてクリアしてよろしいですか？")) {
      playSound("click");
      saveReviewList([]);
    }
  };

  // Helper to format Date
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    } catch {
      return "";
    }
  };

  return (
    <div id="app_root" className="min-h-screen bg-gradient-to-br from-amber-50 via-amber-100/50 to-orange-100/30 font-sans flex flex-col selection:bg-amber-200">
      
      {/* HEADER SECTION */}
      <header id="header" className="bg-white px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center border-b-4 border-amber-200 shadow-md gap-4 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-emerald-200 animate-bounce-slow">
            漢
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              漢字四択クイズ <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-bold">国語・AI学習ゲーム</span>
            </h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
              習得レベル別学習 &amp; AI先生の解説機能つき
            </p>
          </div>
        </div>
        
        {/* RIGHT PANEL STATS */}
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">自己ベスト</div>
              <div className="text-lg font-black text-amber-600">{highScore} <span className="text-xs text-slate-400">pts</span></div>
            </div>
            
            <div className="h-10 w-px bg-slate-200"></div>

            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">総回答数</div>
              <div className="text-lg font-black text-slate-700">{totalAnsweredCount} <span className="text-xs text-slate-400">問</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-amber-100/80 px-3 py-1.5 rounded-full border border-amber-200">
            <span className="text-base animate-pulse">🔥</span>
            <div className="text-left leading-none">
              <span className="text-sm font-black text-orange-600">{streak}</span>
              <span className="text-[9px] font-bold text-slate-500 ml-1">連勝</span>
            </div>
          </div>

          {/* Sound Toggle */}
          <button 
            id="btn_sound_toggle"
            onClick={() => { setSoundEnabled(!soundEnabled); playSound("click"); }}
            className={`p-2 rounded-xl border transition-all ${soundEnabled ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-400"}`}
            title={soundEnabled ? "音声をミュート" : "音声を有効化"}
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main id="main_content" className="flex-grow flex flex-col lg:flex-row p-4 md:p-6 lg:p-8 gap-6 max-w-7xl mx-auto w-full">
        
        {/* LEFT / CENTRAL AREA: QUIZ OR LOBBY */}
        <div className="flex-grow flex flex-col gap-6">
          
          {/* LOBBY / CONFIGURATION SCREEN */}
          {quizState === "lobby" && (
            <div id="lobby_panel" className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border-b-8 border-slate-200 border-x border-t border-slate-100 flex-grow flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-6 bg-amber-400 rounded-full"></div>
                  <h2 className="text-2xl font-black text-slate-800">問題の設定を選びましょう</h2>
                </div>

                {/* 1. SELECT LEVEL */}
                <div className="mb-8">
                  <label className="block text-sm font-bold text-slate-500 mb-3">① 漢字のレベルを選択：</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* ALL LEVEL MIX */}
                    <button
                      id="btn_level_all"
                      onClick={() => { playSound("click"); setSelectedLevel("all"); }}
                      className={`p-4 rounded-2xl text-left border-3 transition-all ${
                        selectedLevel === "all"
                          ? "border-amber-400 bg-amber-50/50 shadow-md ring-2 ring-amber-300"
                          : "border-slate-100 hover:border-amber-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-black text-slate-800 text-lg">💡 全レベルランダムMIX</span>
                        {selectedLevel === "all" && <span className="bg-amber-400 text-white p-1 rounded-full text-xs">✓</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">すべての小学校・中学校・一般レベルからランダムに出題されます。</p>
                    </button>

                    {/* DYNAMIC LEVELS */}
                    {KANJI_LEVELS.map((level) => (
                      <button
                        id={`btn_level_${level.id}`}
                        key={level.id}
                        onClick={() => { playSound("click"); setSelectedLevel(level.id); }}
                        className={`p-4 rounded-2xl text-left border-3 transition-all ${
                          selectedLevel === level.id
                            ? "border-amber-400 bg-amber-50/50 shadow-md ring-2 ring-amber-300"
                            : "border-slate-100 hover:border-amber-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-black text-slate-800 text-base">{level.name}</span>
                          {selectedLevel === level.id && <span className="bg-amber-400 text-white p-1 rounded-full text-xs">✓</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{level.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. QUESTION COUNT SELECT */}
                <div className="mb-8">
                  <label className="block text-sm font-bold text-slate-500 mb-3">② 出題問題数：</label>
                  <div className="flex gap-4">
                    {[5, 10, 15, 20].map((count) => (
                      <button
                        id={`btn_count_${count}`}
                        key={count}
                        onClick={() => { playSound("click"); setQuestionCount(count); }}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 text-center transition-all ${
                          questionCount === count
                            ? "bg-slate-800 text-white border-slate-800 shadow-md"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {count}問
                      </button>
                    ))}
                  </div>
                </div>

                {/* TIP / MOTIVATION CARD */}
                <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex gap-3 items-start">
                  <span className="text-xl">🎓</span>
                  <div>
                    <h4 className="text-sm font-bold text-sky-800">復習リストの自動保存機能</h4>
                    <p className="text-xs text-sky-700 leading-relaxed mt-0.5">
                      間違えた問題は右側の「復習リスト」に自動で蓄積されます。間違えた問題だけを集めて特訓することも可能です。
                    </p>
                  </div>
                </div>
              </div>

              {/* START ACTION BUTTON */}
              <div className="mt-8">
                <button
                  id="btn_start_quiz"
                  onClick={() => startNewQuiz(selectedLevel, questionCount, false)}
                  className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xl rounded-2xl shadow-lg shadow-emerald-100 hover:brightness-105 transition-all flex items-center justify-center gap-2 border-b-4 border-emerald-700"
                >
                  ゲームをスタートする！
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE QUIZ SCREEN */}
          {quizState === "quiz" && currentQuestionObj && (
            <div id="quiz_panel" className="flex-grow flex flex-col gap-5">
              
              {/* Core Question Card */}
              <div className="bg-white rounded-[40px] shadow-xl border-b-8 border-slate-200 border-x border-t border-slate-100 flex-grow flex flex-col items-center justify-center p-6 md:p-8 lg:p-10 relative overflow-hidden">
                
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-3 bg-slate-100">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-300 rounded-r-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                    style={{ width: `${((currentIndex + 1) / activeQuestions.length) * 100}%` }}
                  ></div>
                </div>

                {/* Question Metadata Header */}
                <div className="w-full flex justify-between items-center mb-4 md:mb-6 mt-2 text-xs font-bold text-slate-400 tracking-wider">
                  <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                    {currentQuestionObj.levelName} • {currentQuestionObj.typeName}
                  </span>
                  <span>
                    問題 {currentIndex + 1} / {activeQuestions.length}
                  </span>
                </div>

                {/* Question Context Text */}
                <div className="text-center mb-6">
                  <p className="text-slate-400 text-sm font-bold tracking-wide uppercase mb-2">次の【 】部分の漢字について答えなさい</p>
                  <p className="text-slate-700 font-bold text-lg md:text-xl px-4 py-2 bg-amber-50/50 rounded-xl inline-block border border-amber-100/50">
                    {currentQuestionObj.question}
                  </p>
                </div>

                {/* GIANT KANJI DISPLAY */}
                <div className="text-7xl md:text-8xl lg:text-[110px] font-serif font-black text-slate-800 leading-none mb-6 select-none bg-gradient-to-b from-slate-900 to-slate-700 bg-clip-text text-transparent p-2">
                  {currentQuestionObj.kanji}
                </div>

                {/* FEEDBACK OVERLAY (Visual cue for answered state) */}
                {isAnswered && (
                  <div className="mb-4 flex items-center gap-2 text-lg font-black tracking-wide animate-fade-in">
                    {selectedAnswer === currentQuestionObj.answerIndex ? (
                      <span className="text-emerald-500 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-5 h-5" /> 正解！ (+100 pts)
                      </span>
                    ) : (
                      <span className="text-rose-500 bg-rose-50 px-4 py-1.5 rounded-full border border-rose-200 flex items-center gap-1.5 shadow-sm animate-shake">
                        <XCircle className="w-5 h-5" /> 不正解... (正解: {currentQuestionObj.options[currentQuestionObj.answerIndex]})
                      </span>
                    )}
                  </div>
                )}

                {/* 4 CHOICES GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full mt-2">
                  {currentQuestionObj.options.map((option, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const isCorrectOption = idx === currentQuestionObj.answerIndex;
                    
                    let btnStyle = "bg-white border-3 border-slate-100 text-slate-700 hover:border-amber-300 hover:bg-amber-50/20";
                    let numberBadgeStyle = "bg-slate-100 text-slate-400";

                    if (isAnswered) {
                      if (isCorrectOption) {
                        btnStyle = "bg-emerald-50 border-3 border-emerald-500 text-emerald-800 shadow-md ring-2 ring-emerald-300";
                        numberBadgeStyle = "bg-emerald-500 text-white";
                      } else if (isSelected) {
                        btnStyle = "bg-rose-50 border-3 border-rose-400 text-rose-800 ring-1 ring-rose-200";
                        numberBadgeStyle = "bg-rose-500 text-white";
                      } else {
                        btnStyle = "bg-slate-50 border-3 border-slate-100 text-slate-400 opacity-60";
                      }
                    } else if (isSelected) {
                      btnStyle = "bg-amber-50/70 border-3 border-amber-400 text-amber-900 shadow-md ring-2 ring-amber-300";
                      numberBadgeStyle = "bg-amber-400 text-white";
                    }

                    return (
                      <button
                        id={`btn_choice_${idx + 1}`}
                        key={idx}
                        disabled={isAnswered}
                        onClick={() => handleAnswerSelect(idx)}
                        className={`py-4 md:py-5 px-6 rounded-2xl text-lg md:text-xl font-bold transition-all flex items-center relative group ${btnStyle}`}
                      >
                        <span className={`inline-block w-8 h-8 rounded-lg text-sm font-black leading-8 text-center mr-4 shrink-0 transition-colors ${numberBadgeStyle}`}>
                          {idx + 1}
                        </span>
                        <span className="flex-grow text-left leading-tight">{option}</span>

                        {isAnswered && isCorrectOption && (
                          <span className="absolute right-4 text-emerald-600 bg-emerald-100 p-1 rounded-full text-xs">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* EXPLANATION AREA AND ACTION BUTTONS */}
                {isAnswered && (
                  <div className="w-full mt-6 pt-5 border-t border-slate-100">
                    <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-200">
                      <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-1">【解説】</h4>
                      <p className="text-slate-700 text-sm md:text-base leading-relaxed font-medium">
                        {currentQuestionObj.explanation}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      {/* AI Master Deep Explanation Button */}
                      <button
                        id="btn_request_ai_explain"
                        onClick={() => requestAiExplanation(
                          currentQuestionObj.kanji,
                          currentQuestionObj.reading,
                          currentQuestionObj.typeName,
                          currentQuestionObj.question,
                          currentQuestionObj.explanation
                        )}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:brightness-105 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 border-b-2 border-indigo-700"
                      >
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        AI先生に詳しく解説してもらう！
                      </button>

                      {/* Manual Hint / Quick Search */}
                      <a
                        href={`https://dictionary.goo.ne.jp/srch/all/${encodeURIComponent(currentQuestionObj.kanji)}/m0u/`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        辞書で調べる <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* BOTTOM CONTROL AND NAVIGATION BAR */}
              <div className="flex justify-between items-center bg-white/70 backdrop-blur rounded-2xl px-6 py-4 border border-amber-200 shadow-sm gap-4">
                <div className="text-left text-xs md:text-sm">
                  {selectedAnswer === null ? (
                    <span className="text-slate-400 font-medium">1〜4キーを押すか、ボタンをクリックして選択してください。</span>
                  ) : !isAnswered ? (
                    <span className="text-amber-800 font-bold flex items-center gap-1.5">
                      💡 選択しました。下の「回答を決定する」ボタンまたは「Space」キーで決定してください。
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-extrabold">「次へ進む」または「Space」キーを押してください。</span>
                  )}
                </div>

                {!isAnswered ? (
                  <button
                    id="btn_confirm_answer"
                    disabled={selectedAnswer === null}
                    onClick={confirmAnswer}
                    className={`px-8 py-3.5 rounded-xl font-bold text-base shadow-md transition-all shrink-0 ${
                      selectedAnswer === null
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-slate-800 text-white hover:bg-slate-700"
                    }`}
                  >
                    回答を決定する
                  </button>
                ) : (
                  <button
                    id="btn_next_question"
                    onClick={handleNextQuestion}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-xl font-bold text-base shadow-md transition-colors shrink-0 flex items-center gap-1"
                  >
                    {currentIndex + 1 === activeQuestions.length ? "結果を見る" : "次へ進む"}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* RESULTS SCREEN */}
          {quizState === "result" && (
            <div id="result_panel" className="bg-white rounded-[40px] p-6 md:p-8 lg:p-10 shadow-xl border-b-8 border-slate-200 border-x border-t border-slate-100 flex-grow flex flex-col justify-between">
              
              <div className="text-center py-6">
                <div className="inline-block p-4 bg-amber-50 rounded-full mb-4 animate-bounce-slow">
                  <Award className="w-16 h-16 text-amber-500" />
                </div>
                
                <h2 className="text-3xl font-black text-slate-800">
                  {isReviewPracticeMode ? "復習トレーニング終了！" : "クイズお疲れ様でした！"}
                </h2>
                <p className="text-slate-400 font-bold mt-2 text-sm uppercase tracking-widest">
                  学習の成果が蓄積されています
                </p>

                {/* Score Big Display */}
                <div className="my-8 max-w-sm mx-auto bg-gradient-to-br from-amber-50 to-orange-50 border-4 border-amber-200 rounded-3xl p-6 relative overflow-hidden">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">獲得スコア</div>
                  <div className="text-5xl font-black text-amber-600 mt-1">{sessionScore} <span className="text-lg text-slate-400">pts</span></div>
                  
                  <div className="mt-4 pt-4 border-t border-amber-200/50 flex justify-around">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">正解数</div>
                      <div className="text-xl font-black text-slate-700">{correctAnswersCount} / {activeQuestions.length}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">正解率</div>
                      <div className="text-xl font-black text-slate-700">
                        {Math.round((correctAnswersCount / activeQuestions.length) * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* Stamp / Rank based on percentage */}
                  <div className="absolute -right-4 -bottom-4 transform -rotate-12 bg-emerald-500 text-white font-extrabold px-6 py-2 rounded-lg text-xs tracking-widest shadow uppercase">
                    {(correctAnswersCount / activeQuestions.length) === 1 ? "完全マスター" : (correctAnswersCount / activeQuestions.length) >= 0.8 ? "秀才合格" : (correctAnswersCount / activeQuestions.length) >= 0.5 ? "がんばった" : "挑戦者"}
                  </div>
                </div>

                {/* Motivation phrase */}
                <p className="text-slate-600 font-semibold px-6 text-sm max-w-lg mx-auto leading-relaxed">
                  {(correctAnswersCount / activeQuestions.length) === 1 
                    ? "素晴らしい！全問正解です。漢字マスターとしての道を順調に進んでいますね。" 
                    : "間違えてしまった漢字は、自動的に「復習リスト」に登録されました。何度も復習して完璧に覚えましょう！"}
                </p>
              </div>

              {/* Action buttons to restart or go to lobby */}
              <div className="mt-6 flex flex-col md:flex-row gap-4">
                <button
                  id="btn_retry_same"
                  onClick={() => {
                    playSound("click");
                    // Reshuffle and start
                    const reshuffled = [...activeQuestions].sort(() => Math.random() - 0.5);
                    setActiveQuestions(reshuffled);
                    setCurrentIndex(0);
                    setSelectedAnswer(null);
                    setIsAnswered(false);
                    setSessionScore(0);
                    setCorrectAnswersCount(0);
                    setQuizState("quiz");
                    setFeedbackEffect(null);
                  }}
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  もう一度同じ設定で挑戦する
                </button>

                <button
                  id="btn_back_to_lobby"
                  onClick={() => {
                    playSound("click");
                    setQuizState("lobby");
                    setIsReviewPracticeMode(false);
                  }}
                  className="flex-1 py-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-105 text-white font-black rounded-2xl transition-all shadow-md shadow-amber-100 flex items-center justify-center gap-2 border-b-4 border-orange-600"
                >
                  設定メニューに戻る
                </button>
              </div>

            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: REVIEW LIST & TARGET PROGRESS */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
          
          {/* PERSISTED REVIEW LIST CARD */}
          <div className="bg-white rounded-3xl p-5 shadow-lg border border-slate-100 flex-grow flex flex-col justify-between min-h-[400px]">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2">
                  <span className="text-rose-500">📖</span> 復習リスト
                  <span className="text-xs font-black bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">
                    {reviewList.length} 件
                  </span>
                </h2>
                
                {reviewList.length > 0 && (
                  <button
                    id="btn_clear_review_all"
                    onClick={handleClearReviewList}
                    className="text-xs font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                    title="復習リストをすべてクリア"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> クリア
                  </button>
                )}
              </div>

              {/* LIST OF WRONG KANJIS */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {reviewList.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <BookMarked className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-bold">まだ登録はありません</p>
                    <p className="text-xs text-slate-400 mt-1 px-4 leading-relaxed">
                      クイズで間違えてしまった漢字が、自動的にここに保存されます。
                    </p>
                  </div>
                ) : (
                  reviewList.map((item) => {
                    const isRevealed = !!showReadings[item.questionId];
                    return (
                      <div 
                        key={item.questionId} 
                        className="p-3 bg-gradient-to-r from-rose-50/50 to-rose-50/20 border-l-4 border-rose-400 rounded-r-xl flex justify-between items-center group hover:bg-rose-50/60 transition-all border border-y-slate-100 border-r-slate-100"
                      >
                        <div className="text-left flex-grow mr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-2xl font-serif font-black text-slate-800 shrink-0">{item.kanji}</span>
                            <button
                              id={`btn_toggle_reading_${item.questionId}`}
                              onClick={() => setShowReadings(prev => ({ ...prev, [item.questionId]: !prev[item.questionId] }))}
                              className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all flex items-center gap-1 shrink-0 ${
                                isRevealed 
                                  ? "bg-rose-100/80 text-rose-700 border border-rose-200" 
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 hover:text-slate-700"
                              }`}
                              title={isRevealed ? "読みを隠す" : "読みを表示する"}
                            >
                              {isRevealed ? (
                                <>
                                  <EyeOff className="w-3 h-3 shrink-0" />
                                  <span>{item.reading}</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3 h-3 shrink-0" />
                                  <span>よみ表示</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 max-w-[150px]">{item.questionText}</p>
                          <p className="text-[9px] text-rose-500 font-extrabold mt-0.5">間違い: {item.mistakeCount}回</p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Quick AI explanation for review items */}
                          <button
                            id={`btn_review_explain_${item.questionId}`}
                            onClick={() => requestAiExplanation(item.kanji, item.reading, "復習リスト", item.questionText, "復習リストから学習")}
                            className="p-1.5 bg-white border border-slate-200 hover:border-indigo-300 text-indigo-500 rounded-lg shadow-xs transition-colors"
                            title="AI先生に解説してもらう"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          <button
                            id={`btn_review_remove_${item.questionId}`}
                            onClick={() => handleRemoveReviewItem(item.questionId)}
                            className="p-1.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            title="リストから削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* PRACTICE REVIEW LIST BUTTON */}
            {reviewList.length > 0 && (
              <button
                id="btn_start_review_practice"
                onClick={() => startNewQuiz("all", 10, true)}
                className="mt-4 w-full bg-rose-500 hover:bg-rose-600 text-white py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-md shadow-rose-100 flex items-center justify-center gap-2"
              >
                <span>📖 復習リストから特訓を始める</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>


        </div>
      </main>

      {/* FOOTER SHORTCUT KEY LEGENDS */}
      <footer id="footer_legend" className="p-4 bg-slate-900 text-white/60 flex flex-wrap justify-center gap-x-10 gap-y-2 text-[10px] font-bold uppercase tracking-widest mt-auto">
        <span className="text-white flex items-center gap-1">🎮 キーボード操作：</span>
        <span><kbd className="bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded border border-slate-700 mr-1">[1-4]</kbd> 選択肢を選ぶ</span>
        <span><kbd className="bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded border border-slate-700 mr-1">[SPACE]</kbd> 回答の決定 / 次へ</span>
        <span>お使いのブラウザでいつでも軽快に動作します</span>
      </footer>

      {/* AI INSTRUCTOR DEEP EXPLANATION MODAL */}
      {showAiModal && (
        <div id="ai_modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border-4 border-indigo-200 max-h-[85vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">AI国語先生の漢字特別授業</h3>
                  <p className="text-[10px] opacity-85">Gemini 3.5 Flashによるプロ級の漢字指導</p>
                </div>
              </div>
              
              <button 
                id="btn_close_ai_modal"
                onClick={() => { playSound("click"); setShowAiModal(false); }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="p-6 overflow-y-auto space-y-4 bg-slate-50 text-slate-800 text-sm md:text-base leading-relaxed">
              
              {aiExplainLoading ? (
                <div className="py-16 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-indigo-700 text-base animate-pulse">AI先生が解説を作成中...</p>
                    <p className="text-xs text-slate-400">成り立ち、きれいに書くコツ、例文などをまとめています</p>
                  </div>
                </div>
              ) : (
                <div className="prose prose-indigo max-w-none">
                  {aiExplanation ? (
                    <div className="whitespace-pre-line text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                      {/* We parse simple markdown headers or bold blocks for beautiful readability */}
                      {aiExplanation.split("\n").map((line, idx) => {
                        if (line.startsWith("###")) {
                          return <h4 key={idx} className="text-base font-black text-indigo-900 border-b border-indigo-100 pb-1 mt-4">{line.replace("###", "").trim()}</h4>;
                        }
                        if (line.startsWith("##")) {
                          return <h3 key={idx} className="text-lg font-black text-indigo-950 border-b-2 border-indigo-200 pb-1 mt-5">{line.replace("##", "").trim()}</h3>;
                        }
                        if (line.startsWith("#")) {
                          return <h2 key={idx} className="text-xl font-black text-purple-950 pb-2 mt-6">{line.replace("#", "").trim()}</h2>;
                        }
                        
                        // Parse bold tags **
                        let formattedLine: React.ReactNode = line;
                        if (line.includes("**")) {
                          const parts = line.split("**");
                          formattedLine = parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-indigo-700 font-extrabold">{part}</strong> : part);
                        }

                        // Parse simple bullet points
                        if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
                          return (
                            <div key={idx} className="flex gap-2 pl-3 items-start my-1 text-slate-700 font-medium text-sm md:text-base">
                              <span className="text-indigo-500 mt-1">✦</span>
                              <span>{typeof formattedLine === 'string' ? line.trim().substring(1).trim() : formattedLine}</span>
                            </div>
                          );
                        }

                        return <p key={idx} className="my-1.5 font-medium text-slate-700 text-sm md:text-base">{formattedLine}</p>;
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-slate-400">解説を読み込めませんでした。</p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
              <button
                id="btn_close_ai_modal_footer"
                onClick={() => { playSound("click"); setShowAiModal(false); }}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition-colors"
              >
                閉じてクイズに戻る
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
