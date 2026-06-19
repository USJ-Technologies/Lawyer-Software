import { createClientRecord } from '../actions'

export default function NewClientPage() {
  return (
    <form action={createClientRecord} className="p-6 max-w-md space-y-4">
      <h1 className="text-xl font-semibold">New client</h1>
      <input name="name" placeholder="Full name" className="w-full border p-2" required />
      <input name="phone" placeholder="Phone" className="w-full border p-2" />
      <input name="email" placeholder="Email" type="email" className="w-full border p-2" />
      <textarea name="address" placeholder="Address" className="w-full border p-2" />
      <button type="submit" className="bg-black text-white px-4 py-2 rounded">Save</button>
    </form>
  )
}
