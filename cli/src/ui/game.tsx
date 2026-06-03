// Top-level game shell.
//
// Owns the reducer state and all side effects (save, sync, exit, death,
// combat-lock). Renders one of three layouts based on state:
//
//   - state.cutscene set      -> CutsceneLayout
//   - phase === "in_combat"   -> CombatLayout
//   - otherwise               -> MainLayout
//
// The layouts in layouts.tsx are pure functions of their props. This
// file is where impure things happen: dispatching, persisting, killing
// the renderer, exiting the process.

import { useEffect, useReducer } from "react"
import { useAppContext, useKeyboard, useTerminalDimensions } from "@opentui/react"
import { freshState, reducer, resetPlayer, resumeState } from "../game/reducer.ts"
import { runMark } from "../game/mark.ts"
import { runDeath } from "../game/death.ts"
import { loadSave, writeSave } from "../store/save.ts"
import { loadInscriptions, writeInscriptions } from "../store/inscriptions.ts"
import { clearCombatLock, readCombatLock, writeCombatLock } from "../store/combat-lock.ts"
import { getInscriptions } from "../api/inscriptions.ts"
import { CombatLayout, MainLayout } from "./layouts.tsx"
import type { Account } from "../store/account.ts"
import type { GameState } from "../game/types.ts"

const TICK_MS = 1_000
const SYNC_INTERVAL_MS = 5 * 60 * 1_000

export function Game({ account }: { account: Account }) {
  const [state, dispatch] = useReducer(reducer, account, initState)
  const { renderer } = useAppContext()
  const { width, height } = useTerminalDimensions()

  // ---- Side effects ----------------------------------------------------

  // Persist on every player change.
  useEffect(() => writeSave(state.player), [state.player])

  // 1Hz tick drives stamina, encounter rolls, cutscene draining, etc.
  useEffect(() => {
    const id = setInterval(() => dispatch({ kind: "tick", now: Date.now() }), TICK_MS)
    return () => clearInterval(id)
  }, [])

  // Pull inscriptions at launch + every 5 min. Silent.
  useEffect(() => {
    let cancelled = false
    async function sync() {
      const result = await getInscriptions()
      if (cancelled || !result.ok) return
      dispatch({ kind: "setInscriptions", list: result.data })
      writeInscriptions(result.data)
    }
    void sync()
    const id = setInterval(() => void sync(), SYNC_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Cross-session anti-cheese: lock file mirrors combat phase so a crash
  // mid-fight surfaces death recovery on the next launch.
  useEffect(() => {
    if (state.phase === "pre_combat" || state.phase === "in_combat") {
      writeCombatLock({ name: account.name, depth: state.player.depth })
    } else {
      clearCombatLock()
    }
  }, [state.phase, account.name, state.player.depth])

  // Clean exit on /quit.
  useEffect(() => {
    if (!state.quitting) return
    writeSave(state.player)
    renderer?.destroy()
    process.exit(0)
  }, [state.quitting, state.player, renderer])

  // Death: post the marker, dispatch respawn. Exit after if force-quit.
  useEffect(() => {
    if (!state.pendingDeath) return
    const { depth, thenQuit } = state.pendingDeath
    void (async () => {
      await runDeath(account, depth, state.player, dispatch)
      if (thenQuit) {
        renderer?.destroy()
        process.exit(0)
      }
    })()
  }, [state.pendingDeath, account, renderer])

  // Global Ctrl+C — routes through the reducer's forceQuit handler.
  useKeyboard((e) => {
    if (e.name === "c" && e.ctrl) {
      dispatch({ kind: "forceQuit", now: Date.now() })
    }
  })

  // ---- Input -----------------------------------------------------------

  function handleInput(raw: string) {
    const trimmed = raw.trim()
    // /mark hits the network — handled outside the reducer.
    if (trimmed === "/mark" || trimmed.startsWith("/mark ")) {
      void runMark(account, state.player.depth, trimmed, dispatch)
      return
    }
    dispatch({ kind: "command", raw: trimmed, now: Date.now() })
  }

  // ---- Layout dispatch -------------------------------------------------

  if (state.phase === "in_combat" && state.combat) {
    return (
      <CombatLayout
        combat={state.combat}
        player={state.player}
        width={width}
        onStrike={() => dispatch({ kind: "strike", now: Date.now() })}
        onBrace={() => dispatch({ kind: "brace", now: Date.now() })}
        onEscape={() => dispatch({ kind: "escape", now: Date.now() })}
      />
    )
  }

  // Everything else — including narration playback and pre-combat —
  // goes through the main layout. Chrome eats 4 rows (HUD + 2 rules +
  // footer). Story lines are at most 2 rows each so divide.
  const visibleCount = Math.max(1, Math.floor((height - 4) / 2))
  return (
    <MainLayout
      state={state}
      width={width}
      visibleCount={visibleCount}
      onInput={handleInput}
      onEngage={() => dispatch({ kind: "engage", now: Date.now() })}
      onEscape={() => dispatch({ kind: "escape", now: Date.now() })}
    />
  )
}

// ---- Initial state ------------------------------------------------------
//
// Three paths in priority order:
//   1. A stale combat lock means the player force-quit mid-fight last
//      session. Boot into death-recovery: the existing pendingDeath
//      pipeline carves the marker and the player wakes at depth 1.
//   2. A saved player matches the logged-in account: resume.
//   3. Otherwise: fresh character (kicks off the opening cutscene).

function initState(account: Account): GameState {
  const inscriptions = loadInscriptions()
  const saved = loadSave()
  const lock = readCombatLock()

  if (lock && saved && lock.name === account.name) {
    clearCombatLock()
    return recoverFromForceQuit(account, saved, lock.depth, inscriptions)
  }
  if (saved && saved.name === account.name) {
    return resumeState(saved, inscriptions)
  }
  return freshState(account.name, inscriptions)
}

function recoverFromForceQuit(
  account: Account,
  saved: NonNullable<ReturnType<typeof loadSave>>,
  deathDepth: number,
  inscriptions: ReturnType<typeof loadInscriptions>,
): GameState {
  // Don't requeue the opening for a returning player; resumeState is
  // the right base. The pendingDeath flow handles the marker carve.
  const safe = { ...saved, seenOpening: saved.seenOpening ?? true }
  const base = resumeState(safe, inscriptions)
  return {
    ...base,
    player: resetPlayer(account.name, safe),
    pendingDeath: { depth: deathDepth, thenQuit: false },
    lines: [
      { id: 0, style: "story", text: "the dark took you." },
      { id: 1, style: "system", text: "you wake at depth 1." },
    ],
    nextLineId: 2,
  }
}
