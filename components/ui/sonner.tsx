"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  /*
   * resolvedTheme, not theme.
   *
   * The default is "system", and passing that straight through left Sonner
   * guessing at its own palette rather than following the one the page actually
   * resolved to — which showed up as a light toast on a dark screen.
   */
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={(resolvedTheme ?? "light") as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      // Long enough to read a generated task code and look away (§5.1).
      duration={5000}
      gap={10}
      /* A cross, so a toast can be dismissed rather than waited out. The
         timer still runs — this is for the case where you have read it and
         want the corner back, usually because a second one is queued behind
         it. Styled in globals.css to sit inside the card's own padding
         rather than at Sonner's default top-left corner, which on a card
         this round lands on the radius. */
      closeButton
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
