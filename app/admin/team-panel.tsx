'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/field'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  createDeliverer,
  deleteDeliverer,
  getAdminDeliverers,
  updateDeliverer,
} from '@/lib/api/client'
import { EmailLocalInput } from '@/components/email-local-input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { defaultPassword, emailLocal, workEmail } from '@/lib/default-password'
import { GhostButton, PanelHeader, PrimaryButton, Td, Th } from './panel-parts'
import { PersonReport } from './person-report'

/**
 * The people who deliver work.
 *
 * Deliberately not accounts: nobody here needs an email, a password or a role
 * to have their name on a delivery. Names also appear on their own — typing one
 * on the logging form adds it — so this screen is for correcting the list rather
 * than building it.
 *
 * Removing a name is a soft delete. It stops being offered on the form, and
 * every delivery that names it keeps saying who delivered it. Removing the row
 * outright would blank the "delivered by" column on real records.
 *
 * Since 2026-08-28 it is also where an admin reads one person's record. A PM
 * sees only their own deliveries (§5.10), so this is the one screen that sees
 * everyone's — clicking a name opens the report in place of the list, because a
 * report is a different thing to look at rather than an expansion of a row.
 */
export function TeamPanel() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  /**
   * Whether this person gets a login (owner, 2026-08-29).
   *
   * A checkbox rather than an email field. The admin types a name and nothing
   * else: the address is derived from it and the domain is not typeable at all,
   * so there is no box in which to misspell a colleague's address and no way to
   * create an account on a domain the company does not own. The server derives
   * it too and ignores anything the client might have sent (§4.6).
   *
   * Off by default — most of this list never signs in, which is the whole
   * reason the Team table is separate from accounts (§5.5).
   */
  const [createLogin, setCreateLogin] = useState(false)
  /**
   * The mailbox and the password, both editable, both suggested from the name.
   *
   * They are separate fields because a person's name and their address need not
   * match — someone on the Team list as "Sam" is plausibly `samantha@` (owner,
   * 2026-08-29). Only the domain is fixed.
   *
   * `touched` is what makes the suggestion helpful rather than annoying: the
   * fields track the name while they are untouched and stop the moment the
   * admin edits one, so typing the name keeps them in step and correcting one
   * is never undone by the next keystroke in Name.
   */
  const [emailValue, setEmailValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  })

  const emailField = touched.email ? emailValue : emailLocal(name)
  const passwordField = touched.password ? passwordValue : defaultPassword(name)
  const [confirming, setConfirming] = useState<string | null>(null)
  /** Whose report is open, if any. */
  const [viewing, setViewing] = useState<string | null>(null)
  /**
   * Giving a login to someone already on the list.
   *
   * The common way a name gets here is a PM typing it on the logging form, and
   * that path cannot ask for an email. Without this, anybody added that way
   * could never be given an account from the UI at all — which would leave the
   * Add form as the only door and make the order in which a colleague was first
   * mentioned decide whether they can ever sign in.
   */
  const [linking, setLinking] = useState<string | null>(null)
  /**
   * Whose row is open for editing, and the draft.
   *
   * Held per row rather than in a dialog: correcting a misspelling is a small,
   * frequent job, and a modal for it would be three clicks where one will do.
   */
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', emailLocal: '', password: '' })

  const { data: people = [], isLoading } = useQuery({
    queryKey: ['admin', 'deliverers'],
    queryFn: getAdminDeliverers,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'deliverers'] })
    // The logging form reads the same list.
    void queryClient.invalidateQueries({ queryKey: ['deliverers'] })
  }

  /** Back to tracking the name, so the next person starts from their own. */
  function resetLoginFields() {
    setEmailValue('')
    setPasswordValue('')
    setTouched({ email: false, password: false })
  }

  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : 'That did not work')

  const create = useMutation({
    mutationFn: () =>
      createDeliverer(
        name.trim(),
        createLogin
          ? { emailLocal: emailField.trim(), password: passwordField }
          : undefined,
      ),
    onSuccess: (r) => {
      /*
       * The password is shown once, here, and nowhere else.
       *
       * It is derived from the name so it is never lost — an admin can work it
       * out again — but it is surfaced on creation so it can be passed on
       * without anyone having to know the rule. The toast says to change it,
       * because that is the step this whole arrangement depends on.
       */
      if (r.account) {
        toast(`${r.deliverer.name} can now sign in`, {
          description: `${r.account.email} · password ${r.account.password} — they should change it on /account.`,
          duration: 12_000,
        })
      } else {
        toast(
          r.deliverer.created
            ? `${r.deliverer.name} added`
            : `${r.deliverer.name} is already on the list`,
        )
      }
      setName('')
      setCreateLogin(false)
      resetLoginFields()
      setAdding(false)
      refresh()
    },
    onError,
  })

  /**
   * Same endpoint as adding a person.
   *
   * Posting a name that already exists resolves to that Team entry rather than
   * making a second one, so "add a login for someone already here" and "add a
   * person with a login" are one operation and cannot drift apart.
   */
  const link = useMutation({
    mutationFn: (name: string) => createDeliverer(name, {}),
    onSuccess: (r) => {
      if (r.account) {
        toast(`${r.deliverer.name} can now sign in`, {
          description: `${r.account.email} · password ${r.account.password} — they should change it on /account.`,
          duration: 12_000,
        })
      }
      setLinking(null)
      refresh()
    },
    onError,
  })

  /**
   * Save an edit.
   *
   * Only what actually changed is sent, so a save that touched the name does
   * not also rewrite the address, and an untouched password field is never
   * mistaken for "set the password to this".
   */
  const edit = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateDeliverer>[1] }) =>
      updateDeliverer(id, patch),
    onSuccess: (r, vars) => {
      toast(`${r.deliverer.name} updated`, {
        description: vars.patch.password
          ? 'New password set — it signs them out everywhere until they use it.'
          : undefined,
      })
      setEditing(null)
      refresh()
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteDeliverer(id),
    onSuccess: (r) => {
      toast(`${r.removed.name} removed`, {
        description:
          r.removed.keptDeliveries > 0
            ? `${r.removed.keptDeliveries} deliveries keep their name — only the form stops offering it.`
            : undefined,
      })
      refresh()
    },
    onError,
  })

  if (viewing) return <PersonReport id={viewing} onBack={() => setViewing(null)} />

  const pending = people.find((p) => p.id === confirming)

  return (
    <div>
      {/* Destructive, so it asks in a dialog rather than turning a small text
          button into a second small text button (§5.5). */}
      {pending && (
        <ConfirmDialog
          title={<>Remove {pending.name} from the Team?</>}
          description="They stop being offered on the logging form. Every delivery that names them keeps the name, and nothing is erased."
          /*
            Both consequences, because the login is the one that surprises.
            Removing a person used to leave their account behind holding their
            address, so adding them again was refused by an account nobody could
            see. The account goes with the name now, and the dialog says so
            before the click rather than after it.
          */
          consequence={
            [
              pending.taskCount > 0
                ? `${pending.taskCount} deliver${pending.taskCount === 1 ? 'y' : 'ies'} keep the name.`
                : null,
              pending.account ? `${pending.account.email} can no longer sign in.` : null,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          pending={remove.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            remove.mutate(pending.id)
            setConfirming(null)
          }}
        />
      )}

      <PanelHeader
        title="Team"
        note="Who can be named as having delivered work. Click a name for their delivery record. Not every name is a login — typing a new one while logging a delivery adds it too."
        action={
          !adding && (
            <PrimaryButton type="button" onClick={() => setAdding(true)}>
              Add person
            </PrimaryButton>
          )
        }
      />

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate()
          }}
          className="border-rule bg-wash/40 mb-6 rounded-xl border p-4"
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-[16rem]">
              <Field label="Name">
                <Input
                  autoFocus
                  value={name}
                  placeholder="First name is enough"
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex items-center gap-3 pb-1.5">
              <PrimaryButton disabled={create.isPending || !name.trim()}>
                {create.isPending ? 'Adding' : 'Add person'}
              </PrimaryButton>
              <GhostButton
                onClick={() => {
                  setAdding(false)
                  setName('')
                  setCreateLogin(false)
                  resetLoginFields()
                }}
              >
                Cancel
              </GhostButton>
            </div>
          </div>

          {/*
            The login, and what it will be.

            Shown rather than typed: the address and the password both follow
            from the name, so this states them instead of asking. Both are still
            reported from the server's own values on success — this is the
            preview, not the source of truth.
          */}
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-dense">
            <input
              type="checkbox"
              checked={createLogin}
              onChange={(e) => setCreateLogin(e.target.checked)}
              className="accent-lime size-4"
            />
            Give them a login
          </label>

          {/*
            Shown only when there is an account to describe. Both fields are
            filled in from the name and both can be changed — the domain beside
            the mailbox is the only thing here that cannot.
          */}
          {createLogin && (
            <div className="mt-4 flex flex-wrap items-start gap-4">
              <div className="w-[20rem]">
                <Field label="Email" htmlFor="new-email">
                  <EmailLocalInput
                    id="new-email"
                    value={emailField}
                    onChange={(v) => {
                      setTouched((t) => ({ ...t, email: true }))
                      setEmailValue(v)
                    }}
                  />
                </Field>
              </div>

              <div className="w-[20rem]">
                <Field
                  label="Starting password"
                  htmlFor="new-password"
                  hint="Shown once. They should change it on /account."
                >
                  <Input
                    id="new-password"
                    value={passwordField}
                    onChange={(e) => {
                      setTouched((t) => ({ ...t, password: true }))
                      setPasswordValue(e.target.value)
                    }}
                  />
                </Field>
              </div>
            </div>
          )}
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule bg-wash/60 border-b">
              <Th>Name</Th>
              <Th>Account</Th>
              <Th>Deliveries</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="text-ink-muted py-8 text-center text-micro">
                  Loading
                </td>
              </tr>
            )}

            {!isLoading && people.length === 0 && (
              <tr>
                <td colSpan={4} className="text-ink-muted py-8 text-center text-micro">
                  Nobody on the list yet.
                </td>
              </tr>
            )}

            {people.map((p) => (
              <Fragment key={p.id}>
              <tr className="border-rule hover:bg-wash border-b last:border-0">
                <Td className="font-medium">
                  {/* The name is the way in, so a report is one click from the
                      list rather than behind a control of its own. */}
                  <button
                    type="button"
                    onClick={() => setViewing(p.id)}
                    className="hover:text-ink text-left underline decoration-dotted underline-offset-2"
                  >
                    {p.name}
                  </button>
                </Td>
                {/* Most of this list never signs in — that is the point of the
                    Team table being separate from accounts (§5.5). */}
                <Td className="text-ink-muted">
                  {p.account ? (
                    `${p.account.email} · ${p.account.role}`
                  ) : linking === p.id ? (
                    /*
                      A confirmation, not a form — there is nothing to type.
                      It states the address and the password it is about to
                      create so the admin can read them before committing.
                    */
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-ink-muted text-micro">
                        <span className="code text-ink">{workEmail(p.name)}</span> ·{' '}
                        <span className="code text-ink">{defaultPassword(p.name)}</span>
                      </span>
                      <PrimaryButton
                        type="button"
                        disabled={link.isPending}
                        onClick={() => link.mutate(p.name)}
                      >
                        {link.isPending ? 'Creating' : 'Create login'}
                      </PrimaryButton>
                      <GhostButton onClick={() => setLinking(null)}>Cancel</GhostButton>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLinking(p.id)}
                      className="text-ink-faint hover:text-ink underline decoration-dotted underline-offset-2 transition-colors duration-[120ms]"
                      title={`Give ${p.name} a login as ${workEmail(p.name)}`}
                    >
                      Add login
                    </button>
                  )}
                </Td>
                {/* Live deliveries only. A count that included deleted ones
                    once claimed seven deliveries against an empty ledger. */}
                <Td className="tabular">{p.taskCount}</Td>
                <Td align="right" control>
                  <span className="inline-flex items-center gap-1.5">
                    <GhostButton onClick={() => setViewing(p.id)}>Report</GhostButton>
                    <GhostButton
                      onClick={() => {
                        setEditing(p.id)
                        setLinking(null)
                        setDraft({
                          name: p.name,
                          emailLocal: p.account?.email.split('@')[0] ?? '',
                          password: '',
                        })
                      }}
                    >
                      Edit
                    </GhostButton>
                    <GhostButton danger onClick={() => setConfirming(p.id)}>
                      Remove
                    </GhostButton>
                  </span>
                </Td>
              </tr>

              {/*
                The editor, as a row beneath the one it edits.

                Inline rather than a dialog: correcting a spelling or resetting
                a password is small and frequent, and a modal would put three
                clicks around a one-field change. It spans the table so the
                fields have room to be labelled.
              */}
              {editing === p.id && (
                <tr className="border-rule bg-wash/40 border-b last:border-0">
                  <td colSpan={4} className="px-4 py-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        const patch: Parameters<typeof updateDeliverer>[1] = {}
                        if (draft.name.trim() && draft.name.trim() !== p.name)
                          patch.name = draft.name.trim()
                        if (
                          p.account &&
                          draft.emailLocal.trim() &&
                          draft.emailLocal.trim() !== p.account.email.split('@')[0]
                        )
                          patch.emailLocal = draft.emailLocal.trim()
                        if (draft.password.trim()) patch.password = draft.password.trim()

                        // Nothing changed is not an error; it is a no-op.
                        if (Object.keys(patch).length === 0) return setEditing(null)
                        edit.mutate({ id: p.id, patch })
                      }}
                      className="flex flex-wrap items-end gap-4"
                    >
                      <div className="w-[14rem]">
                        <Field label="Name">
                          <Input
                            autoFocus
                            value={draft.name}
                            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                          />
                        </Field>
                      </div>

                      {/* Address and password only exist for someone who signs in. */}
                      {p.account ? (
                        <>
                          <div className="w-[17rem]">
                            <Field label="Email">
                              <EmailLocalInput
                                value={draft.emailLocal}
                                onChange={(v) => setDraft((d) => ({ ...d, emailLocal: v }))}
                              />
                            </Field>
                          </div>

                          <div className="w-[17rem]">
                            <Field
                              label="New password"
                              optional
                              hint="Leave blank to keep the current one."
                            >
                              <Input
                                value={draft.password}
                                placeholder="Unchanged"
                                onChange={(e) =>
                                  setDraft((d) => ({ ...d, password: e.target.value }))
                                }
                              />
                            </Field>
                          </div>
                        </>
                      ) : (
                        <p className="text-ink-muted pb-2 text-micro">
                          No login — add one from this row to set an address and password.
                        </p>
                      )}

                      <div className="flex items-center gap-3 pb-1.5">
                        <PrimaryButton disabled={edit.isPending || !draft.name.trim()}>
                          {edit.isPending ? 'Saving' : 'Save'}
                        </PrimaryButton>
                        <GhostButton onClick={() => setEditing(null)}>Cancel</GhostButton>
                      </div>
                    </form>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
