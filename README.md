# MULTI-LAB v4.4 — PUBLIC

**Static offline interactive laboratory** for engineering students. Includes Star–Delta Motor Starter and Single/Three Phase Diode Rectifier labs. PUBLIC: χωρίς ερωτήσεις. FULL: 36 ερωτήσεις Υ/Δ και 12 ερωτήσεις ανορθωτών, με επιλογές και εξηγήσεις.

## Quick start

- Open `index.html` or `standalone.html` by double-clicking. No internet, server, Node.js, or package install is required.
- Existing GitHub Pages repository: keep its current publishing branch and deployment workflow. Update the application files in a separate branch, then open a PR targeting the publishing branch and merge it there.
- New repository: the included `.github/workflows/deploy.yml` is an example for publishing from `main` using GitHub Actions.
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
- A coherent 1200 samples/cycle Fourier analysis is used to reduce switching-discretization artifacts. An independent periodic solution supplies RMS, harmonics, THD, PF, cosφ₁, P, Q₁, S, S₁ and D, even when the startup trace has not settled.
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

## Διορθωμένο μοντέλο κινητήρα

Δείτε το [MOTOR-MODEL.md](MOTOR-MODEL.md) για τάσεις πινακίδας, κοινό Zin(s), ρεύματα γραμμής/τυλίγματος, ροπή, παραδοχές και όρια ακρίβειας. Οι νέες ρυθμίσεις είναι και στην καρτέλα «Κυματομορφές & ροπή». Το `standalone.html` και το `index.html` περιλαμβάνουν την ίδια πλήρη εφαρμογή.

Για έλεγχο: `npm test`. Για επαναδημιουργία HTML: `npm run build` (αποτέλεσμα στον φάκελο `dist`).

## Διατήρηση προσθηκών v4.2

Η v4.3 ενσωματώνει όλες τις προσθήκες ανορθωτών του v4.2: MATH/MEASURE, πράξεις καναλιών, RMS/μέση τιμή/ενέργεια, επιλογή χρονικού παραθύρου, Math CSV, ανεξάρτητη περιοδική λύση, λ/PF, I₁/I, S₁ και διευρυμένη θεωρία. Δείτε το [CHANGELOG-v4.3.md](CHANGELOG-v4.3.md) για τη συγχώνευση και τους ελέγχους διατήρησης.

## Φορτίο άξονα σε N·m — v4.4

Στην καρτέλα «Κυματομορφές & ροπή» επίλεξε «Ορισμός φορτίου → Ροπή σε N·m». Ρύθμισε την αρχική TL και την TL μετά τη μεταγωγή, και ενεργοποίησε «Αλλαγή φορτίου στην είσοδο Δ». Προεπιλογή: Υ 10 → Δ 60 N·m, σταθερή ροπή. Το δεύτερο φορτίο εφαρμόζεται όταν κλείνει ο Δ, μετά τον νεκρό χρόνο. Η Te, η επιτάχυνση και τα ρεύματα υπολογίζονται από το μοντέλο.

Διατίθενται επίσης ένα σταθερό φορτίο σε όλη τη δοκιμή, φορτίο ανεμιστήρα (οι τιμές N·m ορίζονται στην ονομαστική ταχύτητα) και η αρχική ρύθμιση σε % ονομαστικής ροπής. Οι αλλαγές ρυθμίσεων επαναφέρουν τη δοκιμή. Το CSV περιλαμβάνει TL αναφοράς και στάδιο φόρτισης.

Ο builder δημιουργεί PUBLIC με `--public --multi` και FULL με `--multi`. Οι δύο εκδόσεις έχουν το ίδιο μοντέλο και τις ίδιες προσθήκες ανορθωτών v4.2. Στο υπάρχον GitHub repository κράτησε το workflow και το branch δημοσίευσης που ήδη χρησιμοποιείς.
