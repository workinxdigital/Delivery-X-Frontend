import { ClientProjectScreen } from './project-screen'

export const metadata = { title: 'Project — DeliverX' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ClientProjectScreen id={id} />
}
