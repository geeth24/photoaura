import { redirect } from 'next/navigation';

function Page() {
  redirect(`/admin/photos`);
}

export default Page;
