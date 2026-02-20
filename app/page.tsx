'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import type { AIAgentResponse } from '@/lib/aiAgent'
import { FiFilm, FiEdit3, FiClock, FiPlay, FiPause, FiSettings, FiSearch, FiTrash2, FiX, FiChevronRight, FiChevronLeft, FiBookOpen, FiVideo, FiList, FiMaximize, FiMinimize, FiVolume2, FiVolumeX, FiSkipForward, FiSkipBack } from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi2'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ScriptStep {
  step_number: number
  step_title: string
  narration_text: string
  scene_description: string
  ingredients_highlighted: string[]
  timing_cue: string
  technique_notes: string
  transition: string
}

interface GeneratedScript {
  id: string
  recipe_title: string
  total_duration: string
  difficulty_level: string
  servings: string
  script_steps: ScriptStep[]
  created_at: string
  original_recipe: string
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const AGENT_ID = '6998da055cb5d92ee525ec42'

const STEP_GRADIENTS = [
  'from-orange-400/30 via-amber-300/20 to-yellow-200/10',
  'from-rose-400/30 via-pink-300/20 to-orange-200/10',
  'from-amber-400/30 via-orange-300/20 to-red-200/10',
  'from-yellow-400/30 via-amber-300/20 to-orange-200/10',
  'from-red-400/30 via-rose-300/20 to-pink-200/10',
  'from-orange-500/30 via-red-300/20 to-amber-200/10',
  'from-pink-400/30 via-rose-300/20 to-red-200/10',
  'from-amber-500/30 via-yellow-300/20 to-orange-200/10',
]

const STEP_ICONS = ['🍳', '🔪', '🥄', '🫕', '🧈', '🌿', '🍲', '🧂', '🥘', '🍽️', '🔥', '⏱️', '🥣', '🧊', '🍯']

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">{part}</strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ErrorBoundary                                                       */
/* ------------------------------------------------------------------ */

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/* ------------------------------------------------------------------ */
/* Glass Card                                                          */
/* ------------------------------------------------------------------ */

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-[16px] bg-card/75 border border-white/[0.18] rounded-[0.875rem] shadow-md ${className}`}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tutorial Player Component                                           */
/* ------------------------------------------------------------------ */

function TutorialPlayer({
  script,
  onClose,
}: {
  script: GeneratedScript
  onClose: () => void
}) {
  const steps = Array.isArray(script?.script_steps) ? script.script_steps : []
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [narrationEnabled, setNarrationEnabled] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [stepProgress, setStepProgress] = useState(0)
  const [textReveal, setTextReveal] = useState(0)
  const playerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentStep = steps[currentStepIdx] || null
  const totalSteps = steps.length
  const overallProgress = totalSteps > 0 ? ((currentStepIdx + stepProgress / 100) / totalSteps) * 100 : 0

  // Text reveal animation
  useEffect(() => {
    setTextReveal(0)
    if (!isPlaying || !currentStep) return
    const narrationLength = (currentStep.narration_text || '').length
    if (narrationLength === 0) { setTextReveal(100); return }
    const duration = Math.max(narrationLength * 40, 3000)
    const interval = 50
    const increment = (100 / (duration / interval))
    const timer = setInterval(() => {
      setTextReveal(prev => {
        if (prev >= 100) { clearInterval(timer); return 100 }
        return Math.min(prev + increment, 100)
      })
    }, interval)
    return () => clearInterval(timer)
  }, [currentStepIdx, isPlaying, currentStep])

  // Step progress timer
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    setStepProgress(0)
    const stepDuration = Math.max((currentStep?.narration_text || '').length * 50, 5000)
    const interval = 100
    const increment = (100 / (stepDuration / interval))
    timerRef.current = setInterval(() => {
      setStepProgress(prev => {
        if (prev >= 100) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 100
        }
        return Math.min(prev + increment, 100)
      })
    }, interval)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentStepIdx, isPlaying, currentStep])

  // Auto-advance when step completes
  useEffect(() => {
    if (stepProgress >= 100 && isPlaying) {
      autoAdvanceRef.current = setTimeout(() => {
        if (currentStepIdx < totalSteps - 1) {
          setCurrentStepIdx(prev => prev + 1)
          setStepProgress(0)
        } else {
          setIsPlaying(false)
        }
      }, 800)
    }
    return () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current) }
  }, [stepProgress, isPlaying, currentStepIdx, totalSteps])

  // Text-to-speech narration
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    setIsSpeaking(false)

    if (!isPlaying || !narrationEnabled || !currentStep?.narration_text) return

    const utterance = new SpeechSynthesisUtterance(currentStep.narration_text)
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = 1.0

    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google US English') || v.name.includes('Microsoft Zira') || (v.lang === 'en-US' && v.localService))
    if (preferred) utterance.voice = preferred

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    const speakTimer = setTimeout(() => {
      window.speechSynthesis.speak(utterance)
    }, 300)

    return () => {
      clearTimeout(speakTimer)
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [currentStepIdx, isPlaying, narrationEnabled, currentStep])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      if (timerRef.current) clearInterval(timerRef.current)
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
    }
  }, [])

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
    setIsPlaying(prev => !prev)
  }, [isPlaying])

  const handleNext = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    if (currentStepIdx < totalSteps - 1) {
      setCurrentStepIdx(prev => prev + 1)
      setStepProgress(0)
    }
  }, [currentStepIdx, totalSteps])

  const handlePrev = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    if (currentStepIdx > 0) {
      setCurrentStepIdx(prev => prev - 1)
      setStepProgress(0)
    }
  }, [currentStepIdx])

  const handleStepClick = useCallback((idx: number) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    setCurrentStepIdx(idx)
    setStepProgress(0)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!playerRef.current) return
    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); handlePlayPause() }
      if (e.key === 'ArrowRight' || e.key === 'l') handleNext()
      if (e.key === 'ArrowLeft' || e.key === 'j') handlePrev()
      if (e.key === 'f') toggleFullscreen()
      if (e.key === 'm') setNarrationEnabled(prev => !prev)
      if (e.key === 'Escape' && isFullscreen) document.exitFullscreen().catch(() => {})
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlePlayPause, handleNext, handlePrev, toggleFullscreen, isFullscreen])

  const ingredients = Array.isArray(currentStep?.ingredients_highlighted) ? currentStep.ingredients_highlighted : []
  const gradientIdx = currentStepIdx % STEP_GRADIENTS.length
  const iconIdx = currentStepIdx % STEP_ICONS.length
  const revealedText = currentStep?.narration_text ? currentStep.narration_text.slice(0, Math.floor((textReveal / 100) * currentStep.narration_text.length)) : ''

  return (
    <div ref={playerRef} className={`flex flex-col bg-background ${isFullscreen ? 'fixed inset-0 z-50' : 'rounded-[0.875rem] overflow-hidden border border-border/50 shadow-xl'}`}>
      {/* Player Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card/90 backdrop-blur-[16px] border-b border-border/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
            <FiPlay className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight truncate text-foreground">{script?.recipe_title || 'Tutorial'}</h3>
            <p className="text-xs text-muted-foreground">Step {currentStepIdx + 1} of {totalSteps}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setNarrationEnabled(!narrationEnabled)} title={narrationEnabled ? 'Mute narration' : 'Enable narration'}>
            {narrationEnabled ? <FiVolume2 className="w-4 h-4" /> : <FiVolumeX className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={toggleFullscreen} title="Toggle fullscreen">
            {isFullscreen ? <FiMinimize className="w-4 h-4" /> : <FiMaximize className="w-4 h-4" />}
          </Button>
          {!isFullscreen && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose} title="Close player">
              <FiX className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Visual Area */}
      <div className={`relative flex-1 ${isFullscreen ? 'min-h-0' : 'min-h-[420px]'}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${STEP_GRADIENTS[gradientIdx]} transition-all duration-1000`} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_hsl(var(--background)/0.3)_100%)]" />

        {currentStep ? (
          <div className="relative h-full flex flex-col justify-between p-6 md:p-8">
            {/* Top: Step header + scene */}
            <div className="space-y-4">
              <div className={`inline-flex items-center gap-3 transition-all duration-700 ${isPlaying ? 'opacity-100 translate-y-0' : 'opacity-80'}`}>
                <span className="text-3xl md:text-4xl">{STEP_ICONS[iconIdx]}</span>
                <div>
                  <Badge variant="secondary" className="text-xs font-normal mb-1">Step {currentStep.step_number}</Badge>
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">{currentStep.step_title}</h2>
                </div>
              </div>

              {currentStep.scene_description && (
                <div className="backdrop-blur-[12px] bg-foreground/5 rounded-[0.875rem] border border-white/10 p-4 max-w-2xl">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Scene Direction</p>
                  <p className="text-sm text-foreground/70 italic leading-relaxed">{currentStep.scene_description}</p>
                </div>
              )}
            </div>

            {/* Center: Narration text with reveal */}
            <div className="flex-1 flex items-center justify-center py-6">
              <div className="max-w-2xl text-center">
                <p className="text-lg md:text-xl leading-relaxed tracking-tight text-foreground/90 font-medium">
                  {isPlaying ? (
                    <>
                      <span>{revealedText}</span>
                      <span className="text-foreground/20">{currentStep.narration_text.slice(revealedText.length)}</span>
                      {isSpeaking && <span className="inline-block w-0.5 h-5 bg-primary ml-1 animate-pulse" />}
                    </>
                  ) : (
                    currentStep.narration_text
                  )}
                </p>
              </div>
            </div>

            {/* Bottom: Ingredients + Timing + Technique */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {ingredients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {ingredients.map((ing, idx) => (
                      <Badge key={idx} className="text-xs font-normal bg-primary/15 border-primary/25 text-primary border">
                        {ing}
                      </Badge>
                    ))}
                  </div>
                )}
                {currentStep.timing_cue && (
                  <Badge variant="secondary" className="text-xs font-normal gap-1">
                    <FiClock className="w-3 h-3" />
                    {currentStep.timing_cue}
                  </Badge>
                )}
              </div>

              {currentStep.technique_notes && (
                <div className="backdrop-blur-[12px] bg-primary/5 rounded-[0.875rem] border border-primary/10 p-3">
                  <p className="text-xs font-medium text-primary uppercase tracking-wider mb-0.5">Technique Tip</p>
                  <p className="text-sm text-foreground/70 leading-relaxed">{currentStep.technique_notes}</p>
                </div>
              )}

              {currentStep.transition && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60 italic">
                  <FiChevronRight className="w-3 h-3" />
                  <span>{currentStep.transition}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground">No steps available</p>
          </div>
        )}
      </div>

      {/* Step Progress Bar */}
      <div className="h-1 bg-muted/30">
        <div className="h-full bg-primary transition-all duration-200 ease-linear" style={{ width: `${stepProgress}%` }} />
      </div>

      {/* Controls Bar */}
      <div className="px-4 py-3 bg-card/90 backdrop-blur-[16px] border-t border-border/50">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Step navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handlePrev} disabled={currentStepIdx === 0}>
              <FiSkipBack className="w-4 h-4" />
            </Button>
            <Button size="sm" className={`h-10 w-10 p-0 rounded-full ${isPlaying ? 'bg-primary text-primary-foreground' : ''}`} variant={isPlaying ? 'default' : 'outline'} onClick={handlePlayPause}>
              {isPlaying ? <FiPause className="w-4 h-4" /> : <FiPlay className="w-4 h-4 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleNext} disabled={currentStepIdx >= totalSteps - 1}>
              <FiSkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Center: Step dots */}
          <div className="flex-1 flex items-center justify-center gap-1.5 overflow-x-auto px-2">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleStepClick(idx)}
                className={`flex-shrink-0 rounded-full transition-all duration-300 ${
                  idx === currentStepIdx
                    ? 'w-8 h-2.5 bg-primary'
                    : idx < currentStepIdx
                    ? 'w-2.5 h-2.5 bg-primary/40'
                    : 'w-2.5 h-2.5 bg-muted-foreground/20 hover:bg-muted-foreground/40'
                }`}
                title={`Step ${idx + 1}: ${steps[idx]?.step_title || ''}`}
              />
            ))}
          </div>

          {/* Right: Overall progress */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[80px] justify-end">
            <span>{Math.round(overallProgress)}%</span>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground/40">
          <span>Space: play/pause</span>
          <span>Arrows: prev/next</span>
          <span>F: fullscreen</span>
          <span>M: mute</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step Card Component                                                 */
/* ------------------------------------------------------------------ */

function StepCard({
  step,
  isEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  editValue,
  onEditChange,
}: {
  step: ScriptStep
  isEditing: boolean
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  editValue: string
  onEditChange: (val: string) => void
}) {
  const ingredients = Array.isArray(step?.ingredients_highlighted) ? step.ingredients_highlighted : []

  return (
    <GlassCard className="p-5 transition-all duration-300 hover:shadow-lg hover:border-primary/20">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
          {step?.step_number ?? '?'}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-card-foreground tracking-tight leading-relaxed">{step?.step_title ?? 'Untitled Step'}</h4>
            {step?.timing_cue && (
              <Badge variant="secondary" className="flex-shrink-0 text-xs font-normal">
                <FiClock className="mr-1 w-3 h-3" />
                {step.timing_cue}
              </Badge>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Narration</p>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea value={editValue} onChange={(e) => onEditChange(e.target.value)} className="text-sm min-h-[80px] bg-background/50" rows={3} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={onSaveEdit} className="text-xs h-7">Save</Button>
                  <Button size="sm" variant="ghost" onClick={onCancelEdit} className="text-xs h-7">Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground/80 leading-relaxed cursor-pointer hover:bg-primary/5 rounded-md p-1.5 -m-1.5 transition-colors group" onClick={onStartEdit} title="Click to edit narration">
                {step?.narration_text || 'No narration text'}
                <FiEdit3 className="inline ml-2 w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            )}
          </div>

          {step?.scene_description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Scene</p>
              <p className="text-sm text-foreground/70 leading-relaxed italic">{step.scene_description}</p>
            </div>
          )}

          {ingredients.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Ingredients</p>
              <div className="flex flex-wrap gap-1.5">
                {ingredients.map((ing, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs font-normal bg-primary/5 border-primary/20 text-primary">{ing}</Badge>
                ))}
              </div>
            </div>
          )}

          {step?.technique_notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Technique</p>
              <p className="text-sm text-foreground/70 leading-relaxed">{step.technique_notes}</p>
            </div>
          )}

          {step?.transition && (
            <div className="flex items-center gap-2 pt-1">
              <FiChevronRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground italic">{step.transition}</span>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Library Card Component                                              */
/* ------------------------------------------------------------------ */

function LibraryCard({ script, onView, onDelete }: { script: GeneratedScript; onView: () => void; onDelete: () => void }) {
  const stepsCount = Array.isArray(script?.script_steps) ? script.script_steps.length : 0
  const createdDate = script?.created_at ? new Date(script.created_at) : null
  const dateStr = createdDate ? createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date'

  return (
    <GlassCard className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20 group cursor-pointer">
      <div className="h-36 bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/30 flex items-center justify-center relative" onClick={onView}>
        <FiFilm className="w-12 h-12 text-primary/40" />
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="text-xs">{script?.difficulty_level ?? 'N/A'}</Badge>
        </div>
      </div>
      <div className="p-4 space-y-2" onClick={onView}>
        <h3 className="font-semibold text-sm tracking-tight truncate text-card-foreground">{script?.recipe_title ?? 'Untitled'}</h3>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><FiClock className="w-3 h-3" />{script?.total_duration ?? 'N/A'}</span>
          <span>{stepsCount} steps</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{dateStr}</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onDelete() }}>
            <FiTrash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Loading Skeleton                                                    */
/* ------------------------------------------------------------------ */

function ScriptSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <HiOutlineSparkles className="w-4 h-4 text-primary animate-pulse" />
        </div>
        <p className="text-sm text-muted-foreground">Analyzing recipe and generating tutorial...</p>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="backdrop-blur-[16px] bg-card/75 border border-white/[0.18] rounded-[0.875rem] p-5">
          <div className="flex items-start gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function Page() {
  const [activeView, setActiveView] = useState<'input' | 'library' | 'settings'>('input')
  const [recipeText, setRecipeText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [currentScript, setCurrentScript] = useState<GeneratedScript | null>(null)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showPlayer, setShowPlayer] = useState(false)
  const [savedScripts, setSavedScripts] = useState<GeneratedScript[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedScript, setSelectedScript] = useState<GeneratedScript | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [narrationSpeed, setNarrationSpeed] = useState('normal')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recipevision_scripts')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setSavedScripts(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  const handleGenerateScript = useCallback(async () => {
    if (!recipeText.trim()) return
    setIsGenerating(true)
    setGenerationError(null)
    setCurrentScript(null)
    setShowPlayer(false)
    setActiveAgentId(AGENT_ID)

    try {
      const result: AIAgentResponse = await callAIAgent(
        `Please analyze this recipe and generate a comprehensive video tutorial script:\n\n${recipeText}`,
        AGENT_ID
      )

      if (result.success && result?.response?.result) {
        let data = result.response.result as Record<string, unknown>
        if (typeof data === 'string') {
          try { data = JSON.parse(data) as Record<string, unknown> } catch {
            setGenerationError('Received an unexpected response format. Please try again.')
            setIsGenerating(false)
            setActiveAgentId(null)
            return
          }
        }

        const script: GeneratedScript = {
          id: Date.now().toString(),
          recipe_title: (data?.recipe_title as string) || 'Untitled Recipe',
          total_duration: (data?.total_duration as string) || 'Unknown',
          difficulty_level: (data?.difficulty_level as string) || 'Medium',
          servings: (data?.servings as string) || 'Unknown',
          script_steps: Array.isArray(data?.script_steps)
            ? (data.script_steps as Record<string, unknown>[]).map((step, idx) => ({
                step_number: (step?.step_number as number) ?? idx + 1,
                step_title: (step?.step_title as string) || `Step ${idx + 1}`,
                narration_text: (step?.narration_text as string) || '',
                scene_description: (step?.scene_description as string) || '',
                ingredients_highlighted: Array.isArray(step?.ingredients_highlighted) ? (step.ingredients_highlighted as string[]) : [],
                timing_cue: (step?.timing_cue as string) || '',
                technique_notes: (step?.technique_notes as string) || '',
                transition: (step?.transition as string) || '',
              }))
            : [],
          created_at: new Date().toISOString(),
          original_recipe: recipeText,
        }

        setCurrentScript(script)
        try {
          const existing = JSON.parse(localStorage.getItem('recipevision_scripts') || '[]')
          const updated = Array.isArray(existing) ? [script, ...existing] : [script]
          localStorage.setItem('recipevision_scripts', JSON.stringify(updated))
          setSavedScripts(updated)
        } catch { /* ignore */ }
      } else {
        setGenerationError((result as { error?: string })?.error || 'Could not process recipe. Please check formatting and try again.')
      }
    } catch {
      setGenerationError('Could not process recipe. Please check formatting and try again.')
    } finally {
      setIsGenerating(false)
      setActiveAgentId(null)
    }
  }, [recipeText])

  const handleStartEdit = useCallback((index: number) => {
    const steps = Array.isArray(currentScript?.script_steps) ? currentScript.script_steps : []
    setEditingStepIndex(index)
    setEditValue(steps[index]?.narration_text ?? '')
  }, [currentScript])

  const handleSaveEdit = useCallback(() => {
    if (editingStepIndex === null || !currentScript) return
    const updatedSteps = [...(Array.isArray(currentScript.script_steps) ? currentScript.script_steps : [])]
    if (updatedSteps[editingStepIndex]) {
      updatedSteps[editingStepIndex] = { ...updatedSteps[editingStepIndex], narration_text: editValue }
    }
    const updatedScript = { ...currentScript, script_steps: updatedSteps }
    setCurrentScript(updatedScript)
    setEditingStepIndex(null)
    setEditValue('')
    try {
      const existing = JSON.parse(localStorage.getItem('recipevision_scripts') || '[]')
      if (Array.isArray(existing)) {
        const updated = existing.map((s: GeneratedScript) => (s.id === updatedScript.id ? updatedScript : s))
        localStorage.setItem('recipevision_scripts', JSON.stringify(updated))
        setSavedScripts(updated)
      }
    } catch { /* ignore */ }
  }, [editingStepIndex, editValue, currentScript])

  const handleCancelEdit = useCallback(() => { setEditingStepIndex(null); setEditValue('') }, [])

  const handleDeleteScript = useCallback((scriptId: string) => {
    const updated = savedScripts.filter((s) => s.id !== scriptId)
    setSavedScripts(updated)
    try { localStorage.setItem('recipevision_scripts', JSON.stringify(updated)) } catch { /* ignore */ }
  }, [savedScripts])

  const filteredScripts = savedScripts.filter((s) => (s?.recipe_title ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
  const charCount = recipeText.length
  const currentSteps = Array.isArray(currentScript?.script_steps) ? currentScript.script_steps : []

  /* ------------------------------------------------------------------ */
  /* RENDER: Input View                                                  */
  /* ------------------------------------------------------------------ */

  function renderInputView() {
    return (
      <div className="flex flex-col gap-6 h-full">
        {/* Tutorial Player - Full width when active */}
        {showPlayer && currentScript && (
          <TutorialPlayer script={currentScript} onClose={() => setShowPlayer(false)} />
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column */}
          <div className="w-full lg:w-[42%] flex flex-col gap-4">
            <GlassCard className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <FiBookOpen className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold tracking-tight text-card-foreground">Recipe Input</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Paste your full recipe below. The AI will generate a complete narrated tutorial you can watch and listen to right here in the app.
              </p>
              <div className="relative flex-1 flex flex-col">
                <Textarea
                  placeholder={"Paste your full recipe here...\n\nInclude the recipe name, ingredients list, and step-by-step instructions.\n\nCannabis recipes: Include decarboxylation temps, infusion methods, and dosage info for best results."}
                  value={recipeText}
                  onChange={(e) => setRecipeText(e.target.value)}
                  className="flex-1 min-h-[240px] resize-none bg-background/50 text-sm leading-relaxed"
                />
                <span className="absolute bottom-3 right-3 text-xs text-muted-foreground">{charCount} characters</span>
              </div>
              <Button onClick={handleGenerateScript} disabled={isGenerating || !recipeText.trim()} className="w-full gap-2 h-11 text-sm font-medium">
                {isGenerating ? (
                  <><HiOutlineSparkles className="w-4 h-4 animate-spin" />Analyzing Recipe...</>
                ) : (
                  <><HiOutlineSparkles className="w-4 h-4" />Generate Tutorial</>
                )}
              </Button>
              {generationError && (
                <div className="p-3 rounded-[0.875rem] bg-destructive/10 border border-destructive/20 text-destructive text-sm">{generationError}</div>
              )}
            </GlassCard>

            {/* Play Tutorial Button */}
            {currentScript && !showPlayer && (
              <GlassCard className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <FiVideo className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold tracking-tight text-card-foreground">Watch Tutorial</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your tutorial is ready. Play it with voice narration, animated step transitions, and full-screen support.
                </p>
                <Button onClick={() => setShowPlayer(true)} className="w-full gap-2 h-11 text-sm font-medium bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90">
                  <FiPlay className="w-4 h-4" />
                  Play Tutorial
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FiVolume2 className="w-3 h-3" /> Voice narration</span>
                  <span className="flex items-center gap-1"><FiMaximize className="w-3 h-3" /> Full-screen</span>
                  <span className="flex items-center gap-1"><FiList className="w-3 h-3" /> {currentSteps.length} steps</span>
                </div>
              </GlassCard>
            )}
          </div>

          {/* Right Column: Script Preview */}
          <div className="w-full lg:w-[58%] flex flex-col">
            <GlassCard className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 pb-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <FiList className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold tracking-tight text-card-foreground">Script Preview</h2>
                  </div>
                  {currentScript && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-normal">{currentSteps.length} steps</Badge>
                      {!showPlayer && (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowPlayer(true)}>
                          <FiPlay className="w-3 h-3" /> Play
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {currentScript && (
                  <div className="flex flex-wrap items-center gap-3 mt-3 mb-2">
                    <h3 className="text-base font-semibold tracking-tight text-foreground">{currentScript.recipe_title}</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs font-normal"><FiClock className="mr-1 w-3 h-3" />{currentScript.total_duration}</Badge>
                      <Badge variant="secondary" className="text-xs font-normal">{currentScript.difficulty_level}</Badge>
                      <Badge variant="secondary" className="text-xs font-normal">Serves {currentScript.servings}</Badge>
                    </div>
                  </div>
                )}
                <Separator className="mt-3" />
              </div>
              <ScrollArea className="flex-1 p-6 pt-4">
                {isGenerating ? (
                  <ScriptSkeleton />
                ) : currentScript ? (
                  <div className="space-y-4">
                    {currentSteps.map((step, index) => (
                      <StepCard
                        key={step?.step_number ?? index}
                        step={step}
                        isEditing={editingStepIndex === index}
                        onStartEdit={() => handleStartEdit(index)}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={handleCancelEdit}
                        editValue={editValue}
                        onEditChange={setEditValue}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <FiFilm className="w-8 h-8 text-primary/40" />
                    </div>
                    <div>
                      <p className="font-medium text-card-foreground tracking-tight">No tutorial generated yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Paste a recipe on the left and click &quot;Generate Tutorial&quot; to get started.</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </GlassCard>
          </div>
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /* RENDER: Library View                                                */
  /* ------------------------------------------------------------------ */

  function renderLibraryView() {
    return (
      <div className="space-y-6">
        <GlassCard className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-card-foreground">Tutorial Library</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{savedScripts.length} tutorial{savedScripts.length !== 1 ? 's' : ''} saved</p>
            </div>
            <div className="relative w-full sm:w-72">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search recipes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-background/50 text-sm h-9" />
            </div>
          </div>
        </GlassCard>

        {filteredScripts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredScripts.map((script) => (
              <LibraryCard
                key={script.id}
                script={script}
                onView={() => { setSelectedScript(script); setShowDetailModal(true) }}
                onDelete={() => handleDeleteScript(script.id)}
              />
            ))}
          </div>
        ) : (
          <GlassCard className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FiVideo className="w-8 h-8 text-primary/40" />
              </div>
              <div>
                <p className="font-medium text-card-foreground tracking-tight">No tutorials yet</p>
                <p className="text-sm text-muted-foreground mt-1">Paste a recipe to get started!</p>
              </div>
              <Button variant="secondary" className="gap-2 text-sm" onClick={() => setActiveView('input')}>
                <FiBookOpen className="w-4 h-4" />Go to Recipe Input
              </Button>
            </div>
          </GlassCard>
        )}
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /* RENDER: Settings View                                               */
  /* ------------------------------------------------------------------ */

  function renderSettingsView() {
    return (
      <div className="max-w-2xl space-y-6">
        <GlassCard className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <FiSettings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight text-card-foreground">Settings</h2>
          </div>
          <Separator />
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-card-foreground block mb-2">Narration Speed</label>
              <div className="flex gap-2">
                {['slow', 'normal', 'fast'].map((s) => (
                  <Button key={s} variant={narrationSpeed === s ? 'default' : 'outline'} size="sm" className="text-xs capitalize" onClick={() => setNarrationSpeed(s)}>{s}</Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Controls how fast the voice narration speaks during tutorial playback.</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 space-y-3">
          <h3 className="font-semibold tracking-tight text-card-foreground">About RecipeVision</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            RecipeVision uses AI to transform your written recipes into interactive narrated tutorials. Each tutorial includes voice narration, animated step transitions, ingredient highlights, technique tips, and full-screen playback -- all generated from your recipe text, including support for cannabis-infused recipes with decarboxylation and infusion guidance.
          </p>
          <p className="text-xs text-muted-foreground">Version 2.0.0</p>
        </GlassCard>

        <GlassCard className="p-6 space-y-3">
          <h3 className="font-semibold tracking-tight text-card-foreground">Tutorial Features</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: <FiVolume2 className="w-4 h-4" />, title: 'Voice Narration', desc: 'Browser text-to-speech reads each step aloud' },
              { icon: <FiMaximize className="w-4 h-4" />, title: 'Full-Screen Mode', desc: 'Hands-free viewing while you cook' },
              { icon: <FiPlay className="w-4 h-4" />, title: 'Auto-Play', desc: 'Steps advance automatically with smooth transitions' },
              { icon: <FiEdit3 className="w-4 h-4" />, title: 'Editable Scripts', desc: 'Click any narration text to customize it' },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">{feature.icon}</div>
                <div>
                  <p className="text-sm font-medium text-card-foreground">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6 space-y-3">
          <h3 className="font-semibold tracking-tight text-card-foreground">Agent Status</h3>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeAgentId === AGENT_ID ? 'bg-primary animate-pulse' : 'bg-green-500'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-card-foreground truncate">Recipe Script Agent</p>
              <p className="text-xs text-muted-foreground truncate">{activeAgentId === AGENT_ID ? 'Processing...' : 'Ready'} -- ID: {AGENT_ID.slice(0, 8)}...</p>
            </div>
            <Badge variant={activeAgentId === AGENT_ID ? 'default' : 'secondary'} className="text-xs flex-shrink-0">{activeAgentId === AGENT_ID ? 'Active' : 'Idle'}</Badge>
          </div>
        </GlassCard>
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /* RENDER: Main Layout                                                 */
  /* ------------------------------------------------------------------ */

  const navItems: { key: 'input' | 'library' | 'settings'; label: string; icon: React.ReactNode }[] = [
    { key: 'input', label: 'Recipe Input', icon: <FiBookOpen className="w-4 h-4" /> },
    { key: 'library', label: 'Tutorial Library', icon: <FiVideo className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <FiSettings className="w-4 h-4" /> },
  ]

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground font-sans">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-[16px] bg-card/80 border-b border-border/50 shadow-sm">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <FiFilm className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground leading-none">RecipeVision</h1>
                <p className="text-xs text-muted-foreground leading-none mt-0.5">AI Tutorial Generator</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${activeAgentId ? 'bg-primary animate-pulse' : 'bg-green-500'}`} />
                <span className="hidden sm:inline">{activeAgentId ? 'Processing' : 'Ready'}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-3.5rem)]">
          {/* Sidebar */}
          <aside className="hidden md:flex w-56 flex-col border-r border-border/50 backdrop-blur-[16px] bg-card/50 p-4 gap-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-[0.875rem] text-sm font-medium transition-all duration-200 text-left ${activeView === item.key ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            <div className="mt-auto pt-4">
              <Separator className="mb-4" />
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeAgentId ? 'bg-primary animate-pulse' : 'bg-green-500'}`} />
                <span className="truncate">Agent: {activeAgentId ? 'Active' : 'Ready'}</span>
              </div>
            </div>
          </aside>

          {/* Mobile Nav */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-[16px] bg-card/90 border-t border-border/50 shadow-lg">
            <div className="flex items-center justify-around h-14">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveView(item.key)}
                  className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg text-xs transition-colors ${activeView === item.key ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {item.icon}
                  <span>{item.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-y-auto">
            {activeView === 'input' && renderInputView()}
            {activeView === 'library' && renderLibraryView()}
            {activeView === 'settings' && renderSettingsView()}
          </main>
        </div>

        {/* Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="tracking-tight">{selectedScript?.recipe_title ?? 'Tutorial Details'}</DialogTitle>
              <DialogDescription className="flex flex-wrap gap-2 pt-1">
                {selectedScript?.total_duration && <Badge variant="secondary" className="text-xs font-normal"><FiClock className="mr-1 w-3 h-3" />{selectedScript.total_duration}</Badge>}
                {selectedScript?.difficulty_level && <Badge variant="secondary" className="text-xs font-normal">{selectedScript.difficulty_level}</Badge>}
                {selectedScript?.servings && <Badge variant="secondary" className="text-xs font-normal">Serves {selectedScript.servings}</Badge>}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4 mt-2">
              <div className="space-y-4">
                {Array.isArray(selectedScript?.script_steps) && selectedScript.script_steps.map((step, index) => (
                  <div key={step?.step_number ?? index} className="p-4 rounded-[0.875rem] bg-secondary/30 border border-border/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-semibold">{step?.step_number ?? index + 1}</span>
                        <h4 className="font-semibold text-sm tracking-tight">{step?.step_title ?? `Step ${index + 1}`}</h4>
                      </div>
                      {step?.timing_cue && <Badge variant="outline" className="text-xs font-normal">{step.timing_cue}</Badge>}
                    </div>
                    {step?.narration_text && <div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Narration</p><p className="text-sm text-foreground/80 leading-relaxed">{step.narration_text}</p></div>}
                    {step?.scene_description && <div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Scene</p><p className="text-sm text-foreground/70 leading-relaxed italic">{step.scene_description}</p></div>}
                    {Array.isArray(step?.ingredients_highlighted) && step.ingredients_highlighted.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">{step.ingredients_highlighted.map((ing, idx) => <Badge key={idx} variant="outline" className="text-xs font-normal bg-primary/5 border-primary/20 text-primary">{ing}</Badge>)}</div>
                    )}
                    {step?.technique_notes && <div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Technique</p><p className="text-sm text-foreground/70 leading-relaxed">{step.technique_notes}</p></div>}
                    {step?.transition && <div className="flex items-center gap-2 pt-1"><FiChevronRight className="w-3 h-3 text-muted-foreground" /><span className="text-xs text-muted-foreground italic">{step.transition}</span></div>}
                  </div>
                ))}
                {selectedScript?.original_recipe && (
                  <div className="mt-4">
                    <Separator className="mb-4" />
                    <h4 className="font-semibold text-sm tracking-tight mb-2 text-muted-foreground">Original Recipe</h4>
                    <div className="p-4 rounded-[0.875rem] bg-background/50 border border-border/50">{renderMarkdown(selectedScript.original_recipe)}</div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
              <Button variant="default" size="sm" className="text-xs gap-1.5" onClick={() => {
                if (selectedScript) {
                  setCurrentScript(selectedScript)
                  setRecipeText(selectedScript.original_recipe ?? '')
                  setActiveView('input')
                  setShowDetailModal(false)
                  setShowPlayer(true)
                }
              }}>
                <FiPlay className="w-3 h-3" />Play Tutorial
              </Button>
              <Button variant="secondary" size="sm" className="text-xs gap-1.5" onClick={() => {
                if (selectedScript) {
                  setCurrentScript(selectedScript)
                  setRecipeText(selectedScript.original_recipe ?? '')
                  setActiveView('input')
                  setShowDetailModal(false)
                }
              }}>
                <FiEdit3 className="w-3 h-3" />Edit Script
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowDetailModal(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  )
}
