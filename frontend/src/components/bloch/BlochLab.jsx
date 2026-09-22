import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eraser, Orbit, Redo2, RotateCcw, Undo2 } from 'lucide-react'

import { useBlochState } from '../../hooks/useBlochState'
import { fidelity, KET } from '../../quantum/bloch'
import BlochSphere3D from './BlochSphere3D'
import ChallengePanel from './ChallengePanel'
import DecoherencePanel from './DecoherencePanel'
import GatePad from './GatePad'
import MeasurePanel from './MeasurePanel'
import StateInspector from './StateInspector'
import { SOLVED_KEY } from './challenges'
import { Panel } from './ui'

function readSolved() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SOLVED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

const CHIP = {
  gate: 'border-signal-cyan/30 text-signal-cyan',
  prep: 'border-slate-600 text-slate-300',
  measure: 'border-signal-violet/40 text-signal-violet',
  relax: 'border-signal-amber/40 text-signal-amber',
}

/**
 * One qubit, fully explorable: every gate animates as its true rotation, the
 * inspector shows every representation of the state, and measurement and
 * decoherence show the two ways a real qubit stops being a clean arrow.
 */
export default function BlochLab() {
  const bloch = useBlochState(KET.zero)
  const { vec, display, trail, timeline, cursor } = bloch
  const [showTrail, setShowTrail] = useState(true)
  const [axisPreview, setAxisPreview] = useState(null)
  const [challenge, setChallenge] = useState(null)
  const [solved, setSolved] = useState(readSolved)

  const gatesUsed = useMemo(
    () => timeline.slice(1, cursor + 1).filter((e) => e.kind === 'gate').length,
    [timeline, cursor],
  )

  const onGate = useCallback((label, U) => bloch.applyGate(label, U), [bloch])

  const startChallenge = (c) => {
    setChallenge(c)
    bloch.reset(c.start ?? KET.zero)
  }

  // Record a solve the moment it happens, not when the user clicks "Next".
  useEffect(() => {
    if (!challenge || solved.has(challenge.id)) return
    if (fidelity(vec, challenge.target) >= 0.995 && gatesUsed <= challenge.budget && gatesUsed > 0) {
      const next = new Set(solved).add(challenge.id)
      setSolved(next)
      try {
        localStorage.setItem(SOLVED_KEY, JSON.stringify([...next]))
      } catch {
        /* progress simply will not persist */
      }
    }
  }, [vec, challenge, gatesUsed, solved])

  const ghost = challenge?.target ?? axisPreview

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-7">
        <Panel
          title="Bloch sphere"
          icon={Orbit}
          bodyClassName="p-0"
          actions={
            <>
              <IconButton label="Undo" onClick={bloch.undo} disabled={!bloch.canUndo} icon={Undo2} />
              <IconButton label="Redo" onClick={bloch.redo} disabled={!bloch.canRedo} icon={Redo2} />
              <IconButton
                label={showTrail ? 'Hide trail' : 'Show trail'}
                onClick={() => (showTrail ? setShowTrail(false) : (bloch.clearTrail(), setShowTrail(true)))}
                icon={Eraser}
                active={showTrail}
              />
              <IconButton label="Reset" onClick={() => bloch.reset(challenge?.start ?? KET.zero)} icon={RotateCcw} />
            </>
          }
        >
          <div className="relative">
            <BlochSphere3D
              vector={display}
              ghost={ghost}
              trail={showTrail ? trail : null}
              className="h-[380px] w-full cursor-grab active:cursor-grabbing sm:h-[460px]"
            />
            <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-slate-600">
              drag to orbit · {ghost ? (challenge ? 'violet = target' : 'violet = rotation axis n̂') : 'arrow = your qubit'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-lab-700/70 px-4 py-3">
            <span className="mr-1 text-[10px] uppercase tracking-wider text-slate-500">History</span>
            {timeline.map((entry, i) => (
              <span
                key={i}
                className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
                  i === 0 ? 'border-lab-700 text-slate-500' : CHIP[entry.kind]
                } ${i > cursor ? 'opacity-30' : ''} ${i === cursor ? 'ring-1 ring-slate-400/40' : ''}`}
              >
                {entry.label}
              </span>
            ))}
          </div>
        </Panel>

        <ChallengePanel
          active={challenge}
          vec={vec}
          gatesUsed={gatesUsed}
          solved={solved}
          onStart={startChallenge}
          onExit={() => {
            setChallenge(null)
            bloch.reset(KET.zero)
          }}
        />
      </div>

      <div className="space-y-5 xl:col-span-5">
        <GatePad
          onGate={onGate}
          onPrepare={(label, v) => bloch.setVector(label, v, 'prep')}
          onAxisPreview={setAxisPreview}
          allowed={challenge?.allowed ?? null}
          lockPrep={Boolean(challenge)}
        />
        <StateInspector vec={vec} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:col-span-12">
        <MeasurePanel vec={vec} onCollapse={(label, v) => bloch.setVector(label, v, 'measure')} disabled={Boolean(challenge)} />
        <DecoherencePanel vec={vec} onIdle={(label, v) => bloch.setVector(label, v, 'relax')} disabled={Boolean(challenge)} />
      </div>
    </div>
  )
}

function IconButton({ label, onClick, disabled, icon: Icon, active }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1 transition-colors hover:text-slate-200 disabled:opacity-30 ${active ? 'text-signal-cyan' : 'text-slate-500'}`}
    >
      <Icon size={14} />
    </button>
  )
}
