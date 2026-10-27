# Procedural ink reveal

Each element receives a new `columns × rows` matrix when it intersects the
viewport. Columns and rows follow its actual dimensions and the existing
`--dither-pixel-size`: five CSS pixels per square cell for both photos and other
content, independent of source image resolution. No stored patterns are loaded.

Two independent random draws choose the starting column and row. A third draw
seeds a new continuous velocity field. The same image can therefore have a
different origin and different spreading paths on every page load.

Growth follows a freshly generated tree of narrow channels. Randomly jittered
sites across the image are joined into a rooted minimum spanning tree, with
curved connections instead of a rectangular lattice. Tips move quickly down
those channels; slower lateral seepage thickens the branches and merges the
remaining gaps. Neither the tree nor its origin is reused between page loads.

## Formula

`ink-field.js` builds a streamfunction from twelve randomly phased spatial
Fourier modes. Velocity is its curl, `v = (∂ψ/∂y, −∂ψ/∂x)`, so the disturbance
is divergence-free rather than independent pixel noise. A small mean drift is
rotated with the field. A smooth positive spreading speed varies across it.
The smooth field is sampled every eight cells and interpolated onto the full
matrix; the interpolation approximates the analytic curl.

Starting at the random cell with arrival time zero, the solver propagates to
eight neighboring cells using:

```
channelGain = 0.18 + 5.82 * min(channel(cell), channel(neighbor))
speed = max(0.15, (meanSpreadSpeed + 0.3 * meanVelocity · direction) * channelGain)
ΔT = neighborDistance / speed
T(neighbor) = min(T(neighbor), T(cell) + ΔT)
```

This is a graph approximation to an advected expanding front, not a complete
Navier–Stokes or mass-conserving dye-concentration simulation. It provides
connected growth through a fluid-like velocity field while remaining practical
at the photo's dither resolution. Visibility is permanent once the front arrives.
All cells belong to the same propagation; there is no final secondary wipe.
An indexed bucket queue quantizes travel costs to 1/16 unit and solves the front
without heap operations at every cell. Only playback thresholds are reduced to
eight-bit values; the calculation still covers the entire matrix.

Each 5×5 cell then loads through the user's supplied patterns: a center dot
(1 visible pixel), a plus (5), a 3×3 square (9), a 5×5 shape without its corners
(21), and finally the full square (25). Black reference pixels mean hidden
content, not black ink painted over the image. The stages start at that cell's
fluid arrival time and are about 80 ms apart. Fluid arrivals occupy the first
73% of the timeline, leaving enough time for the last cell to finish all stages.
These subpixel timings are encoded once in the same mask image; no animation
atlas or per-frame canvas redraw is needed. At the default cell size, each
subpixel is one CSS pixel.

The matrix is generated at runtime in a module Web Worker. One worker processes
the queue to limit simultaneous memory use; it closes when the queue is empty.
If workers are unavailable, the identical solver yields between short main-thread
batches. Focus, resize, reduced motion, or a three-second preparation deadline
cancels pending work and exposes the content. Playback takes about 1.2 seconds
and changes only the SVG alpha threshold.

## Experimental source and artistic choices

Parker, David; Burridge, Henry; Partridge, Jamie; Linden, Paul (2019).
[Research data supporting “A comparison of entrainment in turbulent line plumes
adjacent to and distant from a vertical wall”](https://doi.org/10.17863/CAM.44080).
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Only the five **free-plume Eulerian** experiments are used. The repository's
documentation identifies `U/W` as horizontal/vertical means and `u/w` as their
RMS fluctuations. `scripts/data/plume-calibration.json` records the archive
checksum, extraction method, derived profiles, and fit. Reproduce it using
`python scripts/fit-ink.py /path/to/Free_plume_data.zip` with numpy and scipy.

The fitted inputs are horizontal RMS / centerline speed **0.226265**, vertical
RMS / centerline speed **0.268070**, and width gradient **0.075988**. The fitted
linear width profile has **2.41% relative RMSE** against the measurements.
The JavaScript constants use these values to set the disturbance's relative
axis strengths and the spreading-speed growth term.

Random phase, spatial wavelengths, a 1.8× disturbance gain, drift magnitude,
the branching tree and its channel speeds, local speed variation, and normalization
to a 1.2-second reveal are artistic choices. The branching structure is a visual
choice rather than an observed feature extracted from the dye dataset.
The final front is not claimed to reproduce measured concentration or
exact experimental velocity statistics. These data are statistical dye-plume
measurements, not a library of recorded ink shapes.

## Image loading

Below-fold photos use `data-viewport-src`, not `src`, until their photo or reveal
container intersects the viewport. This avoids the browser's native lazy-load
prefetch distance. The initial workshop photo remains eager. `<noscript>`
fallbacks preserve images without JavaScript. Shared image URLs may already be
cached when another instance of the same photo has appeared.
