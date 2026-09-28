import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * The company mark, in the variant the background calls for.
 *
 * Two files, one shown at a time by CSS rather than by reading the theme in
 * JavaScript. That matters: `useTheme` is undefined until the client mounts, so
 * a JS swap would render one mark on the server, the other after hydration, and
 * flash the wrong logo on every page load. A `dark:` variant costs one extra
 * image request and never flickers.
 *
 *   workinx-logo.png       720×228, the master. The mark sits inside generous
 *                          transparent padding — it fills 85% of the canvas
 *                          width and 75% of its height.
 *   workinx-logo-dark.png  1472×410, the white-X version for dark backgrounds.
 *                          The mark is bled to the edges: 100% × 99%.
 *
 * **That difference is the whole reason this component is not two <img> tags.**
 * The artworks carry the same mark at very nearly the same proportion (3.600
 * against 3.617), but one is padded and the other is not, so giving them the
 * same CSS width drew the dark mark about 18% larger than the light one — which
 * is exactly what it looked like: the logo growing when you switched themes.
 *
 * So the wrapper owns the size. It holds the light artwork's aspect ratio, the
 * light image fills it, and the dark image is centred at INK_RATIO of the width
 * — the fraction the light mark occupies — which lands the two marks at the
 * same rendered size. Because the box never changes, nothing in the nav shifts
 * when the theme does.
 *
 * If either artwork is ever replaced, re-measure: the numbers below describe
 * those two files and nothing else.
 *
 * The printed statement deliberately does NOT use this: that page is warm paper
 * in either theme, so it always takes the light mark at its own natural size.
 */

/** Light artwork's canvas, which defines the box every caller sizes. */
const LIGHT = { width: 720, height: 228 }
const DARK = { width: 1472, height: 410 }

/**
 * How much of the light canvas the mark actually covers, measured from the
 * pixels (ink bounds 612×170 inside 720×228). The dark artwork is drawn at this
 * fraction so the two marks match.
 */
const INK_RATIO = 0.85

export function Logo({
  className,
  priority,
}: {
  /** Sizing lives here; the brand's stated minimum is 120px wide. */
  className?: string
  priority?: boolean
}) {
  return (
    <span
      className={cn('relative inline-block align-middle', className)}
      style={{ aspectRatio: `${LIGHT.width} / ${LIGHT.height}` }}
    >
      <Image
        src="/workinx-logo.png"
        alt="WorkinX Digital"
        width={LIGHT.width}
        height={LIGHT.height}
        priority={priority}
        className="absolute inset-0 size-full object-contain dark:hidden"
      />
      {/*
        Centred rather than stretched: `inset-0` plus `m-auto` puts the smaller
        artwork in the middle of the same box, so the mark keeps its optical
        position as well as its size.
      */}
      <Image
        src="/workinx-logo-dark.png"
        alt=""
        aria-hidden
        width={DARK.width}
        height={DARK.height}
        priority={priority}
        className="absolute inset-0 m-auto hidden h-auto dark:block"
        // Width from the measured constant, so there is one source of truth for it.
        style={{ width: `${INK_RATIO * 100}%` }}
      />
    </span>
  )
}
