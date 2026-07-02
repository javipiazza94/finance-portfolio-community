'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchProfileQuestions, submitProfileTest } from '@/lib/api';
import { ArrowRight, CheckCircle, Activity, PieChart, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

interface Question {
  q: string;
  options: string[];
  w: number[];
  cat: string;
}



const ALLOCATION_LABELS: Record<string, { label: string; color: string }> = {
  stocks: { label: 'Acciones', color: 'bg-chart-1' },
  bonds: { label: 'Renta Fija / Fondos', color: 'bg-chart-3' },
  crypto: { label: 'Criptomonedas', color: 'bg-chart-6' },
  cash: { label: 'Liquidez', color: 'bg-chart-2' },
  gold: { label: 'Oro', color: 'bg-chart-4' },
};

export default function ProfileTestPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchProfileQuestions()
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoadingQuestions(false));
  }, []);

  const getOptionLabels = (q: Question): string[] => {
    return q.options ?? q.w.map((_, i) => `Opción ${i + 1}`);
  };

  const handleStart = () => setStep(1);

  const handleAnswer = async (idx: number) => {
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);

    if (step < questions.length) {
      setStep(step + 1);
    } else {
      setStep(questions.length + 1);
      try {
        const res = await submitProfileTest(newAnswers);
        setResult(res);
        setStep(questions.length + 2);
      } catch (e) {
        console.error(e);
        alert('Ocurrió un error al procesar el test.');
        setStep(step);
      }
    }
  };

  const getProfileColors = (profileType: string) => {
    switch (profileType) {
      case 'Conservador': return 'text-chart-1 border-chart-1/30 bg-chart-1/10';
      case 'Moderado': return 'text-chart-2 border-chart-2/30 bg-chart-2/10';
      case 'Equilibrado': return 'text-chart-6 border-chart-6/30 bg-chart-6/10';
      case 'Dinámico': return 'text-chart-4 border-chart-4/30 bg-chart-4/10';
      case 'Agresivo': return 'text-danger border-danger/30 bg-danger/10';
      default: return 'text-primary border-primary/30 bg-primary/10';
    }
  };

  const variants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  if (loadingQuestions) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Activity className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">

          {/* STEP 0: INTRO */}
          {step === 0 && (
            <motion.div
              key="intro"
              variants={variants} initial="initial" animate="animate" exit="exit"
              className="glass-panel p-10 text-center"
            >
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldAlert className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-4 tracking-tight">Test de Perfil de Inversor</h1>
              <p className="text-text-muted mb-8 text-lg">
                Evaluación MiFID de <strong className="text-text-main">{questions.length} preguntas</strong> sobre
                capacidad financiera, tolerancia al riesgo, conocimiento y horizonte temporal.
              </p>
              <button
                onClick={handleStart}
                className="glass-button w-full py-4 text-lg font-bold flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all"
              >
                Comenzar Test <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* STEPS 1 to N: QUESTIONS */}
          {step > 0 && step <= questions.length && (
            <motion.div
              key={`q-${step}`}
              variants={variants} initial="initial" animate="animate" exit="exit"
              className="glass-panel p-8"
            >
              <div className="mb-8">
                <div className="flex justify-between text-sm text-text-muted mb-2 font-medium uppercase tracking-wider">
                  <span>Pregunta {step} de {questions.length}</span>
                  <span>{Math.round((step / questions.length) * 100)}% Completado</span>
                </div>
                <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(step / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-8">{questions[step - 1].q}</h2>

              <div className="space-y-4">
                {getOptionLabels(questions[step - 1]).map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className="w-full text-left p-5 rounded-xl border border-[var(--color-border)] bg-surface hover:bg-surface-hover hover:border-primary/50 transition-all group flex items-center justify-between"
                  >
                    <span className="font-medium text-lg">{label}</span>
                    <div className="w-6 h-6 rounded-full border-2 border-[var(--color-border)] group-hover:border-primary flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* LOADING */}
          {step === questions.length + 1 && (
            <motion.div
              key="loading"
              variants={variants} initial="initial" animate="animate" exit="exit"
              className="glass-panel p-16 text-center flex flex-col items-center justify-center"
            >
              <Activity className="w-12 h-12 text-primary animate-spin mb-6" />
              <h2 className="text-2xl font-bold mb-2">Analizando tus respuestas...</h2>
              <p className="text-text-muted">Calculando tu perfil de riesgo y asset allocation ideal.</p>
            </motion.div>
          )}

          {/* RESULTS */}
          {step === questions.length + 2 && result && (
            <motion.div
              key="results"
              variants={variants} initial="initial" animate="animate" exit="exit"
              className="w-full"
            >
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 text-success mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold mb-2">¡Test Completado!</h1>
                <p className="text-text-muted">Hemos analizado tu perfil y tenemos una recomendación.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`glass-panel p-8 border-2 ${getProfileColors(result.profile).split(' ')[1]}`}>
                  <h3 className="text-sm uppercase font-bold tracking-wider text-text-muted mb-2">Tu Perfil de Riesgo</h3>
                  <h2 className={`text-4xl font-black uppercase tracking-tight mb-4 ${getProfileColors(result.profile).split(' ')[0]}`}>
                    {result.profile}
                  </h2>
                  <p className="text-text-muted mb-4">
                    Puntuación: <strong className="text-text-main">{result.pct}%</strong>
                  </p>
                  {result.scores && (
                    <div className="space-y-1 text-sm text-text-muted">
                      <div className="flex justify-between"><span>Capacidad financiera</span><span>{result.scores.cap}/15</span></div>
                      <div className="flex justify-between"><span>Tolerancia al riesgo</span><span>{result.scores.tol}/9</span></div>
                      <div className="flex justify-between"><span>Conocimiento</span><span>{result.scores.con}/9</span></div>
                      <div className="flex justify-between"><span>Objetivo / Horizonte</span><span>{result.scores.obj}/12</span></div>
                    </div>
                  )}
                </div>

                <div className="glass-panel p-8 relative overflow-hidden">
                  <div className="absolute right-0 top-0 opacity-10">
                    <PieChart className="w-48 h-48 -mr-10 -mt-10" />
                  </div>
                  <h3 className="text-sm uppercase font-bold tracking-wider text-text-muted mb-6">Asset Allocation Recomendado</h3>
                  <div className="space-y-4 relative z-10">
                    {Object.entries(result.alloc ?? {}).map(([key, pct]) => {
                      const meta = ALLOCATION_LABELS[key];
                      if (!meta) return null;
                      return (
                        <div key={key} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${meta.color}`} />
                            <span className="font-medium">{meta.label}</span>
                          </div>
                          <span className="font-mono font-bold text-lg">{pct as number}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-center gap-4">
                <Link href="/portfolio" className="glass-button px-8 py-3 bg-primary text-white hover:bg-primary-hover font-medium">
                  Ir a Mi Portfolio
                </Link>
                <button
                  onClick={() => { setStep(0); setAnswers([]); setResult(null); }}
                  className="glass-button px-8 py-3 text-text-muted hover:text-white"
                >
                  Repetir Test
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
