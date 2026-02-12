# MixSim — Project Plan

## Overview

**MixSim** is a browser-based digital mixer simulator for audio production education. It gives students a way to practice mixing at home without access to a physical console. The simulator loads multitrack stem recordings and lets the user mix them through a realistic channel strip signal chain, with a "virtual venue" mode that uses convolution reverb and binaural processing to simulate what the mix would sound like through a PA in a real room.

The system is architected with a console-agnostic DSP engine and a skinnable UI layer, so it can simulate the workflow of different digital mixer brands. The first skin models the Behringer X32's workflow and signal flow. Future skins could include the Allen & Heath SQ, Yamaha TF, PreSonus StudioLive, and others. The underlying DSP and signal routing are fundamentally the same across all digital mixers — what differs is the UI layout, workflow conventions, and how routing is presented to the user. This multi-console approach reinforces an important pedagogical point: the core concepts of digital mixing transfer across platforms.

## Target Audience

Audio production students (specifically community college level, e.g., BCST 120 at CCSF). They have some classroom exposure to digital mixers but limited hands-on time. Assume they're using a laptop with headphones.

## Technology Stack

- **Frontend:** React (TypeScript)
- **Audio Engine:** Web Audio API with AudioWorklets for custom DSP
- **UI Rendering:** SVG or Canvas for faders, knobs, and meters
- **MIDI Support:** Web MIDI API for optional physical controller input
- **No backend required** — this is a fully client-side application
- **Build tool:** Vite

## Architecture

The application has five major subsystems. The critical architectural principle is a clean separation between the audio engine and the UI skin, enabling multiple console simulations to share one DSP backend.

### 1. Console Skin System

The UI is decoupled from the audio engine via a skin layer. Each skin defines:
- **Layout:** Where controls are positioned, how many channels are visible at once, whether there's a "selected channel" detail view or an inline processing strip, etc.
- **Workflow:** How the user navigates between channels, accesses EQ/dynamics, manages routing. For example, the X32 uses a "selected channel" paradigm; the Yamaha TF uses a touchscreen-first inline approach.
- **Visual style:** Colors, fonts, control shapes, meter styles — the look and feel of a specific console family.
- **Feature mapping:** Which DSP features are exposed and how. Some consoles hide complexity (Yamaha TF); others expose nearly everything (X32). The same underlying DSP engine is used either way; the skin just controls what's visible.

Skins do NOT define DSP behavior. All audio processing lives in the engine. A skin is purely a UI concern — it reads from and writes to the mixer state store, which the audio engine also subscribes to.

**Initial skin:** Behringer X32 (the most common affordable digital mixer in educational and small venue settings).

**Future skin candidates:**
- Allen & Heath SQ — rotary-encoder-heavy, processing strip on the right
- Yamaha TF — simplified touchscreen-first workflow
- PreSonus StudioLive — "Fat Channel" processing concept
- Midas M32 — nearly identical to X32 but different visual identity

Each skin is a set of React components that conform to a shared interface for reading/writing mixer state. Adding a new skin should be a frontend-only task with zero changes to the audio engine.

### 2. Multitrack Playback Engine
- Load multitrack audio stems (WAV or MP3) from local files or bundled demo tracks
- Each stem feeds one mixer input channel
- Transport controls: play, stop, pause, rewind, loop selection
- All stems stay sample-locked in sync
- Support drag-and-drop loading of stem folders

### 3. Mixing Engine (DSP Graph)
The signal flow per channel is console-agnostic but initially modeled on the X32's signal chain (which is representative of most digital mixers):

```
Input Gain/Trim
  → High-Pass Filter (variable frequency)
  → Gate (threshold, range, attack, hold, release)
  → 4-Band Parametric EQ (low shelf, 2x mid bell, high shelf — each with freq, gain, Q, bypass)
  → Compressor (threshold, ratio, attack, release, knee, makeup gain, auto gain)
  → Pan
  → Channel Fader (–∞ to +10 dB)
  → Mute / Solo
  → Bus Sends (pre/post fader selectable, 6 aux sends)
  → Main Stereo Bus
```

The main bus has:
- Master EQ (6-band parametric)
- Master compressor/limiter
- Master fader
- Metering (peak + RMS)

Bus outputs:
- 6 Aux buses, each with their own fader and output
- Main L/R stereo output

Use Web Audio API built-in nodes where they're adequate (BiquadFilterNode for EQ, GainNode, StereoPannerNode, ConvolverNode). Write custom AudioWorklets for:
- Gate
- Compressor (the built-in DynamicsCompressorNode doesn't expose enough control)
- Metering (peak + RMS with proper ballistics)

### 4. User Interface (X32 Skin — First Implementation)
The initial skin visually resembles the X32's layout and workflow (not a pixel copy, but the same interaction patterns). Refer to the @behringerx32c.png image for an example of the Behringer x32c UI layout. Future skins will follow different layout conventions but share all the same underlying controls and components.

**Main View — Channel Strip Overview:**
- Vertical channel strips arranged side by side (8 visible at a time, with layer buttons to switch between channels 1–8, 9–16, 17–24, 25–32, aux inputs, effects returns, buses, and DCA groups — matching the X32's layer system)
- Each strip shows (top to bottom): channel name/number, input meter, gate/comp indicators, solo button, scribble strip (color-coded label), mute button, fader, aux send levels
- Master section on the right: master fader, master meters (L/R peak + RMS)
- Transport controls along the top or bottom

**Selected Channel Detail View:**
- Clicking/selecting a channel opens a detail panel (like the X32's "Selected Channel" screen)
- Shows the full signal chain for that channel:
  - Input gain knob
  - High-pass filter toggle and frequency knob
  - Gate section with all parameters and gain reduction meter
  - 4-band EQ with frequency response curve visualization
  - Compressor section with all parameters and gain reduction meter
  - Aux send levels (6 knobs)
- EQ curve should be interactive — drag the EQ points on the frequency response graph

**Metering:**
- Per-channel input meters (pre-fader) on each strip
- Per-channel output meters (post-fader)
- Main bus L/R meters with peak hold
- Gain reduction meters for gate and compressor on the selected channel view

**UI Behavior:**
- Faders respond to click-and-drag, mimicking the feel of a motorized fader
- Knobs respond to click-and-drag (rotational or vertical) — no typing in values, just like the real console
- Controls display their current value on the screen/display area when being adjusted (as the X32's LCD does), not as floating tooltips
- The "selected channel" section on the left side of the console (Config/Preamp, Gate, Dynamics, EQ, Bus Sends) should use rotary encoders that match the X32's physical layout
- MIDI learn: right-click → "MIDI Learn" → move a physical control to bind it (this is a simulator addition, not an X32 feature, so it's acceptable as a training aid)

### 5. Virtual Venue Engine (Phase 3)

Process the main stereo output to simulate listening through a PA system in a real room:

**Binaural Speaker Simulation:**
- Use HRTF (Head-Related Transfer Function) processing to place virtual speakers in 3D space
- Model a basic stereo PA: L speaker at roughly –30°, R speaker at +30°, both elevated slightly
- This makes the headphone listener perceive the sound as coming from in front of them rather than inside their head

**Room Simulation:**
- Use ConvolverNode loaded with impulse responses (IRs) from real venues
- Provide preset venues:
  - Small club (200 capacity)
  - Medium concert hall (800 capacity)
  - Church / reverberant space
  - Gymnasium (harsh, reflective)
  - Outdoor stage
- Allow loading custom IRs
- Wet/dry mix control to adjust how much room effect is applied

**Controls:**
- Venue selector dropdown
- Room amount (wet/dry)
- Virtual listener position (near/far, which affects direct-to-reverb ratio)
- On/off toggle to compare with raw mix

## Build Phases

### Phase 1a — Minimal Vertical Slice
**Goal:** Audio playing through a basic mixer in the browser. Prove the core architecture works end-to-end before adding features.

Deliverables:
- Project scaffolding (Vite, React, TypeScript, Zustand store)
- Bundle one demo multitrack — this is the first priority, since nothing else can be tested without audio (Cambridge MT or a simple test recording)
- Multitrack player that loads and syncs 8 audio stems
- Transport controls (play, stop, rewind)
- Basic channel strips: gain knob and fader only
- Main bus with master fader
- Basic peak metering using AnalyserNode (per-channel and master) with direct DOM updates (not React state)
- Simple functional UI layout — no skinning yet, just usable controls in a row. Keep the UI/engine separation clean (state store as contract) but don't formalize a skin interface yet

### Phase 1b — Core Mixing Controls
**Goal:** The mixer is actually useful for mixing — you can shape a basic mix with these controls.

Deliverables:
- Pan per channel (StereoPannerNode)
- Mute per channel
- Solo (AFL) — this requires routing design: solo bus that taps post-fader without affecting the main bus. Design the monitoring signal flow before implementing
- 3-band EQ per channel (low shelf, mid bell, high shelf) using BiquadFilterNode
- Loop selection in transport
- Proper fader law (logarithmic audio taper, 0 dB at ~75% travel)
- Value display on controls when adjusting (like the X32's LCD behavior)

### Phase 1c — X32 Skin & Polish
**Goal:** The mixer looks and feels like an X32, not just a row of generic sliders.

Deliverables:
- X32-style layout: 8 channel strips visible at a time with layer buttons (this is UI chrome only — still 8 actual channels in Phase 1)
- Visual design matching X32 conventions: scribble strips with color coding, channel name/number, gate/comp indicator placeholders, solo/mute button styling
- Faders respond to click-and-drag with realistic feel
- Knobs respond to click-and-drag (vertical or rotational)
- Master section on the right with master fader and L/R meters
- Transport bar styling
- Responsive layout that works well on a laptop screen
- Performance profiling checkpoint: measure CPU usage with 8 channels of EQ + metering active, identify bottlenecks before Phase 2 adds heavier DSP

### Phase 2 — Full Channel Strip
**Goal:** Match X32c channel strip depth.

Deliverables:
- Upgrade EQ to 4-band parametric with interactive frequency response curve
- Add high-pass filter per channel
- Custom AudioWorklet: Gate with full controls and gain reduction metering
- Custom AudioWorklet: Compressor with full controls and gain reduction metering
- 6 aux sends per channel (pre/post selectable)
- 6 aux bus outputs with faders
- Selected Channel detail view with all processing visible
- Drag-and-drop stem loading
- MIDI controller support via Web MIDI API

### Phase 3 — Virtual Venue
**Goal:** Headphone monitoring that simulates a real room.

Deliverables:
- HRTF binaural processing on main output
- ConvolverNode venue simulation with IR presets
- Venue selector and room controls
- Custom IR loading
- A/B toggle for venue on/off

### Phase 4 — Advanced Features
**Goal:** Full training tool with session management.

Deliverables:
- DCA groups (assign multiple channels to a group fader)
- Scene/snapshot save and recall (save full mixer state to JSON)
- Bus groups / subgroups
- Effects rack (at least: reverb send, delay send, chorus)
- Undo/redo for all mixer changes
- Guided tutorials / challenges (e.g., "EQ this vocal to sit in the mix")
- Export mix to WAV

### Phase 5 — Additional Console Skins
**Goal:** Demonstrate the multi-console architecture and broaden the audience.

Deliverables:
- Refine the skin interface/contract based on lessons learned from the X32 skin
- Build a second skin (Allen & Heath SQ or Yamaha TF are the strongest candidates)
- Console selector in the app — switch between skins without reloading
- Ensure all skins share the same underlying mixer state and audio engine
- Document the skin API so others could contribute new skins

## Key Design Principles

1. **Clean room implementation.** This is inspired by the X32's workflow, not a copy of its UI or firmware. Use standard mixing concepts and signal flow.
2. **Console-agnostic engine, skinnable UI.** The audio engine and state store must have zero knowledge of which console skin is active. All console-specific behavior lives in the skin layer. This is the most important architectural constraint.
3. **Education first.** Every control should have a tooltip explaining what it does. Consider a "show signal flow" mode that highlights where the audio is going.
4. **Performance matters.** The audio engine must run glitch-free. Keep the UI rendering efficient — don't re-render the whole mixer on every frame. Use requestAnimationFrame for meters, not React state updates.
5. **Start simple, layer depth.** Phase 1 should be usable and satisfying on its own. Each phase adds depth without breaking what came before.

## File/Folder Structure (Suggested)

```
mixsim/
├── public/
│   ├── stems/              # Demo multitrack stems
│   └── impulse-responses/  # IR files for venue simulation
├── src/
│   ├── audio/
│   │   ├── engine.ts           # Main audio graph setup and routing
│   │   ├── channel.ts          # Per-channel DSP chain
│   │   ├── metering.ts         # Metering utilities
│   │   ├── transport.ts        # Multitrack playback/sync
│   │   └── worklets/
│   │       ├── gate.worklet.ts
│   │       ├── compressor.worklet.ts
│   │       └── meter.worklet.ts
│   ├── midi/
│   │   └── midi-controller.ts  # Web MIDI integration
│   ├── venue/
│   │   ├── binaural.ts         # HRTF processing
│   │   └── room-sim.ts         # Convolution/venue management
│   ├── skins/
│   │   ├── types.ts            # Shared skin interface / contract
│   │   ├── x32/               # Behringer X32 skin (first implementation)
│   │   │   ├── X32Layout.tsx
│   │   │   ├── X32ChannelStrip.tsx
│   │   │   ├── X32SelectedChannel.tsx
│   │   │   ├── X32MasterSection.tsx
│   │   │   └── index.ts
│   │   └── [future-skin]/     # Additional skins follow the same pattern
│   ├── ui/
│   │   ├── components/         # Shared, skin-agnostic UI primitives
│   │   │   ├── Fader.tsx
│   │   │   ├── Knob.tsx
│   │   │   ├── Meter.tsx
│   │   │   ├── EQCurve.tsx
│   │   │   ├── TransportBar.tsx
│   │   │   └── VenueControls.tsx
│   │   └── hooks/
│   │       ├── useAudioEngine.ts
│   │       └── useMidiController.ts
│   ├── state/
│   │   └── mixer-store.ts      # Zustand or similar for mixer state (console-agnostic)
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Notes for Implementation

- **Skin architecture boundary:** The mixer state store is the contract between the audio engine and the UI skin. A skin reads channel parameters (gain, EQ, fader level, etc.) and writes user changes back to the store. The audio engine subscribes to the store and updates its DSP graph. No skin component should ever hold a reference to a Web Audio node. No audio engine code should know which skin is active. If you're tempted to put an `if (skin === 'x32c')` in the engine, the architecture is wrong.
- **Shared vs. skin-specific components:** Low-level controls (Fader, Knob, Meter, EQCurve) should be shared, reusable primitives that all skins compose. Layout components (where the faders go, how the selected channel view works) are skin-specific.
- **Metering performance:** Don't pipe meter values through React state on every animation frame. Use refs or a direct DOM update approach. AnalyserNode.getFloatTimeDomainData() is your friend for efficient metering without worklets; for proper peak/RMS ballistics, a lightweight meter worklet is better.
- **Fader law:** Use a standard audio taper (logarithmic) for faders, not linear. The X32 uses a fader law where 0 dB is at the "U" (unity) mark roughly 75% of the way up.
- **Solo behavior:** Implement AFL (After-Fader Listen) solo as default, matching the X32. Solo should be non-destructive — it controls monitoring, not the main bus.
- **State management:** Keep audio parameter state (gain, eq, etc.) in a centralized store that the audio engine reads from. UI dispatches changes to the store; the audio engine subscribes. Don't tightly couple UI components to audio nodes.
- **Demo stems:** For the bundled demo, look at Cambridge Music Technology's free multitracks (https://www.cambridge-mt.com/ms/mtk/) which are available under Creative Commons for educational use.