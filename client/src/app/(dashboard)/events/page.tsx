"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import type { Event, EventType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)

  const [eventOpen, setEventOpen] = useState(false)
  const [eventCreating, setEventCreating] = useState(false)
  const [eventForm, setEventForm] = useState({
    name: "",
    event_type_id: "",
    event_date: "",
    location: "",
    description: "",
  })

  const [typeOpen, setTypeOpen] = useState(false)
  const [typeCreating, setTypeCreating] = useState(false)
  const [typeForm, setTypeForm] = useState({ name: "", priority: "0" })

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      apiFetch<Event[]>("/events"),
      apiFetch<EventType[]>("/event-types"),
    ])
      .then(([e, t]) => {
        setEvents(e)
        setEventTypes(t)
      })
      .catch(() => {
        setEvents([])
        setEventTypes([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const createEvent = async () => {
    setEventCreating(true)
    try {
      await apiFetch("/events", {
        method: "POST",
        body: JSON.stringify({
          ...eventForm,
          event_type_id: Number(eventForm.event_type_id),
        }),
      })
      toast.success("Event created")
      setEventOpen(false)
      setEventForm({ name: "", event_type_id: "", event_date: "", location: "", description: "" })
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create event")
    } finally {
      setEventCreating(false)
    }
  }

  const deleteEvent = async (id: number) => {
    try {
      await apiFetch(`/events/${id}`, { method: "DELETE" })
      toast.success("Event deleted")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete event")
    }
  }

  const createType = async () => {
    setTypeCreating(true)
    try {
      await apiFetch("/event-types", {
        method: "POST",
        body: JSON.stringify({
          name: typeForm.name,
          priority: Number(typeForm.priority),
        }),
      })
      toast.success("Event type created")
      setTypeOpen(false)
      setTypeForm({ name: "", priority: "0" })
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create event type")
    } finally {
      setTypeCreating(false)
    }
  }

  const deleteType = async (id: number) => {
    try {
      await apiFetch(`/event-types/${id}`, { method: "DELETE" })
      toast.success("Event type deleted")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete event type")
    }
  }

  return (
    <div className="space-y-10">
      {/* events */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>

          <Dialog open={eventOpen} onOpenChange={setEventOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-3.5" />
              Add Event
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Event</DialogTitle>
                <DialogDescription>Add a new event.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Name</Label>
                  <Input
                    value={eventForm.name}
                    onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                    placeholder="Wedding Ceremony"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Event Type</Label>
                  <Select
                    value={eventForm.event_type_id}
                    onValueChange={(val) => setEventForm({ ...eventForm, event_type_id: val as string })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {eventTypes.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={eventForm.event_date}
                    onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Location</Label>
                  <Input
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    placeholder="New York, NY"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    placeholder="Brief description..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createEvent} disabled={eventCreating}>
                  {eventCreating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">{ev.name}</TableCell>
                  <TableCell>{ev.event_type}</TableCell>
                  <TableCell>{new Date(ev.event_date).toLocaleDateString()}</TableCell>
                  <TableCell>{ev.location}</TableCell>
                  <TableCell className="text-muted-foreground">{ev.created_by_name}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Event</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete &quot;{ev.name}&quot;.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => deleteEvent(ev.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && events.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No events found</p>
        )}
      </section>

      {/* event types */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Event Types</h2>

          <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
            <DialogTrigger render={<Button size="sm" variant="secondary" />}>
              <Plus className="size-3.5" />
              Add Type
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Event Type</DialogTitle>
                <DialogDescription>Add a new event type.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Name</Label>
                  <Input
                    value={typeForm.name}
                    onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                    placeholder="Wedding"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={typeForm.priority}
                    onChange={(e) => setTypeForm({ ...typeForm, priority: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createType} disabled={typeCreating}>
                  {typeCreating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventTypes.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.priority}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Event Type</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete &quot;{t.name}&quot;.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => deleteType(t.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && eventTypes.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No event types found</p>
        )}
      </section>
    </div>
  )
}
