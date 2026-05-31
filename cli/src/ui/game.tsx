// Main game shell.
//
// Three regions stacked vertically:
//   - HUD       - name . depth . stamina bar . deepest
//   - Scroll    - append-only line buffer (clipped from the top when long)
//   - Input bar - > prompt, dispatches commands on enter
//
// State lives in a single useReducer (game/reducer.ts). The component
// owns four side effects: persisting the player to save.json on change,
// a 1Hz tick, periodic inscription sync, and graceful exit on /quit.

import { useEffect, useReducer } from "react"
import { useAppContext, useKeyboard, useTerminalDimensions } from "@opentui/react"
import { theme } from "./theme.ts"
import { Hud } from "./hud.tsx"
import { LineView } from "./line-view.tsx"
import { InputBar } from "./input-bar.tsx"
import { PreCombatBar } from "./precombat.tsx"
import { CombatScene } from "./combat-scene.tsx"
import { freshState, reducer, resetPlayer, resumeState } from "../game/reducer.ts"
import { runMark } from "../game/mark.ts"
import { runDeath } from "../game/death.ts"
import { loadSave, writeSave } from "../store/save.ts"
import { loadInscriptions, writeInscriptions } from "../store/inscriptions.ts"
import { clearCombatLock, readCombatLock, writeCombatLock } from "../store/combat-lock.ts"
import { getInscriptions } from "../api/inscriptions.ts"
import type { Account } from "../store/account.ts"
import type { GameState } from "../game/types.ts"

const TICK_MS = 1_000
const SYNC_INTERVAL_MS = 5 * 60 * 1_000

interface GameProps {
  account: Account
}

export function Game({ account }: GameProps) {
  const [state, dispatch] = useReducer(reducer, account, initState)

  // Persist on every player change. Tiny JSON; sync write is fine.
  useEffect(() => writeSave(state.player), [state.player])

  // Cross-session anti-cheese: the lock exists while the player is in
  // pre-combat or in-combat. If the process dies without clearing it,
  // initState surfaces death recovery on the next launch.
  useEffect(() => {
    if (state.phase === "pre_combat" || state.phase === "in_combat") {
      writeCombatLock({ name: account.name, depth: state.player.depth })
    } else {
      clearCombatLock()
    }
  }, [state.phase, account.name, state.player.depth])

  // 1Hz heartbeat for stamina recovery (and later: spawn rolls, ambient).
  useEffect(() => {
    const id = setInterval(() => dispatch({ kind: "tick", now: Date.now() }), TICK_MS)
    return () => clearInterval(id)
  }, [])

  // Inscription sync: pull at launch, then every 5 min. Silent.
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
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Graceful exit on /quit: flush save, destroy the renderer (restores
  // the terminal), then exit.
  const { renderer } = useAppContext()
  useEffect(() => {
    if (!state.quitting) return
    writeSave(state.player)
    renderer?.destroy()
    process.exit(0)
  }, [state.quitting, state.player, renderer])

  // Death: post the marker inscription, then dispatch respawn. If the
  // death came from a force-quit, exit the process after the marker
  // is carved so the player can't bypass the penalty.
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

  // Global Ctrl+C: anti-cheese during pre/in combat (counts as death);
  // a clean quit otherwise. The reducer's forceQuit handler routes it.
  useKeyboard((e) => {
    if (e.name === "c" && e.ctrl) {
      dispatch({ kind: "forceQuit", now: Date.now() })
    }
  })

  function handleInput(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === "/mark" || trimmed.startsWith("/mark ")) {
      void runMark(account, state.player.depth, trimmed, dispatch)
      return
    }
    dispatch({ kind: "command", raw: trimmed, now: Date.now() })
  }

  const { width, height } = useTerminalDimensions()
  // Chrome eats 4 rows in the normal layout (hud + 2 rules + footer)
  // and 0 during a cutscene. Each line takes at most 2 rows (story/
  // ambient have a margin row; system/echo/error are tight). Use the
  // worst case for the slice so the scroll never overflows its box.
  const chromeRows = state.cutscene ? 0 : 4
  const bodyRows = Math.max(1, height - chromeRows)
  const visibleCount = Math.max(1, Math.floor(bodyRows / 2))
  const visible = state.lines.slice(-visibleCount)

  // Cutscene takes over the whole screen: no HUD, no rules, no footer.
  // Same intent as the combat scene, just stricter — even the HUD goes.
  if (state.cutscene) {
    return (
      <box style={{ flexDirection: "column", width: "100%", height: "100%", paddingLeft: 1, paddingRight: 1 }}>
        {visible.map((line) => <LineView key={line.id} line={line} />)}
      </box>
    )
  }

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      <Hud
        name={state.player.name}
        depth={state.player.depth}
        stamina={state.player.stamina}
        maxStamina={state.player.maxStamina}
        deepest={state.player.deepest}
      />
      <Rule width={width} />
      {renderBody()}
    </box>
  )

  // Body swaps between two layouts:
  //   - in combat -> CombatScene takes over (HUD stays above it)
  //   - otherwise -> the scroll buffer + bottom rule + footer
  function renderBody() {
    if (state.phase === "in_combat" && state.combat) {
      return (
        <CombatScene
          combat={state.combat}
          onStrike={() => dispatch({ kind: "strike", now: Date.now() })}
          onBrace={() => dispatch({ kind: "brace", now: Date.now() })}
          onEscape={() => dispatch({ kind: "escape", now: Date.now() })}
        />
      )
    }
    return (
      <box style={{ flexDirection: "column", flexGrow: 1, width: "100%", overflow: "hidden" }}>
        <box style={{ flexGrow: 1, flexShrink: 1, flexDirection: "column", paddingLeft: 1, paddingRight: 1, overflow: "hidden" }}>
          {visible.map((line) => <LineView key={line.id} line={line} />)}
        </box>
        <Rule width={width} />
        {renderFooter()}
      </box>
    )
  }

  // The bottom row depends on what the player can do right now:
  //   - cutscene playing  -> nothing (the script reveals at its own pace)
  //   - pre-combat       -> F/E keys + draining countdown bar
  //   - exploring        -> the > input prompt
  function renderFooter() {
    if (state.cutscene) return null
    if (state.phase === "pre_combat" && state.encounter) {
      return (
        <PreCombatBar
          startedAt={state.encounter.startedAt}
          onEngage={() => dispatch({ kind: "engage", now: Date.now() })}
          onEscape={() => dispatch({ kind: "escape", now: Date.now() })}
        />
      )
    }
    return <InputBar onSubmit={handleInput} />
  }
}

function Rule({ width }: { width: number }) {
  return <text fg={theme.rule} style={{ flexShrink: 0 }}>{"─".repeat(Math.max(0, width))}</text>
}

// Initial reducer state. Three paths, in priority order:
//   1. A stale combat lock means the player force-quit mid-fight. Boot
//      into death-recovery: a reset player + pendingDeath, so the normal
//      death pipeline carves the marker and the player wakes at depth 1.
//   2. A saved player matches the logged-in account: resume them.
//   3. Otherwise: fresh state for a new character.
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
  // The saved player may predate seenOpening — default it to true so the
  // recovery path doesn't surprise a returning player with the opening.
  const safe = { ...saved, seenOpening: saved.seenOpening ?? true }
  // Use resumeState as the base so we don't accidentally requeue the
  // opening cutscene (freshState would).
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
