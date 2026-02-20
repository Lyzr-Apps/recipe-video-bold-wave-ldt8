'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import type { AIAgentResponse } from '@/lib/aiAgent'
import { FiFilm, FiEdit3, FiClock, FiPlay, FiSettings, FiSearch, FiTrash2, FiX, FiChevronRight, FiBookOpen, FiVideo, FiList } from 'react-icons/fi'
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

const SAMPLE_SCRIPT: GeneratedScript = {
  id: 'sample-1',
  recipe_title: 'Classic Italian Carbonara',
  total_duration: '8 minutes',
  difficulty_level: 'Intermediate',
  servings: '4',
  script_steps: [
    {
      step_number: 1,
      step_title: 'Prepare the Guanciale',
      narration_text: 'Start by cutting the guanciale into small strips, about half a centimeter thick. We want them to render out slowly so they become beautifully crispy.',
      scene_description: 'Close-up of hands cutting guanciale on a wooden cutting board, knife catching the light.',
      ingredients_highlighted: ['guanciale', '200g'],
      timing_cue: '0:00 - 0:45',
      technique_notes: 'Cut against the grain for even pieces. If guanciale is unavailable, pancetta works as a substitute.',
      transition: 'Fade to pan on stove',
    },
    {
      step_number: 2,
      step_title: 'Render the Fat',
      narration_text: 'Place the guanciale in a cold pan and slowly bring it up to medium heat. We want to render the fat gently - no olive oil needed here.',
      scene_description: 'Wide shot of guanciale sizzling in a cast iron pan, fat slowly becoming translucent.',
      ingredients_highlighted: ['guanciale strips'],
      timing_cue: '0:45 - 2:30',
      technique_notes: 'Starting in a cold pan allows the fat to render evenly without burning the meat.',
      transition: 'Cut to egg mixture preparation',
    },
    {
      step_number: 3,
      step_title: 'Mix the Egg & Cheese Sauce',
      narration_text: 'While the guanciale cooks, whisk together egg yolks and whole eggs with a generous amount of Pecorino Romano. This is the heart of carbonara.',
      scene_description: 'Overhead shot of a glass bowl with golden egg yolks being whisked with grated cheese.',
      ingredients_highlighted: ['3 egg yolks', '2 whole eggs', 'Pecorino Romano 100g'],
      timing_cue: '2:30 - 3:45',
      technique_notes: 'Use room temperature eggs for a smoother emulsion. The ratio of yolks to whole eggs controls richness.',
      transition: 'Dissolve to boiling pasta water',
    },
    {
      step_number: 4,
      step_title: 'Cook the Spaghetti',
      narration_text: 'Cook your spaghetti in generously salted water until just shy of al dente. Remember, it will finish cooking in the pan with the guanciale.',
      scene_description: 'Steam rising from a large pot of boiling water as spaghetti is lowered in.',
      ingredients_highlighted: ['spaghetti 400g', 'salt'],
      timing_cue: '3:45 - 5:30',
      technique_notes: 'Reserve at least a cup of starchy pasta water before draining - this is your secret emulsifier.',
      transition: 'Quick cut to tossing in pan',
    },
    {
      step_number: 5,
      step_title: 'The Final Toss',
      narration_text: 'Off the heat, toss the hot pasta with the guanciale, then quickly add the egg mixture while tossing vigorously. The residual heat will cook the eggs into a silky sauce.',
      scene_description: 'Dynamic shot of pasta being tossed in the pan, creamy sauce coating every strand.',
      ingredients_highlighted: ['pasta water', 'black pepper'],
      timing_cue: '5:30 - 7:00',
      technique_notes: 'CRITICAL: Remove pan from heat before adding eggs to prevent scrambling. Add pasta water a tablespoon at a time if sauce is too thick.',
      transition: 'Slow fade to plated dish',
    },
  ],
  created_at: new Date().toISOString(),
  original_recipe: 'Classic Italian Carbonara\n\nIngredients:\n- 400g spaghetti\n- 200g guanciale\n- 3 egg yolks + 2 whole eggs\n- 100g Pecorino Romano, finely grated\n- Freshly cracked black pepper\n- Salt for pasta water\n\nInstructions:\n1. Cut guanciale into strips\n2. Render fat in cold pan on medium heat\n3. Whisk eggs with cheese\n4. Cook pasta until just under al dente\n5. Toss pasta with guanciale off heat\n6. Add egg mixture while tossing vigorously\n7. Season with black pepper and serve immediately',
}

/* ------------------------------------------------------------------ */
/* Markdown Renderer                                                   */
/* ------------------------------------------------------------------ */

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
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
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm">
            {formatInline(line)}
          </p>
        )
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
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/* ------------------------------------------------------------------ */
/* Glass Card Wrapper                                                  */
/* ------------------------------------------------------------------ */

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-[16px] bg-card/75 border border-white/[0.18] rounded-[0.875rem] shadow-md ${className}`}>
      {children}
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
                <Textarea
                  value={editValue}
                  onChange={(e) => onEditChange(e.target.value)}
                  className="text-sm min-h-[80px] bg-background/50"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={onSaveEdit} className="text-xs h-7">
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onCancelEdit} className="text-xs h-7">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p
                className="text-sm text-foreground/80 leading-relaxed cursor-pointer hover:bg-primary/5 rounded-md p-1.5 -m-1.5 transition-colors group"
                onClick={onStartEdit}
                title="Click to edit narration"
              >
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
                  <Badge key={idx} variant="outline" className="text-xs font-normal bg-primary/5 border-primary/20 text-primary">
                    {ing}
                  </Badge>
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

function LibraryCard({
  script,
  onView,
  onDelete,
}: {
  script: GeneratedScript
  onView: () => void
  onDelete: () => void
}) {
  const stepsCount = Array.isArray(script?.script_steps) ? script.script_steps.length : 0
  const createdDate = script?.created_at ? new Date(script.created_at) : null
  const dateStr = createdDate
    ? createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown date'

  return (
    <GlassCard className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20 group cursor-pointer">
      <div
        className="h-36 bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/30 flex items-center justify-center relative"
        onClick={onView}
      >
        <FiFilm className="w-12 h-12 text-primary/40" />
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="text-xs">
            {script?.difficulty_level ?? 'N/A'}
          </Badge>
        </div>
      </div>
      <div className="p-4 space-y-2" onClick={onView}>
        <h3 className="font-semibold text-sm tracking-tight truncate text-card-foreground">{script?.recipe_title ?? 'Untitled'}</h3>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FiClock className="w-3 h-3" />
            {script?.total_duration ?? 'N/A'}
          </span>
          <span>{stepsCount} steps</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{dateStr}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <FiTrash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Loading Skeleton for Script                                         */
/* ------------------------------------------------------------------ */

function ScriptSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <HiOutlineSparkles className="w-4 h-4 text-primary animate-pulse" />
        </div>
        <p className="text-sm text-muted-foreground">Analyzing recipe and generating video script...</p>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="backdrop-blur-[16px] bg-card/75 border border-white/[0.18] rounded-[0.875rem] p-5">
          <div className="flex items-start gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                 */
/* ------------------------------------------------------------------ */

export default function Page() {
  // Navigation
  const [activeView, setActiveView] = useState<'input' | 'library' | 'settings'>('input')

  // Recipe Input
  const [recipeText, setRecipeText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  // Generated Script
  const [currentScript, setCurrentScript] = useState<GeneratedScript | null>(null)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  // Video Generation (simulated)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const [videoGenerated, setVideoGenerated] = useState(false)

  // Library
  const [savedScripts, setSavedScripts] = useState<GeneratedScript[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedScript, setSelectedScript] = useState<GeneratedScript | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Sample Data Toggle
  const [showSampleData, setShowSampleData] = useState(false)

  // Agent Status
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Settings
  const [videoQuality, setVideoQuality] = useState('1080p')
  const [exportFormat, setExportFormat] = useState('mp4')

  // Refs for intervals
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load saved scripts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recipevision_scripts')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setSavedScripts(parsed)
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  // Handle Sample Data Toggle
  useEffect(() => {
    if (showSampleData && !currentScript) {
      setCurrentScript(SAMPLE_SCRIPT)
      setRecipeText(SAMPLE_SCRIPT.original_recipe)
    } else if (!showSampleData && currentScript?.id === 'sample-1') {
      setCurrentScript(null)
      setRecipeText('')
    }
  }, [showSampleData, currentScript])

  // Generate Script Handler
  const handleGenerateScript = useCallback(async () => {
    if (!recipeText.trim()) return
    setIsGenerating(true)
    setGenerationError(null)
    setCurrentScript(null)
    setVideoGenerated(false)
    setVideoProgress(0)
    setActiveAgentId(AGENT_ID)

    try {
      const result: AIAgentResponse = await callAIAgent(
        `Please analyze this recipe and generate a comprehensive video tutorial script:\n\n${recipeText}`,
        AGENT_ID
      )

      if (result.success && result?.response?.result) {
        let data = result.response.result as Record<string, unknown>

        // If result is a string, attempt JSON.parse
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data) as Record<string, unknown>
          } catch {
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
                ingredients_highlighted: Array.isArray(step?.ingredients_highlighted)
                  ? (step.ingredients_highlighted as string[])
                  : [],
                timing_cue: (step?.timing_cue as string) || '',
                technique_notes: (step?.technique_notes as string) || '',
                transition: (step?.transition as string) || '',
              }))
            : [],
          created_at: new Date().toISOString(),
          original_recipe: recipeText,
        }

        setCurrentScript(script)

        // Save to localStorage
        try {
          const existing = JSON.parse(localStorage.getItem('recipevision_scripts') || '[]')
          const updated = Array.isArray(existing) ? [script, ...existing] : [script]
          localStorage.setItem('recipevision_scripts', JSON.stringify(updated))
          setSavedScripts(updated)
        } catch {
          // ignore localStorage errors
        }
      } else {
        setGenerationError(
          (result as { error?: string })?.error || 'Could not process recipe. Please check formatting and try again.'
        )
      }
    } catch {
      setGenerationError('Could not process recipe. Please check formatting and try again.')
    } finally {
      setIsGenerating(false)
      setActiveAgentId(null)
    }
  }, [recipeText])

  // Simulated Video Generation
  const handleGenerateVideo = useCallback(() => {
    setIsGeneratingVideo(true)
    setVideoProgress(0)

    intervalRef.current = setInterval(() => {
      setVideoProgress((prev) => {
        if (prev >= 100) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setIsGeneratingVideo(false)
          setVideoGenerated(true)
          return 100
        }
        return Math.min(prev + Math.random() * 8 + 2, 100)
      })
    }, 300)
  }, [])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Edit step handlers
  const handleStartEdit = useCallback(
    (index: number) => {
      const steps = Array.isArray(currentScript?.script_steps) ? currentScript.script_steps : []
      setEditingStepIndex(index)
      setEditValue(steps[index]?.narration_text ?? '')
    },
    [currentScript]
  )

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

    // Update in localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('recipevision_scripts') || '[]')
      if (Array.isArray(existing)) {
        const updated = existing.map((s: GeneratedScript) => (s.id === updatedScript.id ? updatedScript : s))
        localStorage.setItem('recipevision_scripts', JSON.stringify(updated))
        setSavedScripts(updated)
      }
    } catch {
      // ignore
    }
  }, [editingStepIndex, editValue, currentScript])

  const handleCancelEdit = useCallback(() => {
    setEditingStepIndex(null)
    setEditValue('')
  }, [])

  // Delete from library
  const handleDeleteScript = useCallback(
    (scriptId: string) => {
      const updated = savedScripts.filter((s) => s.id !== scriptId)
      setSavedScripts(updated)
      try {
        localStorage.setItem('recipevision_scripts', JSON.stringify(updated))
      } catch {
        // ignore
      }
    },
    [savedScripts]
  )

  // Filtered library scripts
  const filteredScripts = savedScripts.filter((s) =>
    (s?.recipe_title ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Derived values
  const charCount = recipeText.length
  const currentSteps = Array.isArray(currentScript?.script_steps) ? currentScript.script_steps : []

  /* ------------------------------------------------------------------ */
  /* RENDER: Recipe Input View                                           */
  /* ------------------------------------------------------------------ */

  function renderInputView() {
    return (
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Left Column: Recipe Input */}
        <div className="w-full lg:w-[42%] flex flex-col gap-4">
          <GlassCard className="p-6 flex flex-col gap-4 flex-1">
            <div className="flex items-center gap-2">
              <FiBookOpen className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold tracking-tight text-card-foreground">Recipe Input</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Paste your full recipe below and our AI will generate a comprehensive video tutorial script with narration, scene descriptions, and timing cues.
            </p>
            <div className="relative flex-1 flex flex-col">
              <Textarea
                placeholder="Paste your full recipe here...&#10;&#10;Include the recipe name, ingredients list, and step-by-step instructions for best results."
                value={recipeText}
                onChange={(e) => setRecipeText(e.target.value)}
                className="flex-1 min-h-[240px] resize-none bg-background/50 text-sm leading-relaxed"
              />
              <span className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                {charCount} characters
              </span>
            </div>
            <Button
              onClick={handleGenerateScript}
              disabled={isGenerating || !recipeText.trim()}
              className="w-full gap-2 h-11 text-sm font-medium"
            >
              {isGenerating ? (
                <>
                  <HiOutlineSparkles className="w-4 h-4 animate-spin" />
                  Analyzing Recipe...
                </>
              ) : (
                <>
                  <HiOutlineSparkles className="w-4 h-4" />
                  Generate Video Script
                </>
              )}
            </Button>
            {generationError && (
              <div className="p-3 rounded-[0.875rem] bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {generationError}
              </div>
            )}
          </GlassCard>

          {/* Video Generation Section */}
          {currentScript && currentScript.id !== 'sample-1' && (
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <FiVideo className="w-5 h-5 text-primary" />
                <h3 className="font-semibold tracking-tight text-card-foreground">Video Generation</h3>
              </div>
              {!isGeneratingVideo && !videoGenerated && (
                <Button onClick={handleGenerateVideo} variant="secondary" className="w-full gap-2 h-10 text-sm">
                  <FiPlay className="w-4 h-4" />
                  Generate Video
                </Button>
              )}
              {isGeneratingVideo && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Generating video...</span>
                    <span className="font-medium text-primary">{Math.round(videoProgress)}%</span>
                  </div>
                  <Progress value={videoProgress} className="h-2" />
                </div>
              )}
              {videoGenerated && (
                <div className="space-y-3">
                  <div className="h-44 rounded-[0.875rem] bg-gradient-to-br from-foreground/5 to-foreground/10 border border-border/50 flex flex-col items-center justify-center gap-3">
                    <FiFilm className="w-10 h-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground text-center px-4">
                      Video generation requires an external API (Runway ML, Synthesia, etc.) to be configured.
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Script ready for video production
                  </Badge>
                </div>
              )}
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
                  <Badge variant="outline" className="text-xs font-normal">
                    {currentSteps.length} steps
                  </Badge>
                )}
              </div>
              {currentScript && (
                <div className="flex flex-wrap items-center gap-3 mt-3 mb-2">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">{currentScript.recipe_title}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs font-normal">
                      <FiClock className="mr-1 w-3 h-3" />
                      {currentScript.total_duration}
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {currentScript.difficulty_level}
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-normal">
                      Serves {currentScript.servings}
                    </Badge>
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
                    <p className="font-medium text-card-foreground tracking-tight">No script generated yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Paste a recipe on the left and click &quot;Generate Video Script&quot; to get started.
                    </p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </GlassCard>
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /* RENDER: Video Library View                                          */
  /* ------------------------------------------------------------------ */

  function renderLibraryView() {
    const displayScripts = showSampleData && filteredScripts.length === 0 ? [SAMPLE_SCRIPT] : filteredScripts

    return (
      <div className="space-y-6">
        <GlassCard className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-card-foreground">Video Library</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {savedScripts.length} script{savedScripts.length !== 1 ? 's' : ''} saved
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50 text-sm h-9"
              />
            </div>
          </div>
        </GlassCard>

        {displayScripts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayScripts.map((script) => (
              <LibraryCard
                key={script.id}
                script={script}
                onView={() => {
                  setSelectedScript(script)
                  setShowDetailModal(true)
                }}
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
                <p className="font-medium text-card-foreground tracking-tight">No videos yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Paste a recipe to get started!
                </p>
              </div>
              <Button
                variant="secondary"
                className="gap-2 text-sm"
                onClick={() => setActiveView('input')}
              >
                <FiBookOpen className="w-4 h-4" />
                Go to Recipe Input
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
              <label className="text-sm font-medium text-card-foreground block mb-2">Video Quality Preference</label>
              <div className="flex gap-2">
                {['720p', '1080p', '4K'].map((q) => (
                  <Button
                    key={q}
                    variant={videoQuality === q ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => setVideoQuality(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-card-foreground block mb-2">Default Export Format</label>
              <div className="flex gap-2">
                {['mp4', 'mov', 'webm'].map((f) => (
                  <Button
                    key={f}
                    variant={exportFormat === f ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs uppercase"
                    onClick={() => setExportFormat(f)}
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 space-y-3">
          <h3 className="font-semibold tracking-tight text-card-foreground">About RecipeVision</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            RecipeVision uses AI to transform your written recipes into detailed video tutorial scripts. Each script includes narration text, scene descriptions, ingredient close-ups, timing cues, and technique explanations — everything a video editor or content creator needs to produce professional cooking tutorials.
          </p>
          <p className="text-xs text-muted-foreground">Version 1.0.0</p>
        </GlassCard>

        {/* Agent Status */}
        <GlassCard className="p-6 space-y-3">
          <h3 className="font-semibold tracking-tight text-card-foreground">Agent Status</h3>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeAgentId === AGENT_ID ? 'bg-primary animate-pulse' : 'bg-green-500'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-card-foreground truncate">Recipe Script Agent</p>
              <p className="text-xs text-muted-foreground truncate">
                {activeAgentId === AGENT_ID ? 'Processing...' : 'Ready'} &middot; ID: {AGENT_ID.slice(0, 8)}...
              </p>
            </div>
            <Badge variant={activeAgentId === AGENT_ID ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
              {activeAgentId === AGENT_ID ? 'Active' : 'Idle'}
            </Badge>
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
    { key: 'library', label: 'Video Library', icon: <FiVideo className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <FiSettings className="w-4 h-4" /> },
  ]

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground font-sans">
        {/* Top Header */}
        <header className="sticky top-0 z-30 backdrop-blur-[16px] bg-card/80 border-b border-border/50 shadow-sm">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <FiFilm className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground leading-none">RecipeVision</h1>
                <p className="text-xs text-muted-foreground leading-none mt-0.5">AI Video Tutorial Generator</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Agent Status Indicator (compact) */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${activeAgentId ? 'bg-primary animate-pulse' : 'bg-green-500'}`} />
                <span className="hidden sm:inline">{activeAgentId ? 'Processing' : 'Ready'}</span>
              </div>
              {/* Sample Data Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">Sample Data</span>
                <button
                  onClick={() => setShowSampleData(!showSampleData)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${showSampleData ? 'bg-primary' : 'bg-muted'}`}
                  aria-label="Toggle sample data"
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${showSampleData ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
                  />
                </button>
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
                <span className="truncate">Script Agent: {activeAgentId ? 'Active' : 'Ready'}</span>
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
              <DialogTitle className="tracking-tight">{selectedScript?.recipe_title ?? 'Script Details'}</DialogTitle>
              <DialogDescription className="flex flex-wrap gap-2 pt-1">
                {selectedScript?.total_duration && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    <FiClock className="mr-1 w-3 h-3" />
                    {selectedScript.total_duration}
                  </Badge>
                )}
                {selectedScript?.difficulty_level && (
                  <Badge variant="secondary" className="text-xs font-normal">{selectedScript.difficulty_level}</Badge>
                )}
                {selectedScript?.servings && (
                  <Badge variant="secondary" className="text-xs font-normal">Serves {selectedScript.servings}</Badge>
                )}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4 mt-2">
              <div className="space-y-4">
                {Array.isArray(selectedScript?.script_steps) &&
                  selectedScript.script_steps.map((step, index) => (
                    <div key={step?.step_number ?? index} className="p-4 rounded-[0.875rem] bg-secondary/30 border border-border/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-semibold">
                            {step?.step_number ?? index + 1}
                          </span>
                          <h4 className="font-semibold text-sm tracking-tight">{step?.step_title ?? `Step ${index + 1}`}</h4>
                        </div>
                        {step?.timing_cue && (
                          <Badge variant="outline" className="text-xs font-normal">
                            {step.timing_cue}
                          </Badge>
                        )}
                      </div>
                      {step?.narration_text && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Narration</p>
                          <p className="text-sm text-foreground/80 leading-relaxed">{step.narration_text}</p>
                        </div>
                      )}
                      {step?.scene_description && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Scene</p>
                          <p className="text-sm text-foreground/70 leading-relaxed italic">{step.scene_description}</p>
                        </div>
                      )}
                      {Array.isArray(step?.ingredients_highlighted) && step.ingredients_highlighted.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {step.ingredients_highlighted.map((ing, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs font-normal bg-primary/5 border-primary/20 text-primary">
                              {ing}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {step?.technique_notes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Technique</p>
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
                  ))}

                {/* Original Recipe */}
                {selectedScript?.original_recipe && (
                  <div className="mt-4">
                    <Separator className="mb-4" />
                    <h4 className="font-semibold text-sm tracking-tight mb-2 text-muted-foreground">Original Recipe</h4>
                    <div className="p-4 rounded-[0.875rem] bg-background/50 border border-border/50">
                      {renderMarkdown(selectedScript.original_recipe)}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
              <Button
                variant="secondary"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => {
                  if (selectedScript) {
                    setCurrentScript(selectedScript)
                    setRecipeText(selectedScript.original_recipe ?? '')
                    setActiveView('input')
                    setShowDetailModal(false)
                    setVideoGenerated(false)
                    setVideoProgress(0)
                  }
                }}
              >
                <FiEdit3 className="w-3 h-3" />
                Edit Script
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  )
}
