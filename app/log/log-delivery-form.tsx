'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { BrandInput } from '@/components/brand-input'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { DelivererInput } from '@/components/deliverer-input'
import type { MultiOption } from '@/components/multi-select'
import { AsinSection, emptyAsin, type AsinDraft } from '@/components/asin-section'
import { Band, Field } from '@/components/field'
import { Segmented } from '@/components/segmented'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  checkDuplicate,
  createTask,
  getAgencies,
  getBrands,
  getServices,
} from '@/lib/api/client'
import type { Complexity } from '@/lib/api/types'
import { todayInIST, formatCategory } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PrimaryButton } from '@/components/primary-button'
import { isPM, useSession } from '@/components/session'

type FormState = {
  agencyId: string
  brandName: string
  /**
   * One entry per product listing. Order matters: it becomes the order of the
   * sections on screen and of the rows written to the ledger.
   */
  asins: AsinDraft[]
  deliveredOn: string
  deliveredByName: string
  notes: string
}

/** A card key that never matches one, so nothing is open. */
const NONE_OPEN = '__none__'

const EMPTY: FormState = {
  agencyId: '',
  brandName: '',
  asins: [emptyAsin()],
  deliveredOn: todayInIST(),
  deliveredByName: '',
  notes: '',
}

export function LogDeliveryForm() {
  /**
   * A PM delivers as themselves (§5.10).
   *
   * The picker is hidden rather than pre-filled and locked: a disabled field
   * carrying your own name is furniture, and this form exists to be finished in
   * under thirty seconds (§5.1). The server stamps the deliverer from the
   * session regardless of what is posted, so this is presentation, not the
   * rule — the rule is in `createTask`.
   */
  const { user } = useSession()
  const deliversAsSelf = isPM(user)

  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateAck, setDuplicateAck] = useState(false)
  /**
   * Which product card is open. One at a time (§5.1).
   *
   * Null means the last one, which is the card you were just given by "Add
   * another product" — so the form always opens on something you can type into
   * rather than on a wall of collapsed lines.
   *
   * NONE_OPEN is a key no card can hold, which is how Done closes the last card
   * without immediately reopening it as "the last one".
   */
  const [openAsin, setOpenAsin] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLButtonElement>(null)

  /**
   * Which side of the toggle the cards are on, read from the cards themselves.
   *
   * There is no delivery-level control any more (owner, 2026-09-01) — each card
   * says what it is, so a submission can carry a hero product and a variation
   * at once. These only decide the wording around them.
   */
  const allParent = form.asins.every((a) => a.forParent)
  const allVariation = form.asins.every((a) => !a.forParent)
  const mixedSides = !allParent && !allVariation

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: getAgencies })
  // Active only: a retired service should not be offered for a new delivery.
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => getServices(),
  })

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e))
    setDuplicateAck(false)
  }

  const agencyOptions: ComboboxOption[] = agencies.map((a) => ({
    value: a.id,
    label: a.name,
    hint: `${a.type === 'AGENCY' ? 'Agency' : 'Direct'} · ${a.freeRevisionAllowance} free revision${a.freeRevisionAllowance === 1 ? '' : 's'}`,
  }))

  const serviceOptions: MultiOption[] = services.map((s) => ({
    value: s.id,
    label: s.name,
    group: s.isBundle ? 'Bundles' : formatCategory(s.category),
    // Bundle contents shown inline, as §5.1 requires.
    hint: s.isBundle ? s.components.map((c) => c.name).join(' + ') : undefined,
    keywords: s.code,
  }))

  const selectedAgency = agencies.find((a) => a.id === form.agencyId)

  /**
   * A DIRECT client is its own brand.
   *
   * That is the whole distinction between the two kinds: an AGENCY brings us
   * work for other people's brands, a DIRECT client IS the brand. So the field
   * is filled from the agency and locked rather than asking someone to retype
   * the name they just chose — and the server takes the name from the agency
   * regardless of what this form sends (§4.6).
   */
  const isDirect = selectedAgency?.type === 'DIRECT'
  const brandName = isDirect ? (selectedAgency?.name ?? '') : form.brandName

  /** One ledger row per service per ASIN, which is what the note below reports. */
  const rowCount = form.asins.reduce((n, a) => n + a.serviceIds.length, 0)

  /**
   * The brand's id, when the typed name is one that already exists.
   *
   * ASIN suggestions are scoped to a brand, and the form only has the name a PM
   * is typing. A brand being entered for the first time has no id and no ASINs
   * yet, which is why this is allowed to be null rather than blocking anything.
   */
  const { data: brandMatches = [] } = useQuery({
    queryKey: ['brands', form.agencyId, brandName.trim()],
    queryFn: () => getBrands(form.agencyId, brandName.trim()),
    enabled: Boolean(form.agencyId && brandName.trim()),
  })
  const typedBrand = brandName.trim().toLowerCase()
  const brandId =
    brandMatches.find((b) => b.name.trim().toLowerCase() === typedBrand)?.id ?? null

  // Only ask about duplicates once every identifying field is filled in.
  // Advisory only, so checking the first service is enough to catch the
  // accidental double-save this guards against (§5.1).
  const firstService = form.asins[0]?.serviceIds[0]
  const duplicateKey =
    form.agencyId && brandName.trim() && firstService
      ? {
          agencyId: form.agencyId,
          brandName: brandName.trim(),
          serviceId: firstService,
          deliveredOn: form.deliveredOn,
        }
      : null

  const { data: duplicate } = useQuery({
    queryKey: ['duplicate-check', duplicateKey],
    queryFn: () => checkDuplicate(duplicateKey!),
    enabled: Boolean(duplicateKey),
    staleTime: 0,
  })

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: (result) => {
      const rows = result.tasks
      // One submission can create several rows, so the toast names each one.
      const title =
        rows.length === 1
          ? rows[0]!.taskCode
          : `${rows.length} deliveries logged`
      const description = [
        rows[0]!.brandName,
        ...rows.map(
          (t) =>
            `${t.taskCode} ${t.serviceName}` +
            (t.revisionRoundCount > 0 ? ` (${t.revisionRoundCount} rev)` : ''),
        ),
        result.brandCreated ? 'new brand' : null,
      ]
        .filter(Boolean)
        .join(' · ')
      toast(title, { description })
      if (result.variationWarning) toast.warning(result.variationWarning)

      // Reset, but keep agency and brand: PMs log several for one brand in a
      // row, and retyping them is the main source of friction (§5.1).
      setOpenAsin(null)
      setForm((f) => ({
        ...EMPTY,
        agencyId: f.agencyId,
        brandName: f.brandName,
        deliveredByName: f.deliveredByName,
        deliveredOn: f.deliveredOn,
      }))
      setErrors({})
      setDuplicateAck(false)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['brands'] })
      firstFieldRef.current?.focus()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.issues.length > 0) {
        // The server is authoritative (§4.6), so its field errors win.
        setErrors(Object.fromEntries(error.issues.map((i) => [i.path, i.message])))

        /*
         * Say what is wrong, not just that something is.
         *
         * The server's paths do not always match a field this form renders —
         * it validates a payload, this renders a screen — and when they do not,
         * "Check the highlighted fields" points at nothing highlighted. Naming
         * the first problem means the message is useful even when the field it
         * belongs to is not on screen.
         */
        toast.error(error.issues[0]!.message, {
          description:
            error.issues.length > 1
              ? `and ${error.issues.length - 1} more`
              : 'Check the highlighted fields.',
        })
        return
      }
      toast.error(error instanceof Error ? error.message : 'Could not save')
    },
  })

  /** Client-side checks are a convenience only; the API validates again (§4.6). */
  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.agencyId) next.agencyId = 'Pick an agency'
    // A direct client's name comes from the agency, so there is nothing to check.
    if (!isDirect && !form.brandName.trim()) next.brandName = 'Enter a brand'
    // Errors are namespaced by ASIN index, so one section cannot light up
    // another section's fields.
    form.asins.forEach((asin, ai) => {
      if (asin.serviceIds.length === 0) {
        next[`a${ai}.serviceIds`] = 'Pick at least one service'
      }
      for (const serviceId of asin.serviceIds) {
        /*
         * Nothing to check on a variation row.
         *
         * Leaving the tier unset is an answer, not a gap — it means the plain
         * version of the service (§5.7) — and the product name and child ASIN
         * are both optional. The revisions check that used to live here went
         * with the field.
         */
      }
    })
    /* A date is required; which date is the PM's to decide (owner, 2026-09-28).
       The period lock still governs what a date is allowed to reach (§4.5). */
    if (!form.deliveredOn) next.deliveredOn = 'Pick a date'
    // Not required when the server is going to decide it anyway.
    if (!deliversAsSelf && !form.deliveredByName.trim())
      next.deliveredByName = 'Enter who delivered it'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function submit() {
    if (!validate()) return
    if (duplicate && !duplicateAck) {
      setDuplicateAck(true)
      return
    }
    mutation.mutate({
      agencyId: form.agencyId,
      brandName: brandName.trim(),
      asins: form.asins.map((asin) => ({
        code: asin.code.trim() || null,
        productName: asin.productName.trim() || null,
        lines: asin.serviceIds.map((serviceId) => ({
          serviceId,
          /*
           * Whether the first line below is the parent listing.
           *
           * The server cannot tell from the rows themselves — "line 1 is the
           * parent" is a convention, not a fact about the data — and it decides
           * both the variation count and the variation codes, so the form has
           * to say (§2.4).
           */
          hasParentLine: asin.forParent,
          /*
           * One line per service, its variations taken from the card.
           *
           * Everything about a SKU — its name, its code, its tier — is answered
           * once above and repeated onto each service here, because the ledger
           * stores a variation row per service and that has not changed. What
           * changed is that the form stopped asking the same question once per
           * service (owner, 2026-09-01).
           *
           * A parent delivery has no SKUs at all: one line, no name, no tier,
           * which the server records as STANDALONE.
           */
          variations: [
            {
              // Unset is sent as null, and the server stores it as STANDALONE:
              // no tier, so the service's base price applies. A parent line is
              // always standalone (§2.4).
              complexity: asin.forParent ? null : (asin.complexity || null) as Complexity | null,
              /*
               * The card's own name, on the line, when the card IS a variation.
               * A parent line carries none: its name is the listing's, one
               * level up (§2.4).
               *
               * The code is not repeated here — it is already the task's ASIN,
               * since on this side of the toggle the card's code IS this
               * variation's listing.
               */
              productName: asin.forParent ? null : asin.productName.trim() || null,
              asinCode: null,
              /*
               * No clickupTaskId and no revisionCount. Both left the form
               * (§5.1); the server treats them as optional and defaults the
               * count to 0, so a delivery simply starts with no rounds and
               * gains them on its own record as they happen.
               */
            },
          ],
        })),
      })),
      deliveredOn: form.deliveredOn,
      /*
       * Omitted entirely when the PM delivers as themselves.
       *
       * It was sent as an empty string, which the server read as "a name was
       * given, and it is blank" and refused — naming a field the PM's form does
       * not have, so nothing highlighted and the toast pointed at nothing. The
       * server stamps the deliverer from the session either way (§5.10); the
       * client's job is to not claim otherwise.
       */
      deliveredByName: deliversAsSelf ? undefined : form.deliveredByName.trim(),
      notes: form.notes.trim() || null,
    })
  }


  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault()
          submit()
        }
      }}
      /* Bands separated by hairlines. A ledger is ruled, not boxed. */
      className="divide-rule divide-y"
    >
      <Band title="Who it is for" className="pb-7">
        <Field label="Agency or direct client" htmlFor="agency" error={errors.agencyId}>
          <Combobox
            id="agency"
            triggerRef={firstFieldRef}
            options={agencyOptions}
            value={form.agencyId}
            invalid={Boolean(errors.agencyId)}
            placeholder="Select"
            searchPlaceholder="Search agencies"
            clearable={false}
            onChange={(v) => {
              // Brands are scoped to an agency, so changing it clears the brand (§2.7).
              setForm((f) => ({ ...f, agencyId: v, brandName: '' }))
              setErrors((e) => ({ ...e, agencyId: '', brandName: '' }))
            }}
          />
        </Field>

        <Field
          label="Brand"
          htmlFor="brand"
          error={errors.brandName}
          hint={
            isDirect
              ? 'A direct client is its own brand, so this comes from the agency.'
              : selectedAgency
                ? `${selectedAgency.freeRevisionAllowance} free revision${selectedAgency.freeRevisionAllowance === 1 ? '' : 's'} on this contract.`
                : undefined
          }
        >
          {isDirect ? (
            /*
             * Read-only rather than a disabled input: a disabled field looks
             * broken and is skipped by the keyboard, when the honest message is
             * "this is already decided". The value is still visible, which
             * matters — it is what gets recorded.
             */
            <div className="border-control bg-wash text-ink-muted flex h-10 items-center rounded-lg border px-3 text-dense">
              {brandName}
            </div>
          ) : (
            <BrandInput
              id="brand"
              agencyId={form.agencyId}
              value={form.brandName}
              onChange={(v) => set('brandName', v)}
              invalid={Boolean(errors.brandName)}
            />
          )}
        </Field>

      </Band>

      <Band title="Products" className="py-7">
        {/* The lede follows the toggle too: describing children under every card
            was simply wrong on a delivery that has none. */}
        <p className="text-ink-muted mb-4 text-micro">
          {mixedSides
            ? 'One card per delivered thing — a product listing, or one of its variations. Each card says which.'
            : allParent
              ? 'One card per product listing. Every service you pick is delivered against it.'
              : 'One card per variation — the same product in another size or colour, with its own ASIN. Every service you pick is delivered for it.'}
        </p>

        {/* Cards carry their own padding now, so they need more room between
            them than the fields inside them. */}
        <div className="space-y-5">
          {form.asins.map((asin, index) => (
            <AsinSection
              key={asin.key}
              index={index}
              value={asin}
              /*
                Open when chosen, when it is the last card and none is chosen,
                or whenever it has an error — a collapsed card cannot show you
                what is wrong with it, and a form that refuses to save without
                saying where is the worst thing this screen could do.
              */
              open={
                (openAsin ?? form.asins[form.asins.length - 1]?.key) === asin.key ||
                Object.keys(errors).some((k) => k.startsWith(`a${index}.`))
              }
              onOpen={() => setOpenAsin(asin.key)}
              onDone={() => setOpenAsin(NONE_OPEN)}
              services={services}
              serviceOptions={serviceOptions}
              brandId={brandId}
              removable={form.asins.length > 1}
              onRemove={() => {
                setForm((f) => ({ ...f, asins: f.asins.filter((a) => a.key !== asin.key) }))
                /* Removing the open card falls back to the last one rather than
                   leaving every card collapsed and nothing to type into. */
                setOpenAsin((k) => (k === asin.key ? null : k))
                setErrors({})
                setDuplicateAck(false)
              }}
              onChange={(next) => {
                setForm((f) => ({
                  ...f,
                  asins: f.asins.map((a) => (a.key === asin.key ? next : a)),
                }))
                setErrors({})
                setDuplicateAck(false)
              }}
              errors={Object.fromEntries(
                Object.entries(errors)
                  .filter(([k]) => k.startsWith(`a${index}.`))
                  .map(([k, v]) => [k.slice(`a${index}.`.length), v]),
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setForm((f) => ({
              ...f,
              /* A new card starts on the same side as the last one: adding a
                 second variation should not silently begin as a parent. */
              asins: [...f.asins, emptyAsin(f.asins[f.asins.length - 1]?.forParent ?? true)],
            }))
            /* The new card is the one you are about to fill in. */
            setOpenAsin(null)
            setErrors({})
            setDuplicateAck(false)
          }}
          className="text-ink-muted hover:text-ink hover:border-rule-strong border-rule mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-micro transition-colors duration-[120ms]"
        >
          <Plus className="size-3.5" />
          {/* A card is a product on one side of the toggle and a variation on
              the other, so the button that adds one says which. */}
          {mixedSides || allParent ? 'Add another product' : 'Add another variation'}
        </button>

        {rowCount > 1 && (
          <p className="text-ink-muted mt-3 text-micro">
            Saving creates {rowCount} ledger rows — one per service per ASIN — linked as one
            delivery. That is what keeps the delivered count and the service mix exact.
          </p>
        )}
      </Band>

      <Band title="When and who" className="py-7">
        <div className="grid gap-4 sm:grid-cols-2">
          {/*
            "Created on" (owner, 2026-09-23). The column, the API field and the
            period it lands in are all still `deliveredOn` — only the label
            changed, so nothing about when a delivery counts has moved.
          */}
          <Field label="Created on" htmlFor="deliveredOn" error={errors.deliveredOn}>
            {/*
              No `max` (owner, 2026-09-28). Two reasons, and the second is the
              bug: a date is now free to pick, AND the cap was frozen at the
              last deploy. This page is prerendered, so `todayInIST()` ran at
              build time and shipped as `max="2026-09-23"` in the HTML — React
              does not patch an attribute mismatch on hydration, so the form
              refused every date after the day it was built, today included.
              A cap computed at render is a cap that expires; this one has none.
            */}
            <Input
              id="deliveredOn"
              type="date"
              value={form.deliveredOn}
              aria-invalid={Boolean(errors.deliveredOn)}
              onChange={(e) => set('deliveredOn', e.target.value)}
            />
          </Field>

          {!deliversAsSelf && (
            <Field
              label="Delivered by"
              htmlFor="deliveredBy"
              error={errors.deliveredByName}
              hint="Type a name that is not listed to add them to the team."
            >
              <DelivererInput
                id="deliveredBy"
                value={form.deliveredByName}
                invalid={Boolean(errors.deliveredByName)}
                onChange={(v) => set('deliveredByName', v)}
              />
            </Field>
          )}
        </div>

        <Field label="Notes" htmlFor="notes" optional>
          <Input
            id="notes"
            value={form.notes}
            placeholder="Anything worth recording about this delivery"
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
      </Band>

      {/*
        Sticky action bar: the save button is never below the fold, which is the
        difference between a 20-second entry and a 40-second one.
      */}
      {/* Solid, not translucent: a blurred bar over a scrolling form reads as
          mush, and this one has to stay legible while fields pass under it. */}
      <div className="border-rule bg-paper sticky bottom-0 -mx-6 border-t px-6 py-4">
        {duplicate && (
          <div
            className={cn(
              'mb-3 rounded-md px-3 py-2 text-dense',
              // The only chromatic colour in the product means "beyond
              // allowance", so a duplicate warning must not borrow it. Neutral
              // wash with a rule instead.
              'border-rule-strong bg-wash border',
            )}
          >
            <span className="code">{duplicate.taskCode}</span>{' '}
            <span className="text-ink-muted">
              matches this exactly and was logged minutes ago.
              {duplicateAck
                ? ' Press save again to log it anyway.'
                : ' Saving is allowed; genuine duplicates happen.'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4">
          <PrimaryButton
            type="submit"
            size="md"
            pending={mutation.isPending}
            pendingLabel="Saving"
          >
            {duplicateAck ? 'Save anyway' : 'Save task'}
          </PrimaryButton>

          <p className="text-ink-faint text-micro">
            <kbd className="text-ink-muted font-sans">⌘</kbd>
            <kbd className="text-ink-muted font-sans">↵</kbd> to save. Agency and brand
            are kept for the next entry.
          </p>
        </div>
      </div>
    </form>
  )
}
