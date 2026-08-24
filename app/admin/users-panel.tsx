'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Combobox } from '@/components/combobox'
import { Field } from '@/components/field'
import { Pill } from '@/components/pill'
import { useSession } from '@/components/session'
import { Input } from '@/components/ui/input'
import { ApiError, createUser, getAdminUsers, updateUser } from '@/lib/api/client'
import { GhostButton, PanelHeader, PrimaryButton, Td, Th } from './panel-parts'

const ROLES = [
  { value: 'OWNER', label: 'Owner', hint: 'Dashboard, and everything an admin can do' },
  { value: 'ADMIN', label: 'Admin', hint: 'Master data, periods, exports' },
  { value: 'PM', label: 'PM', hint: 'Logs deliveries and revision rounds' },
  { value: 'VIEWER', label: 'Viewer', hint: 'Read only' },
]

type Draft = { name: string; email: string; role: string; password: string }
const EMPTY: Draft = { name: '', email: '', role: 'PM', password: '' }

export function UsersPanel() {
  const queryClient = useQueryClient()
  const { user: me } = useSession()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [resetting, setResetting] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: getAdminUsers,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    void queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : 'That did not work')

  const create = useMutation({
    mutationFn: () =>
      createUser({
        name: draft.name.trim(),
        email: draft.email.trim(),
        role: draft.role,
        password: draft.password,
      }),
    onSuccess: (r) => {
      toast(`${r.user.name} added`, {
        description: 'Give them the password you set. They can be changed here later.',
      })
      setDraft(EMPTY)
      setAdding(false)
      refresh()
    },
    onError,
  })

  const save = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, payload),
    onSuccess: () => {
      setResetting(null)
      setNewPassword('')
      refresh()
    },
    onError,
  })

  return (
    <div>
      <PanelHeader
        title="People"
        note="Roles decide what each person can reach. Changing a password signs that person out everywhere."
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
          className="border-rule bg-wash/40 mb-6 grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
        >
          <Field label="Name">
            <Input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>

          <Field label="Email">
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>

          <Field label="Role">
            <Combobox
              options={ROLES}
              value={draft.role}
              clearable={false}
              onChange={(v) => setDraft({ ...draft, role: v })}
            />
          </Field>

          <Field
            label="Initial password"
            hint="At least 10 characters. Nothing here emails anyone, so pass it on yourself."
          >
            <Input
              type="text"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
          </Field>

          <div className="flex items-center gap-3 sm:col-span-2">
            <PrimaryButton
              disabled={
                create.isPending ||
                !draft.name.trim() ||
                !draft.email.trim() ||
                draft.password.length < 10
              }
            >
              {create.isPending ? 'Adding' : 'Add person'}
            </PrimaryButton>
            <GhostButton
              onClick={() => {
                setAdding(false)
                setDraft(EMPTY)
              }}
            >
              Cancel
            </GhostButton>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule-strong border-b">
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Account</Th>
              <Th>Logged</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-ink-muted py-8 text-center text-micro">
                  Loading
                </td>
              </tr>
            )}

            {users.map((u) => {
              const isMe = u.id === me?.id
              return (
                <tr key={u.id} className="border-rule hover:bg-wash border-b">
                  <Td className="font-medium">
                    {u.name}
                    {isMe && (
                      <Pill tone="outline" className="ml-1.5">
                        you
                      </Pill>
                    )}
                  </Td>
                  <Td className="text-ink-muted">{u.email}</Td>
                  <Td>
                    {/* Changing your own role is refused by the API, so it is not offered. */}
                    {isMe ? (
                      <Pill tone="neutral">{u.role}</Pill>
                    ) : (
                      <Combobox
                        options={ROLES}
                        value={u.role}
                        clearable={false}
                        onChange={(role) => save.mutate({ id: u.id, payload: { role } })}
                      />
                    )}
                  </Td>
                  <Td control>
                    <GhostButton
                      disabled={isMe}
                      onClick={() => save.mutate({ id: u.id, payload: { active: !u.active } })}
                      title={isMe ? 'You cannot deactivate your own account' : undefined}
                    >
                      {u.active ? 'Active' : 'Inactive'}
                    </GhostButton>
                  </Td>
                  <Td className="tabular">
                    {u.loggedCount}
                  </Td>
                  <Td align="right" control>
                    {resetting === u.id ? (
                      <span className="flex items-center justify-end gap-1.5">
                        <Input
                          autoFocus
                          type="text"
                          className="h-7 w-40"
                          placeholder="New password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <GhostButton
                          disabled={newPassword.length < 10}
                          onClick={() =>
                            save.mutate({ id: u.id, payload: { password: newPassword } })
                          }
                        >
                          Set
                        </GhostButton>
                        <GhostButton
                          onClick={() => {
                            setResetting(null)
                            setNewPassword('')
                          }}
                        >
                          Cancel
                        </GhostButton>
                      </span>
                    ) : (
                      <GhostButton onClick={() => setResetting(u.id)}>Set password</GhostButton>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
