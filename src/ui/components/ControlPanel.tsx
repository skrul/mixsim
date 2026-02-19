import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
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
const METER_THRESHOLDS = METER_MARKS.map((mark) =>
  mark === 'CLIP' ? CLIP_LED_THRESHOLD_DB : Number.parseFloat(mark)
)
const DISPLAY_CONTENT_WIDTH = 704
const DISPLAY_CONTENT_HEIGHT = 348
const DISPLAY_POPUP_BODY_PADDING = 8
const DISPLAY_POPUP_HEADER_HEIGHT = 34
const DISPLAY_POPUP_FRAME_PADDING = DISPLAY_POPUP_BODY_PADDING * 2
const DISPLAY_POPUP_MIN_SCALE = 1
const DISPLAY_POPUP_MAX_SCALE = 2.4

interface DisplayMeterLevels {
  mcSolo: number
  left: number
  right: number
}

interface PopupRect {
  x: number
  y: number
  width: number
  height: number
}

interface PopupInteraction {
  type: 'drag' | 'resize'
  startX: number
  startY: number
  startRect: PopupRect
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function ControlPanel() {
  const soloActive = useMixerStore((state) => state.soloActive)
  const [activePage, setActivePage] = useState<DisplayMenuKey>('HOME')
  const [displayPopupOpen, setDisplayPopupOpen] = useState(false)
  const [popupRect, setPopupRect] = useState<PopupRect>({
    x: 72,
    y: 72,
    width: 960,
    height: 540,
  })
  const [displayMeters, setDisplayMeters] = useState<DisplayMeterLevels>({
    mcSolo: 0,
    left: 0,
    right: 0,
  })
  const displayDbRef = useRef({ mcSolo: -Infinity, left: -Infinity, right: -Infinity })
  const rafRef = useRef<number | null>(null)
  const popupInteractionRef = useRef<PopupInteraction | null>(null)

  const scaleToRect = (scale: number): Pick<PopupRect, 'width' | 'height'> => ({
    width: DISPLAY_CONTENT_WIDTH * scale + DISPLAY_POPUP_FRAME_PADDING,
    height: DISPLAY_POPUP_HEADER_HEIGHT + DISPLAY_CONTENT_HEIGHT * scale + DISPLAY_POPUP_FRAME_PADDING,
  })

  const popupScale = clamp(
    (popupRect.width - DISPLAY_POPUP_FRAME_PADDING) / DISPLAY_CONTENT_WIDTH,
    DISPLAY_POPUP_MIN_SCALE,
    DISPLAY_POPUP_MAX_SCALE
  )

  useEffect(() => {
    const tick = () => {
      const targetMcSolo = soloActive ? meterLevels.solo : meterLevels.mono
      const targetL = meterLevels.masterL
      const targetR = meterLevels.masterR

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

  const renderDisplayScreen = () => (
    activePage === 'HOME' ? (
      <DisplayHomeScreen />
    ) : (
      <div className={styles.notImplementedScreen}>
        <div className={styles.notImplementedTitle}>{activePage}</div>
        <div className={styles.notImplementedBody}>Read-only HOME page is implemented first.</div>
      </div>
    )
  )

  const startPopupDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    popupInteractionRef.current = {
      type: 'drag',
      startX: event.clientX,
      startY: event.clientY,
      startRect: popupRect,
    }
  }

  const startPopupResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    popupInteractionRef.current = {
      type: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      startRect: popupRect,
    }
  }

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const interaction = popupInteractionRef.current
      if (!interaction) return

      const dx = event.clientX - interaction.startX
      const dy = event.clientY - interaction.startY

      if (interaction.type === 'drag') {
        const nextX = Math.max(8, Math.min(window.innerWidth - interaction.startRect.width - 8, interaction.startRect.x + dx))
        const nextY = Math.max(8, Math.min(window.innerHeight - interaction.startRect.height - 8, interaction.startRect.y + dy))
        setPopupRect((prev) => (
          prev.x === nextX && prev.y === nextY ? prev : { ...prev, x: nextX, y: nextY }
        ))
        return
      }

      const maxScaleByWidth = (window.innerWidth - interaction.startRect.x - 8 - DISPLAY_POPUP_FRAME_PADDING) / DISPLAY_CONTENT_WIDTH
      const maxScaleByHeight = (
        window.innerHeight - interaction.startRect.y - 8 - DISPLAY_POPUP_HEADER_HEIGHT - DISPLAY_POPUP_FRAME_PADDING
      ) / DISPLAY_CONTENT_HEIGHT
      const maxScale = Math.max(DISPLAY_POPUP_MIN_SCALE, Math.min(DISPLAY_POPUP_MAX_SCALE, maxScaleByWidth, maxScaleByHeight))
      const targetScale = clamp(
        (interaction.startRect.width + dx - DISPLAY_POPUP_FRAME_PADDING) / DISPLAY_CONTENT_WIDTH,
        DISPLAY_POPUP_MIN_SCALE,
        maxScale
      )
      const nextRect = scaleToRect(targetScale)
      setPopupRect((prev) => (
        prev.width === nextRect.width && prev.height === nextRect.height
          ? prev
          : { ...prev, width: nextRect.width, height: nextRect.height }
      ))
    }

    const onMouseUp = () => {
      popupInteractionRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const openDisplayPopup = () => {
    const maxScaleByWidth = (window.innerWidth - 16 - DISPLAY_POPUP_FRAME_PADDING) / DISPLAY_CONTENT_WIDTH
    const maxScaleByHeight = (
      window.innerHeight - 16 - DISPLAY_POPUP_HEADER_HEIGHT - DISPLAY_POPUP_FRAME_PADDING
    ) / DISPLAY_CONTENT_HEIGHT
    const targetScale = clamp(Math.min(1.5, maxScaleByWidth, maxScaleByHeight), DISPLAY_POPUP_MIN_SCALE, DISPLAY_POPUP_MAX_SCALE)
    const nextSize = scaleToRect(targetScale)
    setPopupRect((prev) => ({
      x: clamp(prev.x, 8, Math.max(8, window.innerWidth - nextSize.width - 8)),
      y: clamp(prev.y, 8, Math.max(8, window.innerHeight - nextSize.height - 8)),
      width: nextSize.width,
      height: nextSize.height,
    }))
    setDisplayPopupOpen(true)
  }

  const renderDisplayConsole = (dimmed = false) => (
    <div className={`${styles.displayPanel} ${dimmed ? styles.displayPanelDimmed : ''}`}>
      <div className={styles.displayTop}>
        <div className={styles.screenOuter}>
          <div className={styles.screen}>
            {renderDisplayScreen()}
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
            <button
              className={styles.inlinePopoutButton}
              onClick={openDisplayPopup}
              disabled={displayPopupOpen}
            >
              POP OUT
            </button>
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
  )

  return (
    <div className={styles.panel}>
      {renderDisplayConsole(displayPopupOpen)}
      {displayPopupOpen && (
        <div
          className={styles.displayPopupWindow}
          style={{
            left: `${popupRect.x}px`,
            top: `${popupRect.y}px`,
            width: `${popupRect.width}px`,
            height: `${popupRect.height}px`,
          }}
        >
          <div className={styles.displayPopupHeader} onMouseDown={startPopupDrag}>
            <div className={styles.displayPopupTitle}>DISPLAY</div>
            <button
              className={styles.displayPopupClose}
              onClick={() => {
                setDisplayPopupOpen(false)
                popupInteractionRef.current = null
              }}
            >
              CLOSE
            </button>
          </div>
          <div className={styles.displayPopupBody}>
            <div
              className={styles.displayPopupScaledBox}
              style={{
                width: `${DISPLAY_CONTENT_WIDTH * popupScale}px`,
                height: `${DISPLAY_CONTENT_HEIGHT * popupScale}px`,
              }}
            >
              <div
                className={styles.displayPopupScaledContent}
                style={{
                  width: `${DISPLAY_CONTENT_WIDTH}px`,
                  height: `${DISPLAY_CONTENT_HEIGHT}px`,
                  transform: `scale(${popupScale})`,
                }}
              >
                {renderDisplayConsole(false)}
              </div>
            </div>
          </div>
          <div className={styles.displayPopupResizeHandle} onMouseDown={startPopupResize} />
        </div>
      )}
    </div>
  )
}
