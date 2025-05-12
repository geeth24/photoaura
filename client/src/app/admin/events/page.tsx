'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  PlusCircle,
  Calendar,
  MapPin,
  AlignLeft,
  Trash,
  Edit,
  Tag,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { getCookie } from 'cookies-next';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EventType {
  id: number;
  name: string;
  priority: number;
}

interface Event {
  id: number;
  name: string;
  event_type_id: number;
  event_type: string;
  event_date: string;
  location?: string;
  description?: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState({
    name: '',
    event_type_id: 0,
    event_date: '',
    location: '',
    description: '',
  });

  const fetchEventTypes = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/event-types`);
      if (!response.ok) {
        throw new Error('Failed to fetch event types');
      }
      const data = await response.json();
      setEventTypes(data);
    } catch (error) {
      console.error('Error fetching event types:', error);
      toast.error('Failed to load event types');
    }
  };

  const fetchEvents = async () => {
    try {
      const token = getCookie('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchEventTypes();
      await fetchEvents();
    };
    loadData();
  }, []);

  const handleCreateEvent = async () => {
    if (!newEvent.name.trim()) {
      toast.error('Event name is required');
      return;
    }

    if (!newEvent.event_type_id) {
      toast.error('Event type is required');
      return;
    }

    if (!newEvent.event_date) {
      toast.error('Event date is required');
      return;
    }

    try {
      const token = getCookie('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newEvent),
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      toast.success('Event created successfully');
      setNewEvent({
        name: '',
        event_type_id: 0,
        event_date: '',
        location: '',
        description: '',
      });
      setOpen(false);
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    }
  };

  const handleUpdateEvent = async () => {
    if (!selectedEvent) return;

    if (!selectedEvent.name.trim()) {
      toast.error('Event name is required');
      return;
    }

    if (!selectedEvent.event_type_id) {
      toast.error('Event type is required');
      return;
    }

    if (!selectedEvent.event_date) {
      toast.error('Event date is required');
      return;
    }

    try {
      const token = getCookie('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/events/${selectedEvent.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: selectedEvent.name,
            event_type_id: selectedEvent.event_type_id,
            event_date: selectedEvent.event_date,
            location: selectedEvent.location,
            description: selectedEvent.description,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update event');
      }

      toast.success('Event updated successfully');
      setSelectedEvent(null);
      setOpen(false);
      fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event');
    }
  };

  const handleDeleteEvent = async (id: number) => {
    try {
      const token = getCookie('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      toast.success('Event deleted successfully');
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <div className="z-20 flex gap-2">
          <Link href="/admin/events/types">
            <Button variant="outline">
              Manage Event Types
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Dialog
            open={open && !selectedEvent}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setSelectedEvent(null);
            }}
          >
            <DialogTrigger asChild>
              <Button className="z-20">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
                <DialogDescription>Add a new event to your calendar.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="name">Event Name</label>
                  <Input
                    id="name"
                    placeholder="Event Name"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="event_type">Event Type</label>
                  <Select
                    onValueChange={(value) =>
                      setNewEvent({ ...newEvent, event_type_id: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Event Types</SelectLabel>
                        {eventTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <label htmlFor="event_date">Event Date & Time</label>
                  <Input
                    id="event_date"
                    type="datetime-local"
                    value={newEvent.event_date}
                    onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="location">Location (Optional)</label>
                  <Input
                    id="location"
                    placeholder="Event Location"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="description">Description (Optional)</label>
                  <textarea
                    id="description"
                    className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Event Description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateEvent}>Create Event</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Event Dialog */}
          <Dialog
            open={open && !!selectedEvent}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setSelectedEvent(null);
            }}
          >
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Edit Event</DialogTitle>
                <DialogDescription>Update the event details.</DialogDescription>
              </DialogHeader>
              {selectedEvent && (
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="edit-name">Event Name</label>
                    <Input
                      id="edit-name"
                      placeholder="Event Name"
                      value={selectedEvent.name}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="edit-event-type">Event Type</label>
                    <Select
                      value={selectedEvent.event_type_id.toString()}
                      onValueChange={(value) =>
                        setSelectedEvent({ ...selectedEvent, event_type_id: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an event type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Event Types</SelectLabel>
                          {eventTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="edit-event-date">Event Date & Time</label>
                    <Input
                      id="edit-event-date"
                      type="datetime-local"
                      value={
                        selectedEvent.event_date
                          ? new Date(selectedEvent.event_date).toISOString().slice(0, 16)
                          : ''
                      }
                      onChange={(e) =>
                        setSelectedEvent({ ...selectedEvent, event_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="edit-location">Location (Optional)</label>
                    <Input
                      id="edit-location"
                      placeholder="Event Location"
                      value={selectedEvent.location || ''}
                      onChange={(e) =>
                        setSelectedEvent({ ...selectedEvent, location: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="edit-description">Description (Optional)</label>
                    <textarea
                      id="edit-description"
                      className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Event Description"
                      value={selectedEvent.description || ''}
                      onChange={(e) =>
                        setSelectedEvent({ ...selectedEvent, description: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setSelectedEvent(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdateEvent}>Update Event</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <p>Loading events...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.length === 0 ? (
            <div className="col-span-full flex h-40 items-center justify-center">
              <p className="text-gray-500">No events found. Create one to get started.</p>
            </div>
          ) : (
            events.map((event) => (
              <Card key={event.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Tag className="mr-2 h-4 w-4" />
                      <span className="text-sm text-muted-foreground">{event.event_type}</span>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedEvent(event);
                          setOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the event &quot;{event.name}&quot;. This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-500 hover:bg-red-600"
                              onClick={() => handleDeleteEvent(event.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardTitle>{event.name}</CardTitle>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="mb-2 flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    {formatDate(event.event_date)}
                  </div>
                  {event.location && (
                    <div className="mb-2 flex items-center text-sm text-muted-foreground">
                      <MapPin className="mr-2 h-4 w-4" />
                      {event.location}
                    </div>
                  )}
                  {event.description && (
                    <div className="mb-2 flex text-sm">
                      <AlignLeft className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="line-clamp-3">{event.description}</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t pt-2 text-xs text-muted-foreground">
                  Created by {event.created_by_name}
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
