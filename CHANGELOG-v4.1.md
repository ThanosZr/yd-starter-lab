# v4.1 — Working-surface, waveform and harmonic-FFT corrections

- Dynamic-size power SVG work surface; two-axis scrollbar navigation, mouse/touch drag and zoom preserved. A moved component enlarges the world grid instead of being clipped at the fixed canvas boundary.
- Motor time horizon defaults to 60 s and can be configured from 5 to 600 s; simulation speed can be increased. Preserved motor-history length scales with horizon.
- Multiresolution waveform: overviews show positive/negative peak envelopes and RMS, whereas zooming to <=2.8 s displays the estimated instantaneous three-phase currents. Start/end navigation is available.
- Harmonics are computed with an independent, phase-coherent 1200-samples-per-cycle Fourier projection on up to four source cycles. This reduces sampling-induced spurious harmonics without overriding the user-set physical simulation timestep.
- Interactive spectral DOMES (one per *discrete* Fourier harmonic; not a continuous spectrum), h/Hz and I1%/Irms% axes, zoom, optional hidden fundamental, % labels and selected-harmonic readout.
- Progressive, offline-rendered MathML theory: basic equations and optional advanced harmonic, power, and RL-integration relations.
- Mobile interface: responsive columns, 390-pixel horizontal-overflow check, touch / pinch gestures.

## Numerical model boundaries

The motor uses a quasi-steady per-phase induction-motor model and a mechanical motion integrator, **not a transient electromagnetic EMT solution**. Predicted envelopes are illustrative, not measurements. The rectifiers use ideal lossless diode bridges with zero commutation overlap and a simple R/L load. The discrete Fourier amplitude is computed from simulated current. Rounded domes are only visual glyphs at integer harmonics.

## GitHub Pages

Upload the **contents** of the extracted folder to the repository root. `index.html` is self-contained; the supplied workflow is optional if you already maintain your own GitHub Actions deployment. The PUBLIC variant intentionally has no quiz-bank data.
