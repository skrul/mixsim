import { useEffect, useRef, useState } from 'react'
import { meterLevels } from '@/audio/metering'
import { useMixerStore } from '@/state/mixer-store'
import { DisplayHomeScreen } from './DisplayHomeScreen'
import styles from './ControlPanel.module.css'

const DISPLAY_MENU = [
  'HOME',
  'METERS',
  'ROUTING',
  'SETUP',
  'LIBRARY',
  'EFFECTS',
  'MUTE GRP',
  'UTILITY',
] as const

type DisplayMenuKey = typeof DISPLAY_MENU[number]

const METER_MARKS = [
  'CLIP',
  '-1',
  '-2',
  '-3',
  '-4',
  '-6',
  '-8',
  '-10',
  '-12',
  '-15',
  '-18',
  '-21',
  '-24',
  '-27',
  '-30',
  '-33',
  '-36',
  '-39',
  '-42',
  '-45',
  '-48',
  '-51',
  '-54',
  '-57',
]

const METER_ROWS = METER_MARKS.length
const CLIP_LED_THRESHOLD_DB = -1
const DISPLAY_METER_TRIM_DB = 4
const METER_THRESHOLDS = METER_MARKS.map((mark) =>
  mark === 'CLIP' ? CLIP_LED_THRESHOLD_DB : Number.parseFloat(mark)
)

interface DisplayMeterLevels {
  mcSolo: number
  left: number
  right: number
}

function dbToLitRows(db: number): number {
  if (!Number.isFinite(db)) return 0
  let lit = 0
  for (let i = 0; i < METER_THRESHOLDS.length; i++) {
    if (db >= METER_THRESHOLDS[i]) lit++
  }
  return lit
}

function ledToneClass(index: number): string {
  if (index === 0) return styles.clip
  const db = METER_THRESHOLDS[index]
  if (db > -21) return styles.warm
  return styles.cool
}

export function ControlPanel() {
  const soloActive = useMixerStore((state) => state.soloActive)
  const [activePage, setActivePage] = useState<DisplayMenuKey>('HOME')
  const [displayMeters, setDisplayMeters] = useState<DisplayMeterLevels>({
    mcSolo: 0,
    left: 0,
    right: 0,
  })
  const displayDbRef = useRef({ mcSolo: -Infinity, left: -Infinity, right: -Infinity })
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const targetMcSolo = (soloActive ? meterLevels.solo : meterLevels.mono) + DISPLAY_METER_TRIM_DB
      const targetL = meterLevels.masterL + DISPLAY_METER_TRIM_DB
      const targetR = meterLevels.masterR + DISPLAY_METER_TRIM_DB

      const next = { ...displayDbRef.current }

      const applyBallistics = (current: number, target: number): number => {
        if (target > current) return target
        const decayed = current - 1.5
        return Math.max(decayed, target)
      }

      next.mcSolo = applyBallistics(next.mcSolo, targetMcSolo)
      next.left = applyBallistics(next.left, targetL)
      next.right = applyBallistics(next.right, targetR)
      displayDbRef.current = next

      const nextRows = {
        mcSolo: dbToLitRows(next.mcSolo),
        left: dbToLitRows(next.left),
        right: dbToLitRows(next.right),
      }

      setDisplayMeters((prev) =>
        prev.mcSolo === nextRows.mcSolo &&
        prev.left === nextRows.left &&
        prev.right === nextRows.right
          ? prev
          : nextRows
      )

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [soloActive])

  return (
    <div className={styles.panel}>
      <div className={styles.displayPanel}>
        <div className={styles.displayTop}>
          <div className={styles.screenOuter}>
            <div className={styles.screen}>
              {activePage === 'HOME' ? (
                <DisplayHomeScreen />
              ) : (
                <div className={styles.notImplementedScreen}>
                  <div className={styles.notImplementedTitle}>{activePage}</div>
                  <div className={styles.notImplementedBody}>Read-only HOME page is implemented first.</div>
                </div>
              )}
            </div>
            <div className={styles.meterRail}>
              <div className={styles.meterBody}>
                <div className={styles.meterColumn}>
                  {Array.from({ length: METER_ROWS }, (_, i) => (
                    <div
                      key={`mc-${i}`}
                      className={`${styles.meterLed} ${ledToneClass(i)} ${i < METER_ROWS - displayMeters.mcSolo ? styles.off : ''}`}
                    />
                  ))}
                </div>
                <div className={styles.meterScale}>
                  {METER_MARKS.map((label) => (
                    <div key={label} className={styles.meterMark}>{label}</div>
                  ))}
                </div>
                <div className={styles.meterColumn}>
                  {Array.from({ length: METER_ROWS }, (_, i) => (
                    <div
                      key={`l-${i}`}
                      className={`${styles.meterLed} ${ledToneClass(i)} ${i < METER_ROWS - displayMeters.left ? styles.off : ''}`}
                    />
                  ))}
                </div>
                <div className={styles.meterColumn}>
                  {Array.from({ length: METER_ROWS }, (_, i) => (
                    <div
                      key={`r-${i}`}
                      className={`${styles.meterLed} ${ledToneClass(i)} ${i < METER_ROWS - displayMeters.right ? styles.off : ''}`}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.meterFoot}>
                <span className={styles.mcSoloLabel}>M/C<br />SOLO</span>
                <span aria-hidden="true" />
                <span>L</span>
                <span>R</span>
              </div>
            </div>
          </div>

          <div className={styles.sideColumn}>
            <div className={styles.sideMenu}>
              {DISPLAY_MENU.map((label) => (
                <button
                  key={label}
                  className={`${styles.menuButton} ${activePage === label ? styles.menuButtonActive : ''}`}
                  onClick={() => setActivePage(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.navCluster}>
              <div className={styles.navBlock}>
                <div className={styles.navLabel}>LAYER</div>
                <div className={styles.layerButtons}>
                  <button className={styles.navButton} disabled aria-label="Layer up">▲</button>
                  <button className={styles.navButton} disabled aria-label="Layer down">▼</button>
                </div>
              </div>

              <div className={styles.navBlock}>
                <div className={styles.navLabel}>PAGE SELECT</div>
                <div className={styles.pageButtons}>
                  <button className={styles.navButton} disabled aria-label="Page left">◀</button>
                  <button className={styles.navButton} disabled aria-label="Page right">▶</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.displayBottom}>
          <div className={styles.encoders}>
            {Array.from({ length: 6 }, (_, i) => (
              <button key={i} className={styles.encoder} disabled aria-label={`Encoder ${i + 1}`}>
                <span className={styles.encoderCap} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
