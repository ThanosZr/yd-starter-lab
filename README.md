# MULTI-LAB v4.1 — PUBLIC

**Static offline interactive laboratory** for engineering students. Includes Star–Delta Motor Starter and Single/Three Phase Diode Rectifier labs. No quizzes and no answer banks are included.

## Quick start

- Open `index.html` or `standalone.html` by double-clicking. No internet, server, Node.js, or package install is required.
- GitHub Pages: upload the content of this ZIP into the repository root, including `.github/workflows/deploy.yml`. In Settings → Pages choose GitHub Actions. The workflow deploys on push to `main`. If a conflicting Pages workflow exists, keep only one.
- Make sure `index.html` is at the root.

## Using the oscilloscope (desktop and phone)

- **X+ / X−** change horizontal (time) scale; **Y+ / Y−** vertical (amplitude) scale. **⌖** resets; **⛶** expands the graph.
- **Mouse wheel** horizontally zooms; **Shift + wheel** zooms vertical axis; **drag** pans the graph.
- **Phone**: **one-finger drag pans**, **two-finger pinch zooms**, and the accessible 44px buttons work for axis-specific scaling. The mobile layout stacks circuit, instrumentation, and oscilloscope rather than squeezing desktop side-by-side.
- The power diagram expands to the right/down automatically and has X/Y scrollbars. Motor scope defaults to 60 s, with an adaptive RMS/peak-envelope overview and phase sinusoids when zoomed to 2.8 s or less. The motor model is a quasi-steady induction-motor per-phase approximation coupled to a simple mechanical integration; tau_e and tau_m estimates are model estimates, NOT measured physical transients.

## Rectifier lab from NTUA Lab A (2022 v9)

- Single-phase full-wave bridge: defaults Vs=50 V RMS, 50 Hz, R=50 Ω, L=0 H; R-L laboratory preset 600 mH.
- Three-phase six-pulse bridge: defaults Vab=50 V RMS (line-line), 50 Hz, R=50 Ω, L=0 H; R-L laboratory preset 450 mH.
- Optional L→∞ idealized constant-current steady state; timestep editable with sample count bounded for phone performance.
- Actual time-stepped exponential integration of RL current; diode conduction pairs and input current computed from the ideal bridge. No commutation overlap, diode drops, source impedance, or failure currents are solved.
- A coherent 1200 samples/cycle Fourier analysis is used to reduce switching-discretization artifacts. The last up to four cycles used for RMS, harmonic projections, THD, PF, cosφ₁, P, Q₁, S, and D.
- Pause, play, step, scrub time, scopes, CSV waveform export, discrete spectral lobes (% of I1 or Irms, h or Hz), progressive MathML formulas, and quiz only when enabled.

## Safety

Unofficial independent educational software, not endorsed by NTUA; not a certified protection-sizing tool or a replacement for laboratory supervision. Never manipulate live circuits based on the visual simulation alone.

## Source layout

- `src/engine/topology.js` power-circuit topology
- `src/engine/motor-dynamics.js` approximation of induction motor characteristics
- `src/oscilloscope.js` interactive chart component
- `src/engine/rectifier.js` ideal bridge simulation and harmonic analysis
- `src/rectifier-ui.js` React rectifier module
- `src/main.js` React UI for YD lab

The ready-to-publish `index.html` embeds scripts and styling and works offline.
